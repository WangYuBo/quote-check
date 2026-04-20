import { describe, expect, it } from 'vitest';

import {
  CONFIDENCE_ALGO_VERSION,
  CONFIDENCE_WEIGHTS,
  computeConfidence,
  stripLlmSelfScores,
} from '@/lib/ai/confidence';

describe('computeConfidence · 三信号加权（ADR-007 · real.md #2）', () => {
  it('weights 与算法版本与 spec 锁定一致', () => {
    expect(CONFIDENCE_WEIGHTS).toEqual({ refHit: 0.5, locationValid: 0.5, crossModel: 0 });
    expect(CONFIDENCE_ALGO_VERSION).toBe('v1.0');
  });

  it('完全命中 → 1.0', () => {
    const r = computeConfidence({ refHit: 1, locationValid: 1, crossModel: 1 });
    expect(r.value).toBe(1);
  });

  it('全 0 → 0', () => {
    const r = computeConfidence({ refHit: 0, locationValid: 0, crossModel: 0 });
    expect(r.value).toBe(0);
  });

  it('仅 refHit 命中 → 0.5', () => {
    const r = computeConfidence({ refHit: 1, locationValid: 0, crossModel: 0 });
    expect(r.value).toBe(0.5);
  });

  it('仅 locationValid → 0.5', () => {
    const r = computeConfidence({ refHit: 0, locationValid: 1, crossModel: 0 });
    expect(r.value).toBe(0.5);
  });

  it('crossModel 权重为 0，传 1 也不应影响结果', () => {
    const r1 = computeConfidence({ refHit: 0.8, locationValid: 1, crossModel: 0 });
    const r2 = computeConfidence({ refHit: 0.8, locationValid: 1, crossModel: 1 });
    expect(r1.value).toBe(r2.value);
  });

  it('越界输入被 clamp，不抛错', () => {
    const r = computeConfidence({ refHit: -0.5, locationValid: 1, crossModel: 99 });
    expect(r.signals.refHit).toBe(0);
    expect(r.signals.crossModel).toBe(1);
    expect(r.value).toBe(0.5);
  });

  it('NaN / Infinity 视为非法输入，一律归零（保守）', () => {
    const r = computeConfidence({ refHit: Number.NaN, locationValid: 1, crossModel: Infinity });
    expect(r.signals.refHit).toBe(0);
    expect(r.signals.crossModel).toBe(0);
    expect(r.value).toBe(0.5);
  });

  it('locationValid 非 0/1 的值被强制成 0', () => {
    const r = computeConfidence({
      refHit: 1,
      locationValid: 0.7 as unknown as 0 | 1,
      crossModel: 0,
    });
    expect(r.signals.locationValid).toBe(0);
    expect(r.value).toBe(0.5);
  });

  it('返回结构包含 weights + algoVersion（用于版本戳）', () => {
    const r = computeConfidence({ refHit: 1, locationValid: 1, crossModel: 0 });
    expect(r.weights).toBe(CONFIDENCE_WEIGHTS);
    expect(r.algoVersion).toBe('v1.0');
  });
});

describe('stripLlmSelfScores · 丢弃 LLM 自评字段（real.md #2）', () => {
  it('剥离 confidence/score/certainty/probability 字段', () => {
    const raw = {
      verdict: 'unchanged',
      confidence: 0.9,
      Score: 77,
      certainty: 'high',
      probability: 0.5,
      explanation: '一致',
    };
    const cleaned = stripLlmSelfScores(raw);
    expect(cleaned).toEqual({ verdict: 'unchanged', explanation: '一致' });
  });

  it('保留其他字段不变', () => {
    const raw = { verdict: 'verified', hits: [1, 2] };
    expect(stripLlmSelfScores(raw)).toEqual({ verdict: 'verified', hits: [1, 2] });
  });

  it('空对象安全', () => {
    expect(stripLlmSelfScores({})).toEqual({});
  });
});
