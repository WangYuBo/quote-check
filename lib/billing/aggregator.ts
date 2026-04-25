/**
 * 计费聚合查询（SS-9 / A22 · A23）
 *
 * 双轨制：
 * - 用户结算聚合 → 读 task.cost_actual_fen（按字数公式写入，见 user-pricing.ts）
 * - 内部成本监控 → 读 api_call（token 费率，仅运营方参考）
 *
 * 所有查询强制 user_id 隔离。
 */

import { and, count, desc, eq, gte, lte, sql } from 'drizzle-orm';

import { db } from '@/lib/db';
import { apiCall, task } from '@/lib/db/schema';

/* ─────────────────────────────────────────────────
 * Types
 * ───────────────────────────────────────────────── */

export interface UserBillingRow {
  period: string;         // YYYY-MM 或 taskId
  type: 'month' | 'task';
  charCount: number;
  costFen: number;
}

export interface UserBillingRange {
  totalFen: number;
  breakdown: UserBillingRow[];
}

/* ─────────────────────────────────────────────────
 * 用户结算：按字数聚合（A23）
 *
 * 从 task.cost_actual_fen 读取，用户费用由 computeUserCostFen 写入。
 * ───────────────────────────────────────────────── */

export async function getUserMonthlyBilling(
  userId: string,
  year: number,
  month: number,
): Promise<number> {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  const [result] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${task.costActualFen}), 0)`,
    })
    .from(task)
    .where(
      and(eq(task.userId, userId), gte(task.createdAt, start), lte(task.createdAt, end)),
    );

  return result?.total ?? 0;
}

export async function getUserBillingRange(
  userId: string,
  from: Date,
  to: Date,
  groupBy: 'month' | 'task' = 'month',
): Promise<UserBillingRange> {
  let groupExpr;
  if (groupBy === 'month') {
    groupExpr = sql<string>`to_char(${task.createdAt}, 'YYYY-MM')`;
  } else {
    groupExpr = sql<string>`${task.id}::text`;
  }

  const rows = await db
    .select({
      groupKey: groupExpr,
      count: count(),
      costFen: sql<number>`COALESCE(SUM(${task.costActualFen}), 0)`,
    })
    .from(task)
    .where(
      and(
        eq(task.userId, userId),
        gte(task.createdAt, from),
        lte(task.createdAt, to),
      ),
    )
    .groupBy(groupExpr)
    .orderBy(sql`1`);

  const breakdown: UserBillingRow[] = rows.map((r) => ({
    period: r.groupKey,
    type: groupBy,
    charCount: Number(r.count),   // task 数，非精确字数；字数见单个 task
    costFen: Number(r.costFen),
  }));

  const totalFen = breakdown.reduce((sum, r) => sum + r.costFen, 0);

  return { totalFen, breakdown };
}

/* ─────────────────────────────────────────────────
 * 内部成本监控（非用户结算）
 *
 * 保留 api_call 聚合，仅用于运营方成本分析。
 * ───────────────────────────────────────────────── */

export interface InternalApiCallRow {
  id: string;
  taskId: string;
  modelId: string;
  phase: string;
  promptTokens: number;
  completionTokens: number;
  costFen: number;
  calledAt: string;
}

export interface InternalTaskCost {
  taskId: string;
  modelId: string;
  calls: InternalApiCallRow[];
  totals: {
    promptTokens: number;
    completionTokens: number;
    costFen: number;
  };
}

/** 内部成本：单任务 token 费用明细（仅运营方，不暴露给用户） */
export async function getInternalTaskCost(taskId: string): Promise<InternalTaskCost | null> {
  const rows = await db
    .select()
    .from(apiCall)
    .where(eq(apiCall.taskId, taskId))
    .orderBy(desc(apiCall.calledAt));

  if (rows.length === 0) return null;

  const calls: InternalApiCallRow[] = rows.map((r) => ({
    id: r.id,
    taskId: r.taskId,
    modelId: r.modelId,
    phase: r.phase,
    promptTokens: r.promptTokens,
    completionTokens: r.completionTokens,
    costFen: r.costFen,
    calledAt: r.calledAt?.toISOString() ?? '',
  }));

  const totals = calls.reduce(
    (acc, c) => ({
      promptTokens: acc.promptTokens + c.promptTokens,
      completionTokens: acc.completionTokens + c.completionTokens,
      costFen: acc.costFen + c.costFen,
    }),
    { promptTokens: 0, completionTokens: 0, costFen: 0 },
  );

  return {
    taskId,
    modelId: calls[0]?.modelId ?? '',
    calls,
    totals,
  };
}
