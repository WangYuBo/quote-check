/*
 * 文史字符黄金样本集（spec-quality-assurance §3.2）
 *
 * 这些样本是 normalizeForCompare / VARIANT_MAP / CJK Ext B-G 代理对处理的
 * 回归基线。任何 lib/text/ 的修改都必须过这一套。
 *
 * notes #3 要求：
 *   - 文史合文（囍/卅/廿）不展开
 *   - 双字同形简（發/髮 → 发 但上下文保留）
 *   - 异体字等价（為/爲/为）
 *   - CJK Extension B-G 不被 split('') 截断
 */

import type { NormalizeMode } from '@/lib/text/normalize';

export interface GoldenSample {
  readonly label: string;
  readonly input: string;
  readonly mode: NormalizeMode;
  readonly expected: string;
  readonly intent: string;
}

export const GOLDEN_SAMPLES: readonly GoldenSample[] = [
  {
    label: '乾坤不转干坤',
    input: '乾坤',
    mode: 'simplified',
    expected: '乾坤',
    intent: 'OpenCC 方言表回归：乾 作天地义不简化为 干',
  },
  {
    label: '發 → 发',
    input: '發',
    mode: 'simplified',
    expected: '发',
    intent: '繁简正常映射',
  },
  {
    label: '髮 → 发（同形简合并）',
    input: '髮',
    mode: 'simplified',
    expected: '发',
    intent: '双字同形简的陷阱：髮/發 → 都简为"发"',
  },
  {
    label: '囍 合文保留（simplified）',
    input: '囍',
    mode: 'simplified',
    expected: '囍',
    intent: '合文白名单：不展开为"喜喜"',
  },
  {
    label: '囍 合文保留（preserve）',
    input: '囍',
    mode: 'preserve',
    expected: '囍',
    intent: '合文白名单',
  },
  {
    label: '卅 不展开为三十',
    input: '卅',
    mode: 'preserve',
    expected: '卅',
    intent: '数字合文不展开',
  },
  {
    label: 'CJK Ext B 字符保留（𠀀 U+20000）',
    input: '𠀀',
    mode: 'preserve',
    expected: '𠀀',
    intent: '代理对支持：BMP 外字符不得丢失',
  },
  {
    label: 'CJK Ext G 字符保留（𰻞 U+30EDE）',
    input: '𰻞',
    mode: 'preserve',
    expected: '𰻞',
    intent: 'Ext G 字符边界',
  },
];

export const VARIANT_EQUIVALENCE_PAIRS: readonly (readonly [string, string])[] = [
  ['為', '为'],
  ['爲', '为'],
  ['為', '爲'],
];
