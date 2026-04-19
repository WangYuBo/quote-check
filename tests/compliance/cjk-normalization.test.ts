import { describe, it, expect } from 'vitest';
import { normalizeForCompare, toCharArray } from '@/lib/text/normalize';
import { GOLDEN_SAMPLES, VARIANT_EQUIVALENCE_PAIRS } from '@/tests/fixtures/cjk-golden';

/**
 * spec-qa §3.2 / §7.4 · notes #3
 * 文史字符黄金样本回归
 */

describe('normalizeForCompare — 文史字符黄金样本', () => {
  it.each(GOLDEN_SAMPLES)('$label [$intent]', ({ input, mode, expected }) => {
    expect(normalizeForCompare(input, mode)).toBe(expected);
  });
});

describe('normalizeForCompare — 异体字等价', () => {
  it.each(VARIANT_EQUIVALENCE_PAIRS)('%s ≡ %s（异体等价）', (a, b) => {
    expect(normalizeForCompare(a, 'preserve')).toBe(normalizeForCompare(b, 'preserve'));
  });
});

describe('normalizeForCompare — CJK 代理对安全', () => {
  it("CJK Extension B-G 字符不得被 split('') 截断", () => {
    const s = '𠀀𰻞'; // U+20000 + U+30EDE
    expect(Array.from(s).length).toBe(2);
    expect(s.split('').length).toBe(4); // 反例：JS 默认行为确实会拆 surrogate pair
    expect(toCharArray(s).length).toBe(2);
  });

  it('normalizeForCompare 对代理对字符保留原字', () => {
    const s = '𠀀𰻞面';
    expect(normalizeForCompare(s, 'preserve')).toBe(s);
    expect(Array.from(normalizeForCompare(s, 'simplified')).length).toBe(3);
  });
});

describe('normalizeForCompare — 空输入兜底', () => {
  it('空串返回空串', () => {
    expect(normalizeForCompare('', 'simplified')).toBe('');
    expect(normalizeForCompare('', 'preserve')).toBe('');
  });
});

describe('normalizeForCompare — 组合场景', () => {
  it('"為學日益" → simplified → "为学日益"（异体 + 繁简）', () => {
    expect(normalizeForCompare('為學日益', 'simplified')).toBe('为学日益');
  });

  it('"爲學日益" → simplified → "为学日益"（爲 / 為 异体等价）', () => {
    expect(normalizeForCompare('爲學日益', 'simplified')).toBe('为学日益');
  });

  it('"三十而立" preserve 保持原样', () => {
    expect(normalizeForCompare('三十而立', 'preserve')).toBe('三十而立');
  });
});
