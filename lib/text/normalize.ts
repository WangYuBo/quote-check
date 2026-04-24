import * as OpenCC from 'opencc-js';
import { VARIANT_MAP, LIGATURE_PRESERVE } from './variants';

// spec-coding §9 · notes #3 · ADR-014
// 所有引文 / 参考 / 用户输入的比对必经此函数
// 不允许在业务代码里直接 str.replace 做繁简转换

export type NormalizeMode = 'simplified' | 'traditional' | 'preserve';

const t2s = OpenCC.Converter({ from: 't', to: 'cn' });
const s2t = OpenCC.Converter({ from: 'cn', to: 't' });

// OpenCC 't'→'cn' 会把乾/隆/元 的"乾"误简为"干"——对文史文本不合适
// 这里对几个经典语境做回补（宁可漏简，不可乱简）
const POST_SIMPLIFY_FIXUPS: readonly (readonly [RegExp, string])[] = [
  [/干坤/g, '乾坤'],
  [/干隆/g, '乾隆'],
  [/干元/g, '乾元'],
  [/干爹/g, '乾爹'],
  [/干妈/g, '乾妈'],
];

export function normalizeForCompare(input: string, mode: NormalizeMode = 'preserve'): string {
  if (!input) return '';

  let s = input;

  // 1. 合文白名单：提前抽出，防止任何阶段被拆解（OpenCC 对合文一般不动，但加保险）
  const ligatureSlots: string[] = [];
  s = Array.from(s)
    .map((ch) => {
      if (LIGATURE_PRESERVE.has(ch)) {
        ligatureSlots.push(ch);
        return '\uE000' + (ligatureSlots.length - 1) + '\uE001';
      }
      return ch;
    })
    .join('');

  // 2. 异体字映射（为/爲/為 → 为 等）
  s = Array.from(s)
    .map((ch) => VARIANT_MAP.get(ch) ?? ch)
    .join('');

  // 3. 繁简转换（按 mode）
  if (mode === 'simplified') {
    s = t2s(s);
    for (const [pattern, replacement] of POST_SIMPLIFY_FIXUPS) {
      s = s.replace(pattern, replacement);
    }
  } else if (mode === 'traditional') {
    s = s2t(s);
  }

  // 4. 恢复合文占位
  s = s.replace(/\uE000(\d+)\uE001/g, (_, idx: string) => {
    const i = Number(idx);
    return ligatureSlots[i] ?? '';
  });

  return s;
}

// CJK 标点 + 全角空格正则（用于 pg_trgm 存储层归一化）
const CJK_PUNCT_RE =
  /[\u3000-\u303f\uff00-\uffef\u2018\u2019\u201c\u201d\u2014\u2013\u00b7\u300a\u300b\u3008\u3009\u300c\u300d\u300e\u300f\u3010\u3011\u3014\u3015\u30fb\ufe10-\ufe1f\ufe30-\ufe4f\s]/g;

// 在 normalizeForCompare 之后调用，去标点供 pg_trgm 存储（不影响展示文本）
export function stripForTrigram(s: string): string {
  return s.replace(CJK_PUNCT_RE, '').replace(/[^一-鿿㐀-䶿豈-﫿\w]/g, '');
}

// 代理对安全的字符数组（spec-qa §3.2）
export function toCharArray(s: string): string[] {
  return Array.from(s);
}
