/**
 * LLM 调用计费记录器（SS-9 Billing / ADR-018）
 *
 * recordApiCall 是唯一允许写 api_call 表的入口。
 * 每次 LLM 调用（extract / verify / moderation_probe / map）必须经由此函数记账。
 *
 * 事务保证：
 * 1. INSERT api_call（逐次调用明细）
 * 2. UPDATE task.cost_actual_fen += costFen（原子累加）
 *
 * 不变量：task.cost_actual_fen = SUM(api_call.cost_fen WHERE task_id = task.id)
 * 任务结束时跑一次断言；不一致则触发数据修复（写入 audit_log）。
 *
 * 注意：本文件计入 task.cost_actual_fen 的费用仅用于内部成本监控（cost-guard），
 * 用户结算使用 computeUserCostFen(charCount)（按字数公式），不从此处聚合。
 */

import { eq, sql } from 'drizzle-orm';

import { db } from '@/lib/db';
import { apiCall, task } from '@/lib/db/schema';
import { computeInternalCostFen, INTERNAL_PRICING_VERSION } from '@/lib/billing/pricing';

export interface RecordApiCallOpts {
  taskId: string;
  userId: string;
  modelId: string;
  phase: 'extract' | 'verify' | 'moderation_probe' | 'map';
  promptTokens: number;
  completionTokens: number;
}

/**
 * 记录一次 LLM 调用费用，原子写入 api_call 明细 + 累加 task.cost_actual_fen。
 *
 * 费用只信 SDK 返回的 usage.promptTokens / usage.completionTokens，不信 LLM 自报数字。
 */
export async function recordApiCall(opts: RecordApiCallOpts): Promise<void> {
  const costFen = computeInternalCostFen(opts.modelId, opts.promptTokens, opts.completionTokens);

  await db.transaction(async (tx) => {
    await tx.insert(apiCall).values({
      taskId: opts.taskId,
      userId: opts.userId,
      modelId: opts.modelId,
      pricingVersion: INTERNAL_PRICING_VERSION,
      promptTokens: opts.promptTokens,
      completionTokens: opts.completionTokens,
      costFen,
      phase: opts.phase,
    });

    await tx
      .update(task)
      .set({
        costActualFen: sql`COALESCE(${task.costActualFen}, 0) + ${costFen}`,
      })
      .where(eq(task.id, opts.taskId));
  });
}

/**
 * 断言任务的实际费用与 api_call 汇总一致。
 * 不一致时写入 audit_log 触发数据修复。
 */
export async function assertTaskCostConsistency(taskId: string): Promise<boolean> {
  const [agg] = await db
    .select({
      sumFen: sql<number>`COALESCE(SUM(${apiCall.costFen}), 0)`,
    })
    .from(apiCall)
    .where(eq(apiCall.taskId, taskId));

  const [t] = await db
    .select({ costActualFen: task.costActualFen })
    .from(task)
    .where(eq(task.id, taskId));

  if (!t || !agg) return true; // no data to assert

  const sumFromCalls = agg.sumFen;
  const stored = t.costActualFen ?? 0;

  if (sumFromCalls !== stored) {
    const { auditLog } = await import('@/lib/db/schema');
    await db.insert(auditLog).values({
      op: 'BILLING_INCONSISTENCY',
      targetType: 'task',
      targetId: taskId,
      metadataJson: {
        expected: sumFromCalls,
        actual: stored,
        discrepancy: sumFromCalls - stored,
      },
    });
    return false;
  }

  return true;
}
