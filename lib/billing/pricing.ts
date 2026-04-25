/**
 * 计费费率常量（SS-9 / ADR-018）
 *
 * 全链路金额单位：分（fen = ¥0.01），DB/API/TS interface 使用 int _fen 命名。
 *
 * 双轨制（用户结算 vs 内部成本监控）：
 * - 用户结算：按书稿字数计费（¥3/千字），精确固定
 * - 内部成本监控：按 token 费率，仅内部 cost-guard 参考，非用户结算数据源
 *
 * 费率版本化原则（ADR-018）：
 * - USER_PRICING_VERSION 任何用户费率变更必同步升版
 * - INTERNAL_PRICING_VERSION 任何 token 费率变更必同步升版
 * - 历史不被追溯重算
 */

// ── 用户结算费率（A23 字数结算） ──────────────────────────────────────
export const USER_PRICING_VERSION = 'v1.0' as const;
/** 用户结算单价：¥3 / 千字（仅书稿字数，不含参考文献） */
export const USER_PRICE_FEN_PER_K_CHAR = 300;

// ── 内部 token 成本监控（非用户结算） ────────────────────────────────
export const INTERNAL_PRICING_VERSION = 'v1.0' as const;

/**
 * SiliconFlow DeepSeek-V3.2 公开定价（2026-04，仅内部成本监控）：
 *   输入：¥0.002 / 1K tokens → 2.0 分 / 1K tokens
 *   输出：¥0.003 / 1K tokens → 3.0 分 / 1K tokens
 */
export const INTERNAL_PRICING = {
  'deepseek-ai/DeepSeek-V3.2': {
    inputFenPerKToken: 2.0,
    outputFenPerKToken: 3.0,
  },
} as const satisfies Record<string, { inputFenPerKToken: number; outputFenPerKToken: number }>;

export type ModelId = keyof typeof INTERNAL_PRICING;

/**
 * 内部 token 成本计算（分），仅用于 cost-guard 内部监控，非用户结算。
 * 费用只信 SDK 返回的 usage.promptTokens / usage.completionTokens。
 */
export function computeInternalCostFen(modelId: string, promptTokens: number, completionTokens: number): number {
  const rate = INTERNAL_PRICING[modelId as ModelId];
  if (!rate) {
    throw new Error(`unknown model pricing: ${modelId}`);
  }
  return Math.max(
    1,
    Math.round(
      (promptTokens * rate.inputFenPerKToken + completionTokens * rate.outputFenPerKToken) / 1000,
    ),
  );
}

// ── 后向兼容别名（v1.0 阶段逐步迁移，v1.1 移除） ─────────────────────
/** @deprecated 改用 computeInternalCostFen */
export const computeCostFen = computeInternalCostFen;
/** @deprecated 改用 INTERNAL_PRICING_VERSION */
export const PRICING_VERSION = INTERNAL_PRICING_VERSION;

/**
 * 按书稿字数预估用户费用（A03 / MAS-4）。
 * 用户结算公式：ceil(书稿字数 / 1000) × ¥3/千字，精确固定。
 */
export function estimateCostFen(charCount: number): {
  estimatedFen: number;
} {
  const estimatedFen = Math.ceil(charCount / 1000) * USER_PRICE_FEN_PER_K_CHAR;
  return { estimatedFen };
}

/** 默认单任务费用上限（分）：5000 分 = ¥50 */
export const DEFAULT_COST_CEILING_FEN = 5000;

/** 需要二次确认的阈值（分）：300 分 = ¥3 */
export const COST_CONFIRM_THRESHOLD_FEN = 300;

/** 将分（fen）格式化为人民币显示（如 "¥3.00"） */
export function formatFenAsYuan(fen: number): string {
  return `¥${(fen / 100).toFixed(2)}`;
}
