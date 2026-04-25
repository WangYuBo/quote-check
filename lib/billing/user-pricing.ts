/**
 * 用户结算：按字数计费（A23 / ¥3/千字）
 *
 * 用户费用 = ceil(书稿字数 / 1000) × ¥3/千字
 * 只算书稿字数，不加入参考文献。
 *
 * 双轨制：本文件为用户结算专用，
 * 内部 token 成本监控见 lib/billing/pricing.ts computeInternalCostFen。
 */

import { USER_PRICE_FEN_PER_K_CHAR } from '@/lib/billing/pricing';

/**
 * 计算用户任务费用（分）。
 * 公式：ceil(charCount / 1000) × USER_PRICE_FEN_PER_K_CHAR
 */
export function computeUserCostFen(charCount: number): number {
  return Math.ceil(charCount / 1000) * USER_PRICE_FEN_PER_K_CHAR;
}
