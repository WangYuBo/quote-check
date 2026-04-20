import { describe, expect, it } from 'vitest';

import {
  buildResultIdempotencyKey,
  buildStepIdempotencyKey,
  type IdempotencyKeyInput,
} from '@/lib/idempotency';

/**
 * 契约：key = `${taskId}_${quoteId}_a${attemptN}`（memory quote-check-idempotency-key-attempt）
 *
 * 重点防护：
 *   - attemptN 缺省或非整数 → 抛错（不可静默为 0）
 *   - 同 (task, quote) 不同 attempt → 必须产生不同 key，否则 ON CONFLICT DO NOTHING 会吞掉重试结果
 */

const baseInput: IdempotencyKeyInput = {
  taskId: '11111111-1111-1111-1111-111111111111',
  quoteId: '22222222-2222-2222-2222-222222222222',
  attemptN: 0,
};

describe('buildResultIdempotencyKey', () => {
  it('按约定拼接 task_quote_aN', () => {
    expect(buildResultIdempotencyKey(baseInput)).toBe(
      '11111111-1111-1111-1111-111111111111_22222222-2222-2222-2222-222222222222_a0',
    );
  });

  it('attempt=0 合法（Inngest ctx.attempt 首跑为 0）', () => {
    expect(() => buildResultIdempotencyKey({ ...baseInput, attemptN: 0 })).not.toThrow();
  });

  it('attempt=1/2/3 产生不同 key（重试必须换 key，否则被 unique 吞掉）', () => {
    const keys = new Set(
      [0, 1, 2, 3].map((n) => buildResultIdempotencyKey({ ...baseInput, attemptN: n })),
    );
    expect(keys.size).toBe(4);
  });

  it('attempt 非整数 → 抛错', () => {
    expect(() => buildResultIdempotencyKey({ ...baseInput, attemptN: 1.5 })).toThrow(/整数/);
  });

  it('attempt 负数 → 抛错', () => {
    expect(() => buildResultIdempotencyKey({ ...baseInput, attemptN: -1 })).toThrow(/整数/);
  });

  it('attempt NaN → 抛错', () => {
    expect(() => buildResultIdempotencyKey({ ...baseInput, attemptN: Number.NaN })).toThrow(/整数/);
  });

  it('taskId 空串 → 抛错', () => {
    expect(() => buildResultIdempotencyKey({ ...baseInput, taskId: '' })).toThrow(/taskId/);
  });

  it('quoteId 空串 → 抛错', () => {
    expect(() => buildResultIdempotencyKey({ ...baseInput, quoteId: '' })).toThrow(/quoteId/);
  });

  it('attemptN 缺省（undefined）→ 抛错（保护：不允许调用方忘传 attempt）', () => {
    // 绕过 TS 模拟运行时 JS 调用
    expect(() =>
      buildResultIdempotencyKey({
        taskId: baseInput.taskId,
        quoteId: baseInput.quoteId,
      } as unknown as IdempotencyKeyInput),
    ).toThrow(/整数/);
  });
});

describe('buildStepIdempotencyKey', () => {
  it('stepName 前缀拼上去', () => {
    expect(buildStepIdempotencyKey('verify', baseInput)).toBe(
      `verify_${buildResultIdempotencyKey(baseInput)}`,
    );
  });

  it('stepName 空串 → 抛错', () => {
    expect(() => buildStepIdempotencyKey('', baseInput)).toThrow(/stepName/);
  });
});
