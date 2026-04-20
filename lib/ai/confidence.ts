/**
 * 客观置信度三信号融合
 *
 * spec-system-architecture ADR-007 · real.md #2（置信度不得由 AI 自评）
 *
 * 设计要点：
 *   - LLM 返回的任何 "confidence" / "score" / "certainty" 字段必须被**丢弃**
 *   - confidence = w1·refHit + w2·locationValid + w3·crossModel
 *   - v1.0 配置：w1=0.5 · w2=0.5 · w3=0（跨模型费用翻倍，v1.1 再开启）
 *   - 算法版本化进 report_snapshot.versionStamp.confidenceAlgoVersion
 *
 * 不做的：
 *   - 不接受 LLM 的置信度声明（哪怕是 0/100 确数）
 *   - 不做"模糊折扣"或"多样性惩罚"（无来源的主观加减）
 */

export const CONFIDENCE_ALGO_VERSION = 'v1.0' as const;
export type ConfidenceAlgoVersion = typeof CONFIDENCE_ALGO_VERSION;

export const CONFIDENCE_WEIGHTS = {
  refHit: 0.5,
  locationValid: 0.5,
  crossModel: 0,
} as const;

export interface ConfidenceSignals {
  /** 引文与参考文献的归一化相似度 ∈ [0,1]；未命中=0；等值完全命中=1 */
  refHit: number;
  /** 返回定位（书名/章节/段落）是否真实存在于参考元数据 ∈ {0,1} */
  locationValid: 0 | 1;
  /** 跨模型一致性 ∈ [0,1]；v1.0 一律填 0（权重=0，不参与） */
  crossModel: number;
}

export interface ConfidenceResult {
  value: number;
  signals: ConfidenceSignals;
  weights: typeof CONFIDENCE_WEIGHTS;
  algoVersion: ConfidenceAlgoVersion;
}

/**
 * 三信号线性加权
 * 任何落在 [0,1] 之外的输入将被 clamp，越界不抛错但会记 warn（通过调用方日志）
 */
export function computeConfidence(signals: ConfidenceSignals): ConfidenceResult {
  const refHit = clamp01(signals.refHit);
  const locationValid = signals.locationValid === 1 ? 1 : 0;
  const crossModel = clamp01(signals.crossModel);

  const value =
    CONFIDENCE_WEIGHTS.refHit * refHit +
    CONFIDENCE_WEIGHTS.locationValid * locationValid +
    CONFIDENCE_WEIGHTS.crossModel * crossModel;

  return {
    value: round4(value),
    signals: { refHit, locationValid, crossModel },
    weights: CONFIDENCE_WEIGHTS,
    algoVersion: CONFIDENCE_ALGO_VERSION,
  };
}

/**
 * 严格剥离 LLM 自评：任何 confidence/score/certainty 字段一律丢弃
 * 用于 verify/map step 拿到原始 JSON 后的"清洗步骤"
 */
export function stripLlmSelfScores<T extends Record<string, unknown>>(raw: T): T {
  const BLOCKED = new Set(['confidence', 'score', 'certainty', 'probability']);
  const out = {} as Record<string, unknown>;
  for (const [k, v] of Object.entries(raw)) {
    if (BLOCKED.has(k.toLowerCase())) continue;
    out[k] = v;
  }
  return out as T;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
