/**
 * 成本计算（MAS-4）
 *
 * 单位：中文 **分**（fen = ¥0.01）作为整数存储（DB 列 cost_*_cents = fen）
 *
 * SiliconFlow DeepSeek-V3 公开定价（2026-04）：
 *   输入：¥4 / 1M tokens → 0.0004 分/token
 *   输出：¥8 / 1M tokens → 0.0008 分/token
 *
 * 验证一条引文约消耗：1200 输入 + 600 输出 ≈ 0.48+0.48 = 0.96 分 ≈ 1 分
 * 抽取阶段：约 2000 输入 + 800 输出 ≈ 0.80+0.64 = 1.44 分（全局一次）
 */

export const COST_INPUT_FEN_PER_TOKEN = 0.0004; // ¥4/M tokens in 分
export const COST_OUTPUT_FEN_PER_TOKEN = 0.0008; // ¥8/M tokens in 分

/** 默认单任务费用上限（分）：5000 分 = ¥50 */
export const DEFAULT_COST_CEILING_FEN = 5000;

/** 超出预估的倍数阈值：实际费用 > 预估 × 1.5 → 暂停 */
export const COST_GUARD_MULTIPLIER = 1.5;

/** 需要二次确认的阈值（分）：300 分 = ¥3（低阈值便于测试触发） */
export const COST_CONFIRM_THRESHOLD_FEN = 300;

/**
 * 根据实际 token 用量计算费用（分），最小 1 分。
 */
export function computeCostFen(promptTokens: number, completionTokens: number): number {
  return Math.max(
    1,
    Math.round(
      promptTokens * COST_INPUT_FEN_PER_TOKEN + completionTokens * COST_OUTPUT_FEN_PER_TOKEN,
    ),
  );
}

/**
 * 根据书稿字符数预估费用。
 * 粗估密度：1 条引文 / 300 字，每条引文约消耗 1 分，抽取阶段约 2 分。
 */
export function estimateCostFen(charCount: number): {
  quoteCountEstimate: number;
  estimatedFen: number;
  errorMarginPct: number;
} {
  const quoteCountEstimate = Math.max(1, Math.round(charCount / 300));
  const estimatedFen = Math.ceil(quoteCountEstimate * 1 + 2); // 1 分/条 + 2 分 extract
  return { quoteCountEstimate, estimatedFen, errorMarginPct: 30 };
}

/** 将分（fen）格式化为人民币显示（如 "¥3.00"） */
export function formatFenAsYuan(fen: number): string {
  return `¥${(fen / 100).toFixed(2)}`;
}
