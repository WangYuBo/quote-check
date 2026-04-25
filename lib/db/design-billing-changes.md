# 数据库设计：按字数结算计费模型变更

## 改动分析

| 现状 | 变更 |
|------|------|
| 用户结算走 `api_call` 聚合计费 | 用户结算走字数公式 `ceil(charCount/1000) × 300` |
| `api_call` 是用户结算数据源 | `api_call` 仅用于内部成本监控（cost-guard） |
| `task.costActualFen` 由 `recordApiCall` 累加填 | `task.costActualFen` 由字数公式填，`api_call` 累加仅内部参考 |

## 无需变更（已对齐）

| 表/列 | 原因 |
|-------|------|
| `manuscript.char_count` | 已有，用户结算输入 |
| `task.cost_estimated_fen` | 已有，预估费用 |
| `task.cost_actual_fen` | 已有，实算费用 |
| `task.cost_ceiling_cents` | 已有，成本上限（cost-guard 用） |
| `api_call` 表 | 已有，保留用于内部成本监控 |

## schema.ts 类型变更（共 2 处）

### 1. task.versionStamp（L328-336）

改前：
```typescript
versionStamp: jsonb('version_stamp').$type<{
  modelId: string;
  modelProvider: string;
  promptVersions: { extract: string; verify: string; map: string };
  sourceRefsHash: string;
  confidenceAlgoVersion: string;
  pricingVersion: string;      // ← 旧：token 费率版本
  frozenAt: string;
}>(),
```

改后：
```typescript
versionStamp: jsonb('version_stamp').$type<{
  modelId: string;
  modelProvider: string;
  promptVersions: { extract: string; verify: string; map: string };
  sourceRefsHash: string;
  confidenceAlgoVersion: string;
  userPricingVersion: string;  // ← 新：用户结算费率版本
  frozenAt: string;
}>(),
```

### 2. reportSnapshot.versionStampJson（L458-466）

改前：
```typescript
versionStampJson: jsonb('version_stamp_json').$type<{
  modelId: string;
  modelProvider: string;
  promptVersions: { extract: string; verify: string; map: string };
  sourceRefsHash: string;
  confidenceAlgoVersion: string;
  pricingVersion: string;      // ← 旧
}>(),
```

改后：
```typescript
versionStampJson: jsonb('version_stamp_json').$type<{
  modelId: string;
  modelProvider: string;
  promptVersions: { extract: string; verify: string; map: string };
  sourceRefsHash: string;
  confidenceAlgoVersion: string;
  userPricingVersion: string;  // ← 新
}>(),
```

### 3. api_call 表注释更新（L547-569）

改前注释：
```typescript
export const apiCall = pgTable(
  'api_call',
  {
    // ...
    costFen: integer('cost_fen').notNull(),  // 单次成本（分）
  },
```

改后注释：
```typescript
export const apiCall = pgTable(
  'api_call',
  { /* 内部成本监控（cost-guard），非用户结算数据源 */
    // ...
    costFen: integer('cost_fen').notNull(),  // 内部成本（分），仅 cost-guard 用
  },
```

## 迁移评估

JSONB 列在 PostgreSQL 层面无 schema 约束——`pricingVersion` → `userPricingVersion` 是纯 TypeScript 类型重命名，**不需要 SQL migration**。

- `0003_slippery_albert_cleary.sql` 已创建 `api_call` 表 ✅
- 无新增 DDL 需求
- 旧数据的 `versionStamp` jsonb 中若含 `pricingVersion` 键，TS 类型变化不影响运行时读取（Zod 可兼容）

## 查询范式更新

| 查询 | 改前 | 改后 |
|------|------|------|
| 账户月度汇总 | `SUM(api_call.cost_fen) WHERE user_id=?` | `SUM(task.cost_actual_fen) WHERE user_id=?` |
| 任务用户费用 | `SUM(api_call.cost_fen) WHERE task_id=?` | `computeUserCostFen(task.manuscript.charCount)` |
| cost-guard 费用检查 | `task.cost_actual_cents` | 不变（仍读 `cost_actual_fen`） |

## 索引覆盖验证

- 账户月度汇总：`idx_task_user_status(user_id, status, created_at)` 覆盖 ✅
- 任务详情：`task.id` PK 覆盖 ✅
- 无新索引需求
