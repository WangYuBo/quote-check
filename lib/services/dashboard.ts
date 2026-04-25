/**
 * Dashboard 服务层（SS-8 / A22 用户主页）
 *
 * 职责：用户项目列表查询 + 状态聚合统计 + 账户摘要
 * 所有查询强制 WHERE user_id = :session_user_id（SS-1 Auth 隔离）
 */

import { and, count, desc, eq, gte, inArray, like, lte, sql } from 'drizzle-orm';

import { db } from '@/lib/db';
import { task, type TaskStatus, TASK_STATUS_VALUES } from '@/lib/db/schema';

/* ─────────────────────────────────────────────────
 * Types
 * ───────────────────────────────────────────────── */

export interface ProjectListItem {
  taskId: string;
  displayId: string;
  manuscriptName: string;
  status: TaskStatus;
  createdAt: string;
  totalQuotes: number | null;
  costActualFen: number | null;
  reportFrozenAt: string | null;
}

export interface ProjectFilter {
  status?: string;
  q?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface BillingSummary {
  thisMonth: { fen: number; taskCount: number };
  total: { fen: number; taskCount: number };
  runningTaskCount: number;
}

/* ─────────────────────────────────────────────────
 * Query: 项目列表（分页 + 筛选 + 搜索）
 * ───────────────────────────────────────────────── */

export async function listProjects(
  userId: string,
  filter: ProjectFilter = {},
): Promise<{ items: ProjectListItem[]; total: number }> {
  const { status, q, from, to, page = 1, pageSize = 12 } = filter;
  const offset = (page - 1) * pageSize;

  const conditions = [eq(task.userId, userId)];

  if (status && status !== 'ALL') {
    conditions.push(eq(task.status, status as TaskStatus));
  }

  if (q) {
    conditions.push(like(task.displayId, `%${q}%`));
  }

  if (from) {
    conditions.push(gte(task.createdAt, new Date(from)));
  }

  if (to) {
    conditions.push(lte(task.createdAt, new Date(to)));
  }

  const where = and(...conditions);

  const [rows, totalResult] = await Promise.all([
    db
      .select({
        id: task.id,
        displayId: task.displayId,
        status: task.status,
        createdAt: task.createdAt,
        totalQuotes: task.totalQuotes,
        costActualFen: task.costActualFen,
        completedAt: task.completedAt,
      })
      .from(task)
      .where(where)
      .orderBy(desc(task.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ count: count() }).from(task).where(where),
  ]);

  const items: ProjectListItem[] = rows.map((r) => ({
    taskId: r.id,
    displayId: r.displayId,
    manuscriptName: r.displayId, // displayId 作为脱敏显示名
    status: r.status as TaskStatus,
    createdAt: r.createdAt?.toISOString() ?? '',
    totalQuotes: r.totalQuotes,
    costActualFen: r.costActualFen,
    reportFrozenAt: r.completedAt?.toISOString() ?? null,
  }));

  return { items, total: totalResult[0]?.count ?? 0 };
}

/* ─────────────────────────────────────────────────
 * Query: 各状态任务计数
 * ───────────────────────────────────────────────── */

export async function aggregateStatusCounts(
  userId: string,
): Promise<Record<string, number>> {
  const rows = await db
    .select({
      status: task.status,
      count: count(),
    })
    .from(task)
    .where(eq(task.userId, userId))
    .groupBy(task.status);

  const counts: Record<string, number> = {};
  // 初始化所有状态为 0
  for (const s of TASK_STATUS_VALUES) {
    counts[s] = 0;
  }
  for (const row of rows) {
    counts[row.status] = Number(row.count);
  }
  return counts;
}

/* ─────────────────────────────────────────────────
 * Query: 账户计费摘要
 * ───────────────────────────────────────────────── */

export async function getBillingSummary(userId: string): Promise<BillingSummary> {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [thisMonthAgg] = await db
    .select({
      fen: sql<number>`COALESCE(SUM(${task.costActualFen}), 0)`,
      taskCount: count(),
    })
    .from(task)
    .where(and(eq(task.userId, userId), gte(task.createdAt, firstOfMonth)));

  const [totalAgg] = await db
    .select({
      fen: sql<number>`COALESCE(SUM(${task.costActualFen}), 0)`,
      taskCount: count(),
    })
    .from(task)
    .where(eq(task.userId, userId));

  const [runningCount] = await db
    .select({ count: count() })
    .from(task)
    .where(
      and(
        eq(task.userId, userId),
        inArray(task.status, [
          'PARSING',
          'PENDING_ESTIMATE',
          'AWAITING_CONFIRM',
          'VERIFYING',
        ] as TaskStatus[]),
      ),
    );

  return {
    thisMonth: { fen: thisMonthAgg?.fen ?? 0, taskCount: thisMonthAgg?.taskCount ?? 0 },
    total: { fen: totalAgg?.fen ?? 0, taskCount: totalAgg?.taskCount ?? 0 },
    runningTaskCount: runningCount?.count ?? 0,
  };
}
