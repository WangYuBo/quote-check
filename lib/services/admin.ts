/**
 * Admin 服务层（SS-A · 管理后台专用）
 *
 * 职责：跨用户查询 + 系统级统计 + 管理操作
 * 所有查询均不限制 userId（区别于 lib/services/dashboard.ts 的用户级查询）
 */
import { and, count, desc, eq, gte, like, lte, sql, inArray } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  user,
  task,
  manuscript,
  auditLog,
  apiCall,
  type TaskStatus,
  TASK_STATUS_VALUES,
} from '@/lib/db/schema';

/* ─────────────────────────────────────────────────
 * Types
 * ───────────────────────────────────────────────── */

export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalTasks: number;
  monthlyRevenueFen: number;
  monthlyApiCostFen: number;
}

export interface TaskTrendPoint {
  date: string;
  count: number;
}

export interface UserListItem {
  id: string;
  email: string;
  name: string | null;
  role: string;
  organization: string | null;
  suspendedAt: string | null;
  createdAt: string;
  taskCount: number;
}

export interface UserFilter {
  role?: string | undefined;
  status?: string | undefined; // 'active' | 'suspended'
  q?: string | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
}

export interface TaskListItem {
  id: string;
  displayId: string;
  userEmail: string;
  userName: string | null;
  status: string;
  totalQuotes: number | null;
  costActualFen: number | null;
  createdAt: string;
  completedAt: string | null;
}

export interface TaskFilter {
  status?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
  q?: string | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
}

export interface ManuscriptListItem {
  id: string;
  displayId: string;
  userEmail: string;
  userName: string | null;
  filename: string;
  charCount: number | null;
  createdAt: string;
  destroyedAt: string | null;
}

export interface ManuscriptFilter {
  q?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
}

export interface AuditLogItem {
  id: number;
  userId: string | null;
  userEmail: string | null;
  op: string;
  targetType: string | null;
  targetId: string | null;
  metadataJson: Record<string, unknown> | null;
  createdAt: string;
}

export interface AuditLogFilter {
  userId?: string | undefined;
  op?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
}

/* ─────────────────────────────────────────────────
 * 数据脱敏
 * ───────────────────────────────────────────────── */

function maskEmail(email: string): string {
  const [name, domain] = email.split('@');
  if (!name || !domain) return email;
  if (name.length <= 2) return `${name[0]}***@${domain}`;
  return `${name[0]}${name[1]}***@${domain}`;
}

/* ─────────────────────────────────────────────────
 * Dashboard 统计
 * ───────────────────────────────────────────────── */

export async function getDashboardStats(): Promise<DashboardStats> {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [[totalUsers], [monthlyRevenue], [monthlyApiCost], [taskAgg]] = await Promise.all([
    db.select({ count: count() }).from(user),
    db
      .select({ fen: sql<number>`COALESCE(SUM(${task.costActualFen}), 0)` })
      .from(task)
      .where(and(gte(task.createdAt, firstOfMonth), eq(task.status, 'COMPLETED' as TaskStatus))),
    db
      .select({ fen: sql<number>`COALESCE(SUM(${apiCall.costFen}), 0)` })
      .from(apiCall)
      .where(gte(apiCall.calledAt, firstOfMonth)),
    db
      .select({ count: count() })
      .from(task)
      .where(gte(task.createdAt, firstOfMonth)),
  ]);

  return {
    totalUsers: totalUsers?.count ?? 0,
    activeUsers: totalUsers?.count ?? 0,
    totalTasks: taskAgg?.count ?? 0,
    monthlyRevenueFen: Number(monthlyRevenue?.fen ?? 0),
    monthlyApiCostFen: Number(monthlyApiCost?.fen ?? 0),
  };
}

/* ─────────────────────────────────────────────────
 * 任务趋势（每日完成数）
 * ───────────────────────────────────────────────── */

export async function getTaskTrend(days = 30): Promise<TaskTrendPoint[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const rows = await db
    .select({
      date: sql<string>`DATE(${task.completedAt})`,
      count: count(),
    })
    .from(task)
    .where(and(gte(task.completedAt, since), eq(task.status, 'COMPLETED' as TaskStatus)))
    .groupBy(sql`DATE(${task.completedAt})`)
    .orderBy(sql`DATE(${task.completedAt})`);

  return rows.map((r) => ({ date: r.date, count: Number(r.count) }));
}

/* ─────────────────────────────────────────────────
 * 用户管理
 * ───────────────────────────────────────────────── */

