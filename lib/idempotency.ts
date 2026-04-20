/**
 * 幂等键构造 —— verification_result / Inngest step 复用
 *
 * 契约（ADR-002 · spec-database-design §9.4 · memory quote-check-idempotency-key-attempt）:
 *   key = `${taskId}_${quoteId}_a${attemptN}`
 *
 * 为什么强制三要素：
 *   - `verification_result.idempotency_key` 列进 0001_triggers 的 immutable 字段
 *     + `uniq_result_idempotency` 唯一约束 + 插入 `.onConflictDoNothing`
 *   - 重试复用同一 key → 第二次 INSERT 撞 unique 走 DO NOTHING → 上层拿到的是
 *     "第一次失败的快照"而非重试后的正确结果，而且毫无报错
 *   - 所以 attemptN 必须参与 key；Inngest 暴露 `ctx.attempt`（0-based 从 0 起）
 *
 * 调用规范：
 *   - attemptN 必须是 >= 0 的非负整数（Inngest ctx.attempt 的值域）
 *   - taskId / quoteId 必须是非空 UUID 样式字符串（本函数做最小校验；不做 UUID 严格匹配）
 *   - 同一 (taskId, quoteId) 每次重试应传入**单调递增**的 attemptN，否则仍会撞 unique
 */

export interface IdempotencyKeyInput {
  taskId: string;
  quoteId: string;
  attemptN: number;
}

export function buildResultIdempotencyKey(input: IdempotencyKeyInput): string {
  const { taskId, quoteId, attemptN } = input;

  if (!taskId || typeof taskId !== 'string') {
    throw new Error('[idempotency] taskId 必须为非空字符串');
  }
  if (!quoteId || typeof quoteId !== 'string') {
    throw new Error('[idempotency] quoteId 必须为非空字符串');
  }
  if (!Number.isInteger(attemptN) || attemptN < 0) {
    throw new Error(
      `[idempotency] attemptN 必须为 >= 0 的整数，收到 ${String(attemptN)}；` +
        `Inngest ctx.attempt 从 0 起递增，不可缺省`,
    );
  }

  return `${taskId}_${quoteId}_a${attemptN}`;
}

/**
 * Inngest step 幂等键（不是 verification_result 的那把）—— 用于 step.run 去重
 *
 * 形态：`${stepName}_${taskId}_${quoteId}_a${attemptN}`
 * 用途：同一 task 内不同 step（parse / extract / verify / map）在 Inngest 侧按 step id 已自动去重，
 *       但如果 step 内部要走外部幂等（例如 AI 调用），可以用本函数生成外部键。
 */
export function buildStepIdempotencyKey(stepName: string, input: IdempotencyKeyInput): string {
  if (!stepName || typeof stepName !== 'string') {
    throw new Error('[idempotency] stepName 必须为非空字符串');
  }
  return `${stepName}_${buildResultIdempotencyKey(input)}`;
}
