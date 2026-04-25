/**
 * 成本计算（MAS-4）—— 向后兼容 re-export，新代码请从 @/lib/billing/pricing 导入
 *
 * TODO(v1.1): 移除本文件，更新所有 import 为 @/lib/billing/pricing
 * ADR-017: _cents 字段将在 v1.1 rename 为 _fen
 * ADR-018: 费率常量已迁移至 lib/billing/pricing.ts
 */

export {
  USER_PRICING_VERSION,
  USER_PRICE_FEN_PER_K_CHAR,
  INTERNAL_PRICING_VERSION,
  INTERNAL_PRICING,
  computeInternalCostFen,
  computeCostFen,
  PRICING_VERSION,
  estimateCostFen,
  formatFenAsYuan,
  DEFAULT_COST_CEILING_FEN,
  COST_CONFIRM_THRESHOLD_FEN,
} from '@/lib/billing/pricing';

export { computeUserCostFen } from '@/lib/billing/user-pricing';
