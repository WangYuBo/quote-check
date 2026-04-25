/**
 * cost-guard — 费用守卫（MAS-4 · MS-D-04）
 *
 * 监听 task/cost.check 事件。
 * 若累计实际费用超过预估的 1.5 倍，将任务置为 PAUSED_COST。
 */
import { inngest } from '@/inngest/client';
import { costCheckEvent } from '@/inngest/events';
import { COST_GUARD_MULTIPLIER, DEFAULT_COST_CEILING_FEN } from '@/lib/ai/cost';
import { logger } from '@/lib/logger';
import { getTask, updateTaskStatus } from '@/lib/services/task';

export const costGuardFn = inngest.createFunction(
  {
    id: 'task-cost-guard',
    name: 'task · 费用守卫',
    concurrency: { key: 'event.data.taskId', limit: 1 },
    triggers: [costCheckEvent],
  },
  async ({ event }) => {
    const { taskId, costActualFen } = event.data;

    const t = await getTask(taskId);
    if (!t) {
      logger.warn({ taskId }, '[cost-guard] task not found');
      return { ok: false, reason: 'not_found' };
    }

    if (['COMPLETED', 'CANCELED', 'FAILED', 'PAUSED_COST', 'REJECTED_BY_MODERATION'].includes(t.status)) {
      return { ok: true, skipped: true };
    }

    const ceiling = t.costCeilingCents ?? DEFAULT_COST_CEILING_FEN;
    const estimated = t.costEstimatedCents ?? ceiling;
    const guardLimit = Math.ceil(estimated * COST_GUARD_MULTIPLIER);

    if (costActualFen > guardLimit) {
      logger.warn(
        { taskId, costActualFen, guardLimit, estimated },
        '[cost-guard] 超限，暂停任务',
      );
      await updateTaskStatus(taskId, 'PAUSED_COST');
      return { ok: true, paused: true, costActualFen, guardLimit };
    }

    return { ok: true, paused: false, costActualFen, guardLimit };
  },
);
