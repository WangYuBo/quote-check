import { neon } from '@neondatabase/serverless';

import { env } from '@/lib/env';
import { normalizeForCompare, stripForTrigram } from '@/lib/text/normalize';

// 用原生 neon tagged template（非 drizzle wrapper）处理 uuid[] 参数
// drizzle execute() 对数组参数有序列化问题；neon tag 直接传 JS 数组可被正确绑定
const rawSql = neon(env.DATABASE_URL);

export interface PassageHit {
  referenceId: string;
  paragraphId: string;
  paragraphSeq: number;
  text: string;
  similarity: number;
}

export async function retrievePassagesForQuote({
  quoteText,
  referenceIds,
  topK = 3,
  minSimilarity = 0.3,
}: {
  quoteText: string;
  referenceIds: string[];
  topK?: number;
  minSimilarity?: number;
}): Promise<PassageHit[]> {
  if (referenceIds.length === 0 || !quoteText.trim()) return [];

  const normalized = stripForTrigram(normalizeForCompare(quoteText, 'simplified'));

  // Step 1: pg_trgm similarity() — requires pg_trgm extension (I-02 + I-03 已装)
  let rows = await rawSql`
    SELECT
      id,
      reference_id,
      seq,
      text,
      similarity(text_normalized, ${normalized}) AS sim
    FROM reference_paragraph
    WHERE reference_id = ANY(${referenceIds})
      AND similarity(text_normalized, ${normalized}) > ${minSimilarity}
    ORDER BY sim DESC
    LIMIT ${topK}
  ` as { id: string; reference_id: string; seq: number; text: string; sim: string }[];

  // Step 2: pg_trgm 无结果时降级到 LIKE 子串匹配（兜底短引文嵌入长段落的情况）
  if (rows.length === 0 && normalized.length >= 2) {
    rows = await rawSql`
      SELECT
        id,
        reference_id,
        seq,
        text,
        1.0 AS sim
      FROM reference_paragraph
      WHERE reference_id = ANY(${referenceIds})
        AND text_normalized LIKE '%' || ${normalized} || '%'
      ORDER BY seq ASC
      LIMIT ${topK}
    ` as { id: string; reference_id: string; seq: number; text: string; sim: string }[];
  }

  return rows.map((r) => ({
    referenceId: r.reference_id,
    paragraphId: r.id,
    paragraphSeq: r.seq,
    text: r.text,
    similarity: Number(r.sim),
  }));
}