export async function listUsers(filter: UserFilter = {}): Promise<{
  items: UserListItem[];
  total: number;
}> {
  const { role: roleFilter, status, q, page = 1, pageSize = 20 } = filter;
  const offset = (page - 1) * pageSize;

  const conditions: ReturnType<typeof eq>[] = [];
  if (roleFilter && roleFilter !== 'ALL') {
    conditions.push(eq(user.role, roleFilter as 'B' | 'C' | 'admin'));
  }
  if (status === 'suspended') {
    conditions.push(sql`${user.suspendedAt} IS NOT NULL`);
  } else if (status === 'active') {
    conditions.push(sql`${user.suspendedAt} IS NULL`);
  }
  if (q) {
    conditions.push(sql`(${like(user.email, `%${q}%`)} OR ${like(user.name, `%${q}%`)})`);
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, totalResult] = await Promise.all([
    db
      .select({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organization: user.organization,
        suspendedAt: user.suspendedAt,
        createdAt: user.createdAt,
      })
      .from(user)
      .where(where)
      .orderBy(desc(user.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ count: count() }).from(user).where(where),
  ]);

  // Get task counts for each user
  const userIds = rows.map((r) => r.id);
  let taskCountMap: Record<string, number> = {};
  if (userIds.length > 0) {
    const taskCounts = await db
      .select({
        userId: task.userId,
        count: count(),
      })
      .from(task)
      .where(inArray(task.userId, userIds))
      .groupBy(task.userId);
    for (const tc of taskCounts) {
      taskCountMap[tc.userId] = Number(tc.count);
    }
  }

  const items: UserListItem[] = rows.map((r) => ({
    id: r.id,
    email: maskEmail(r.email),
    name: r.name,
    role: r.role,
    organization: r.organization,
    suspendedAt: r.suspendedAt?.toISOString() ?? null,
    createdAt: r.createdAt?.toISOString() ?? '',
    taskCount: taskCountMap[r.id] ?? 0,
  }));

  return { items, total: totalResult[0]?.count ?? 0 };
}

export async function updateUser(
  id: string,
  data: { role?: string | undefined; suspendedAt?: Date | null },
): Promise<void> {
  await db
    .update(user)
    .set({
      ...(data.role ? { role: data.role as 'B' | 'C' | 'admin' } : {}),
      ...(data.suspendedAt !== undefined ? { suspendedAt: data.suspendedAt } : {}),
    })
    .where(eq(user.id, id));
}

/* ─────────────────────────────────────────────────
 * 任务管理
 * ───────────────────────────────────────────────── */

export async function listAllTasks(filter: TaskFilter = {}): Promise<{
  items: TaskListItem[];
  total: number;
}> {
  const { status: statusFilter, from, to, q, page = 1, pageSize = 20 } = filter;
  const offset = (page - 1) * pageSize;

  const conditions: ReturnType<typeof sql>[] = [];
  if (statusFilter && statusFilter !== 'ALL') {
    conditions.push(eq(task.status, statusFilter as TaskStatus));
  }
  if (from) {
    conditions.push(gte(task.createdAt, new Date(from)));
  }
  if (to) {
    conditions.push(lte(task.createdAt, new Date(to)));
  }
  if (q) {
    conditions.push(like(task.displayId, `%${q}%`));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, totalResult] = await Promise.all([
    db
      .select({
        id: task.id,
        displayId: task.displayId,
        status: task.status,
        totalQuotes: task.totalQuotes,
        costActualFen: task.costActualFen,
        createdAt: task.createdAt,
        completedAt: task.completedAt,
        userId: task.userId,
      })
      .from(task)
      .where(where)
      .orderBy(desc(task.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ count: count() }).from(task).where(where),
  ]);

  // Get user emails
  const userIds = [...new Set(rows.map((r) => r.userId))];
  const userRows = userIds.length > 0
    ? await db
        .select({ id: user.id, email: user.email, name: user.name })
        .from(user)
        .where(inArray(user.id, userIds))
    : [];
  const userMap: Record<string, { email: string; name: string | null }> = {};
  for (const u of userRows) {
    userMap[u.id] = { email: u.email, name: u.name };
  }

  const items: TaskListItem[] = rows.map((r) => ({
    id: r.id,
    displayId: r.displayId,
    userEmail: userMap[r.userId]?.email ?? '',
    userName: userMap[r.userId]?.name ?? null,
    status: r.status,
    totalQuotes: r.totalQuotes,
    costActualFen: r.costActualFen,
    createdAt: r.createdAt?.toISOString() ?? '',
    completedAt: r.completedAt?.toISOString() ?? null,
  }));

  return { items, total: totalResult[0]?.count ?? 0 };
}

export async function cancelTask(id: string): Promise<void> {
  await db
    .update(task)
    .set({ status: 'CANCELED' as TaskStatus, canceledAt: new Date() })
    .where(eq(task.id, id));
}

/* ─────────────────────────────────────────────────
 * 稿件管理
 * ───────────────────────────────────────────────── */

export async function listManuscripts(filter: ManuscriptFilter = {}): Promise<{
  items: ManuscriptListItem[];
  total: number;
}> {
  const { q, from, to, page = 1, pageSize = 20 } = filter;
  const offset = (page - 1) * pageSize;

  const conditions: ReturnType<typeof sql>[] = [];
  if (q) {
    conditions.push(
      sql`(${like(manuscript.displayId, `%${q}%`)} OR ${like(manuscript.filename, `%${q}%`)})`,
    );
  }
  if (from) {
    conditions.push(gte(manuscript.createdAt, new Date(from)));
  }
  if (to) {
    conditions.push(lte(manuscript.createdAt, new Date(to)));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, totalResult] = await Promise.all([
    db
      .select({
        id: manuscript.id,
        displayId: manuscript.displayId,
        filename: manuscript.filename,
        charCount: manuscript.charCount,
        createdAt: manuscript.createdAt,
        destroyedAt: manuscript.destroyedAt,
        userId: manuscript.userId,
      })
      .from(manuscript)
      .where(where)
      .orderBy(desc(manuscript.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ count: count() }).from(manuscript).where(where),
  ]);

  const userIds = [...new Set(rows.map((r) => r.userId))];
  const userRows = userIds.length > 0
    ? await db
        .select({ id: user.id, email: user.email, name: user.name })
        .from(user)
        .where(inArray(user.id, userIds))
    : [];
  const userMap: Record<string, { email: string; name: string | null }> = {};
  for (const u of userRows) {
    userMap[u.id] = { email: u.email, name: u.name };
  }

  const items: ManuscriptListItem[] = rows.map((r) => ({
    id: r.id,
    displayId: r.displayId,
    userEmail: maskEmail(userMap[r.userId]?.email ?? ''),
    userName: userMap[r.userId]?.name ?? null,
    filename: r.filename,
    charCount: r.charCount,
    createdAt: r.createdAt?.toISOString() ?? '',
    destroyedAt: r.destroyedAt?.toISOString() ?? null,
  }));

  return { items, total: totalResult[0]?.count ?? 0 };
}

/* ─────────────────────────────────────────────────
 * 审计日志
 * ───────────────────────────────────────────────── */

export async function listAuditLogs(filter: AuditLogFilter = {}): Promise<{
  items: AuditLogItem[];
  total: number;
}> {
  const { userId: uid, op, from, to, page = 1, pageSize = 20 } = filter;
  const offset = (page - 1) * pageSize;

  const conditions: ReturnType<typeof sql>[] = [];
  if (uid) {
    conditions.push(eq(auditLog.userId, uid));
  }
  if (op && op !== 'ALL') {
    conditions.push(eq(auditLog.op, op));
  }
  if (from) {
    conditions.push(gte(auditLog.createdAt, new Date(from)));
  }
  if (to) {
    conditions.push(lte(auditLog.createdAt, new Date(to)));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, totalResult] = await Promise.all([
    db
      .select({
        id: auditLog.id,
        userId: auditLog.userId,
        op: auditLog.op,
        targetType: auditLog.targetType,
        targetId: auditLog.targetId,
        metadataJson: auditLog.metadataJson,
        createdAt: auditLog.createdAt,
      })
      .from(auditLog)
      .where(where)
      .orderBy(desc(auditLog.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ count: count() }).from(auditLog).where(where),
  ]);

  // Get user emails
  const logUserIds = [...new Set(rows.map((r) => r.userId).filter(Boolean) as string[])];
  const userRows = logUserIds.length > 0
    ? await db
        .select({ id: user.id, email: user.email })
        .from(user)
        .where(inArray(user.id, logUserIds))
    : [];
  const emailMap: Record<string, string> = {};
  for (const u of userRows) {
    emailMap[u.id] = u.email;
  }

  const items: AuditLogItem[] = rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    userEmail: r.userId ? (emailMap[r.userId] ? maskEmail(emailMap[r.userId]!) : null) : null,
    op: r.op,
    targetType: r.targetType,
    targetId: r.targetId,
    metadataJson: r.metadataJson,
    createdAt: r.createdAt?.toISOString() ?? '',
  }));

  return { items, total: totalResult[0]?.count ?? 0 };
}
