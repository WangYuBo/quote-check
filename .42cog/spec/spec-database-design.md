---
name: spec-database-design
description: 文史类引用校对软件 v1.0 数据库设计规约——按 cog.md 7 实体 + real.md 7 约束，落为 Neon Postgres + Drizzle ORM 的完整 schema、索引、PG 触发器、Zod 校验与 Neon 分支迁移工作流
version: v1.0.0-draft
generated_by: dev-database-design skill
depends_on:
  - .42cog/cog/cog.md
  - .42cog/real/real.md
  - .42cog/spec/spec-system-architecture.md
  - .42cog/spec/spec-user-story.md
  - notes/260417-engineering-and-ethics-notes.md
stack_lock:
  database: PostgreSQL (Neon serverless)
  orm: Drizzle ORM + drizzle-kit
  driver_default: drizzle-orm/neon-http
  driver_transaction: drizzle-orm/neon-serverless (WebSocket)
  validator: Zod 3.x
  auth_tables_source: Better Auth (official generator)
created: 2026-04-18
---

# 数据库设计规约（Database Design）

## 0. 读法

- **上游**：`cog.md`（7 实体 + 关系矩阵）+ `real.md`（7 约束）+ `spec-system-architecture.md`（§4 子系统、§8 ADR-003/006/011/012/013）
- **本规约**：把 7 核心实体 + 4 辅助表 + 3 Better Auth 表 落为 **可直接 copy 的 Drizzle schema** + **独立 SQL 触发器迁移** + **Zod 校验层**
- **下游**：`dev-coding` 起脚手架后，把 §4.1 代码整段放入 `lib/db/schema.ts`；把 §5 SQL 放入 `lib/db/migrations/0001_triggers.sql`
- **与架构规约的分工**：架构规约决定 *有哪些表 / 如何冻结版本*（ADR 级），本规约决定 *每个列的类型 / 索引 / 触发器 SQL*（可执行级）

---

## 1. Context：为什么先写规约而非直接出 schema.ts

`SKILL.md` 默认主交付 = `schema.ts`。本项目选择**先出规约**：

1. **脚手架未起**：`bun create next-app` 尚未执行，单独存 `schema.ts` 的目录不存在——交付孤儿文件有害无益
2. **只追加原则适配**：`milestones.md` 已预登记 `spec-database-design.md` 为待交付物；按约定落地
3. **schema.ts 作为规约的第一级章节**：§4.1 整段代码块可无损抽出，`dev-coding` 起项目时 `mkdir -p lib/db && pbpaste > lib/db/schema.ts`（或等价方式）直接用
4. **触发器、索引、迁移命令、Zod 校验、查询范式**一体化呈现，避免散落多个文件导致演进不同步

---

## 2. ER 图（7 核心 + 4 辅助 + 3 Better Auth）

```
                                 ┌──────────────────┐
                                 │      user        │◄──────────────────┐
                                 │ (Better Auth ext)│                   │
                                 └────────┬─────────┘                   │
                                          │ 1:N                         │
           ┌──────────────────────────────┼───────────────────────┐     │
           │                              │                       │     │
           ▼                              ▼                       ▼     │
    ┌────────────┐               ┌────────────┐          ┌────────────┐ │
    │ manuscript │               │ reference  │          │ user_agree │ │
    └─────┬──────┘               └──────┬─────┘          │ _accept    │ │
          │ 1:N                         │ N:M (via       └────────────┘ │
          ▼                             │   task.ref_ids[])             │
    ┌────────────┐                      │                               │
    │ paragraph  │                      │                               │
    └─────┬──────┘                      │                               │
          │ 1:N                         │                               │
          ▼                             │                               │
    ┌────────────┐      1:N       ┌─────▼──────┐                        │
    │   quote    │◄───────────────┤    task    ├─────────┐              │
    └─────┬──────┘                └──┬───────┬─┘         │              │
          │ 1:N                      │ 1:N   │ 1:1       │              │
          │                          ▼       ▼           ▼              │
          │              ┌──────────────┐  ┌───────────────┐            │
          └─────────────►│ verification │  │ report_       │            │
                  1:N    │ _result      │  │  snapshot     │            │
                         └──────┬───────┘  │ (frozen)      │            │
                                │ 1:N      └───────────────┘            │
                                ▼                                       │
                      ┌──────────────────┐                              │
                      │ result_reference │ ◄── reference (N:M)          │
                      │  _hit (PARTIAL)  │                              │
                      └──────────────────┘                              │
                                                                        │
                         ┌────────────┐                                 │
                         │ audit_log  │─────────────────────────────────┘
                         └────────────┘                                  (user_id 仅弱 FK)

                     ┌───────────────────┐
                     │ prompt_version    │  (静态登记；冻结 SHA256)
                     │  (ADR-012)        │
                     └───────────────────┘
```

**关系对照 cog.md §rel**：

| cog.md 描述 | 本 schema 实现 | 备注 |
|------------|--------------|------|
| 用户-书稿 1:N | `manuscript.user_id → user.id` | — |
| 用户-参考文献 N:M | `reference.user_id → user.id` + `is_public` 标志 | v1.0 仅私有；共享留字段 |
| 书稿-校对任务 1:N | `task.manuscript_id → manuscript.id` | — |
| 书稿-段落 1:N | `paragraph.manuscript_id → manuscript.id` | — |
| 段落-引文 1:N | `quote.paragraph_id → paragraph.id` | — |
| 书稿-参考文献 N:M | `task.reference_ids uuid[]` + GIN 索引 | 反范式——见 §4.3 决策 |
| 引文-参考文献 N:M | `result_reference_hit (result_id, reference_id)` | ADR-011 |
| 校对任务-校对结果 1:N | `verification_result.task_id → task.id` | — |
| 引文-校对结果 1:N | `verification_result.quote_id → quote.id` | — |
| 参考文献-校对结果 1:N | 通过 `result_reference_hit` 间接 N:M | — |

---

## 3. 命名与类型约定

### 3.1 命名

| 对象 | 规范 | 示例 |
|------|------|------|
| 表名 | snake_case **单数**（与架构规约 §7 §8.3 ADR-003 一致） | `user`, `manuscript`, `verification_result` |
| 列名 | snake_case | `user_id`, `created_at`, `ttl_expires_at` |
| 主键 | `id` | `id uuid primary key` |
| 外键 | `{referenced_table}_id` | `user_id`, `manuscript_id` |
| 索引 | `idx_{table}_{col}[_{col2}]` | `idx_task_user_status` |
| 唯一索引 | `uniq_{table}_{col}` | `uniq_user_email` |
| 触发器 | `trg_{table}_{verb}` | `trg_report_snapshot_freeze` |
| 枚举 | `{table}_{col}_enum` | `task_status_enum` |

**TS 侧映射**：DB 列 snake_case；TS 字段 camelCase；Drizzle 自动映射（`userId: uuid('user_id')`）。

### 3.2 主键策略

| 暴露面 | 策略 | 表 |
|--------|------|---|
| 外部 API 可见 | **UUID**（`defaultRandom()`，防枚举） | `user`, `manuscript`, `paragraph`, `quote`, `reference`, `task`, `verification_result`, `report_snapshot` |
| 纯内部 | **serial**（性能优先） | `result_reference_hit`, `audit_log` |
| 天然唯一 key | **varchar 直作 PK** | `prompt_version`（如 `v1-extract`）|

### 3.3 时间戳

**全部使用 `timestamp with time zone`**（`timestamptz`）。原因：Neon 默认 UTC，但 Vercel 函数可能跑在不同 region；带 tz 是防御性选择。

Drizzle 写法：
```typescript
createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
```

### 3.4 标准列模板

所有业务表都带：
```typescript
createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
```

**例外**（不加 `updated_at`）：
- `report_snapshot`（冻结后不可修改 —— ADR-006）
- `audit_log`（append-only）
- `result_reference_hit`（内部联接，整行替换）

### 3.5 JSONB 使用边界

| 用 JSONB | 不用 JSONB |
|---------|-----------|
| 结构随 prompt 演进的字段（三维度 verdict） | 需要 WHERE/JOIN 过滤的业务字段 |
| 一次写入整体读出，无部分查询 | 按字段排序的列表 |
| 版本戳（一起冻结） | 状态 / 费用 / 类型（提列为常规字段） |

具体清单见 §4。

---

## 4. Drizzle Schema（lib/db/schema.ts）

> **使用说明**：本节 §4.1 的完整代码可整段 copy 到 `lib/db/schema.ts`。§4.2 `enum` 文件独立；§4.3 是设计选择说明。

### 4.1 完整 schema.ts

```typescript
/**
 * lib/db/schema.ts
 *
 * Drizzle schema for quote-check v1.0
 * - 7 核心实体（cog.md）
 * - 4 辅助表（result_reference_hit / report_snapshot / audit_log / user_agreement_acceptance）
 * - 3 Better Auth 表（session / account / verification）
 * - 1 版本登记表（prompt_version，ADR-012）
 *
 * 依赖：drizzle-orm, drizzle-orm/pg-core
 */
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  jsonb,
  integer,
  serial,
  numeric,
  bigint,
  index,
  uniqueIndex,
  primaryKey,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

/* ─────────────────────────────────────────────────
 * Enums
 * ───────────────────────────────────────────────── */

/**
 * Enum 策略（2026-04-19 修订——回应盲区 D3）：
 *   - **低演进概率 → 用 pgEnum**（DB 强约束，演进需 ALTER TYPE ADD VALUE，成本可控）
 *     user_role / reference_role / quote_kind / match_status
 *   - **高演进概率 → 用 varchar + CHECK 约束 + Zod 运行时校验**（加值只需改 CHECK + Zod）
 *     task_status（prompt 迭代 / 新状态机分支 / Inngest 失败分类等概率最高）
 *   - **纯 jsonb 内字段 → 不落 DB enum**（由 Zod 在 §8.3 独家守护；DB 列不存该字段）
 *     text_accuracy / interpret_accuracy / context_accuracy（见 §4.3 D-03 更新）
 */

// 用户角色（cog.md §用户 四类 → v1.0 合并为 3 角色；稳定 enum）
export const userRoleEnum = pgEnum('user_role_enum', ['B', 'C', 'admin']);

// 参考文献权威度（cog.md §参考文献 分类；稳定 enum）
export const referenceRoleEnum = pgEnum('reference_role_enum', [
  'CANON',      // 原典
  'ANNOTATED',  // 注本
  'TRANSLATED', // 现代译本
  'TOOL',       // 工具书
  'OTHER',
]);

// 引文分类（cog.md §引文 三类；稳定 enum）
export const quoteKindEnum = pgEnum('quote_kind_enum', [
  'DIRECT',   // 直接引用（带引号）
  'INDIRECT', // 间接引用（化用）
  'NOTED',    // 标注引用（带脚注）
]);

// 参考匹配三态（产品规约 A07 + 架构规约 ADR-011；稳定 enum）
export const matchStatusEnum = pgEnum('match_status_enum', [
  'MATCH',
  'PARTIAL_MATCH',
  'NOT_MATCH',
  'NOT_FOUND_IN_REF',
]);

/**
 * 任务状态 —— **不**用 pgEnum，改 varchar + CHECK + Zod（盲区 D3 改进）
 * 理由：状态机是系统中最易演进的枚举（新增失败分类、草稿状态、归档状态等）；
 *       ALTER TYPE ADD VALUE 虽能加值但无法删值、无法重排；varchar+CHECK 更宽松。
 * 可接受值（同步维护 §8.2 Zod schema + 触发器 migration 里的 CHECK）：
 *   'PENDING_PARSE' | 'PARSING' | 'PENDING_ESTIMATE' | 'AWAITING_CONFIRM'
 *   | 'VERIFYING' | 'PAUSED_COST' | 'REJECTED_BY_MODERATION'
 *   | 'COMPLETED' | 'FAILED' | 'CANCELED'
 */
export const TASK_STATUS_VALUES = [
  'PENDING_PARSE',
  'PARSING',
  'PENDING_ESTIMATE',
  'AWAITING_CONFIRM',
  'VERIFYING',
  'PAUSED_COST',
  'REJECTED_BY_MODERATION',
  'COMPLETED',
  'FAILED',
  'CANCELED',
] as const;
export type TaskStatus = (typeof TASK_STATUS_VALUES)[number];

// 注：三维度 verdict（text_accuracy / interpret_accuracy / context_accuracy）
//    不落 DB enum 也不落 DB 列——仅存在于 verdict_xxx jsonb 字段内部字符串；
//    枚举约束由 §8.3 Zod schema 承担。好处：prompt 迭代加值无需 DB migration。

/* ─────────────────────────────────────────────────
 * Better Auth 扩展 user 表
 * 说明：Better Auth 会扫描 user/session/account/verification 四表；
 *       我们扩展 user 增加业务字段。
 * ───────────────────────────────────────────────── */

export const user = pgTable(
  'user',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Better Auth 必需字段
    email: varchar('email', { length: 255 }).notNull(),
    emailVerified: boolean('email_verified').default(false).notNull(),
    name: varchar('name', { length: 100 }),
    image: text('image'),
    // 本项目扩展字段
    role: userRoleEnum('role').default('C').notNull(),
    // 协议版本（MS-L-11 / real.md #3）
    agreementVersion: varchar('agreement_version', { length: 32 }),
    agreementAcceptedAt: timestamp('agreement_accepted_at', { withTimezone: true }),
    // 机构信息（B 端）
    organization: varchar('organization', { length: 200 }),
    // 状态
    suspendedAt: timestamp('suspended_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    emailUniq: uniqueIndex('uniq_user_email').on(t.email),
    roleIdx: index('idx_user_role').on(t.role),
  }),
);

/* Better Auth 标准表（3 张，字段按官方 generator 输出对齐） */

export const session = pgTable(
  'session',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    token: varchar('token', { length: 255 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ipAddress: varchar('ip_address', { length: 64 }),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('idx_session_user').on(t.userId),
    tokenUniq: uniqueIndex('uniq_session_token').on(t.token),
    expIdx: index('idx_session_expires').on(t.expiresAt), // 清理过期 session 用
  }),
);

export const account = pgTable(
  'account',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    providerId: varchar('provider_id', { length: 64 }).notNull(), // 'credential' / 'google' / ...
    accountId: varchar('account_id', { length: 255 }).notNull(),
    password: text('password'), // Better Auth 内置 argon2 hash
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('idx_account_user').on(t.userId),
    providerAccountUniq: uniqueIndex('uniq_account_provider_account').on(t.providerId, t.accountId),
  }),
);

export const verification = pgTable(
  'verification',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    identifier: varchar('identifier', { length: 255 }).notNull(), // 邮箱或电话
    value: text('value').notNull(),                               // 验证码/token
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    identifierIdx: index('idx_verification_identifier').on(t.identifier),
    expIdx: index('idx_verification_expires').on(t.expiresAt),
  }),
);

/* ─────────────────────────────────────────────────
 * 核心业务实体（cog.md 7 实体）
 * ───────────────────────────────────────────────── */

/* 书稿：用户上传的待校对文稿 */
export const manuscript = pgTable(
  'manuscript',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    // 展示用业务 id（cog.md §书稿：20260417-001 形态）
    displayId: varchar('display_id', { length: 32 }).notNull(),
    filename: varchar('filename', { length: 512 }).notNull(),
    mimeType: varchar('mime_type', { length: 128 }).notNull(),
    fileSize: bigint('file_size', { mode: 'number' }).notNull(), // 字节
    charCount: integer('char_count'), // 字数（解析后）
    // Vercel Blob
    blobUrl: text('blob_url').notNull(),
    blobPathname: text('blob_pathname').notNull(),
    // 解析状态
    parsedAt: timestamp('parsed_at', { withTimezone: true }),
    parseError: text('parse_error'),
    // TTL（real.md #3）——书稿本身在 task.ttl_expires_at 到期时随 task 一起销毁；
    //   此处记录 destroyedAt 作为"已销毁"标志。
    destroyedAt: timestamp('destroyed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('idx_manuscript_user').on(t.userId, t.createdAt),
    displayIdUniq: uniqueIndex('uniq_manuscript_display_id').on(t.displayId),
    destroyedIdx: index('idx_manuscript_destroyed').on(t.destroyedAt), // TTL 扫描
  }),
);

/* 段落：书稿切分后的上下文单位 */
export const paragraph = pgTable(
  'paragraph',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    manuscriptId: uuid('manuscript_id')
      .notNull()
      .references(() => manuscript.id, { onDelete: 'cascade' }),
    seq: integer('seq').notNull(), // 段落顺序号（从 1 起）
    // cog.md §段落：{task_id}-para-{seq} 形态展示 id
    displayId: varchar('display_id', { length: 48 }).notNull(),
    text: text('text').notNull(),
    textHash: varchar('text_hash', { length: 64 }).notNull(), // sha256，供变更检测
    textNormalized: text('text_normalized'),                  // OpenCC + 异体字规范化后（ADR-014）
    chapter: varchar('chapter', { length: 200 }),             // 章节标题（可空）
    hasQuote: boolean('has_quote').default(false).notNull(),
    hasFootnote: boolean('has_footnote').default(false).notNull(),
    // TTL 销毁标志（书稿销毁时段落一并销毁，但保留引文+结果快照）
    destroyedAt: timestamp('destroyed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    manuscriptSeqIdx: index('idx_paragraph_manuscript_seq').on(t.manuscriptId, t.seq),
    hashIdx: index('idx_paragraph_hash').on(t.textHash),
  }),
);

/* 引文：段落中识别出的单条引用 */
export const quote = pgTable(
  'quote',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    paragraphId: uuid('paragraph_id')
      .notNull()
      .references(() => paragraph.id, { onDelete: 'cascade' }),
    manuscriptId: uuid('manuscript_id') // 冗余存一份 FK，加速跨 quote 的任务级聚合
      .notNull()
      .references(() => manuscript.id, { onDelete: 'cascade' }),
    seq: integer('seq').notNull(),
    displayId: varchar('display_id', { length: 48 }).notNull(),
    // 提取结果
    quoteText: text('quote_text').notNull(),            // 引文原文（不规范化，展示用）
    quoteNormalized: text('quote_normalized'),          // 规范化文本（匹配用，ADR-014）
    kind: quoteKindEnum('kind').notNull(),
    // AI 提取时给出的推测来源（cog.md §引文 的 sourceWork；可空）
    sourceWorkHint: varchar('source_work_hint', { length: 200 }),
    canonicalName: varchar('canonical_name', { length: 200 }), // 经 BOOK_NAME_ALIASES 归一后
    locationHint: text('location_hint'),                       // 如"《论语·学而》"
    // 段落上下文快照（用于后续回滚+审计；TTL 时销毁）
    contextWindow: text('context_window'),
    // 销毁
    destroyedAt: timestamp('destroyed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    paragraphIdx: index('idx_quote_paragraph').on(t.paragraphId),
    manuscriptSeqIdx: index('idx_quote_manuscript_seq').on(t.manuscriptId, t.seq),
    canonicalIdx: index('idx_quote_canonical').on(t.canonicalName),
  }),
);

/* 参考文献 */
export const reference = pgTable(
  'reference',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    // cog.md §参考文献 唯一编码：slug-hash8
    displayId: varchar('display_id', { length: 64 }).notNull(),
    canonicalName: varchar('canonical_name', { length: 200 }).notNull(), // 如 "论语"
    versionLabel: varchar('version_label', { length: 200 }),             // 如 "杨伯峻译注 中华书局 1980"
    role: referenceRoleEnum('role').notNull(),
    // 文件
    filename: varchar('filename', { length: 512 }).notNull(),
    mimeType: varchar('mime_type', { length: 128 }).notNull(),
    fileSize: bigint('file_size', { mode: 'number' }).notNull(),
    charCount: integer('char_count'),
    blobUrl: text('blob_url').notNull(),
    blobPathname: text('blob_pathname').notNull(),
    // 参考文献可长期保留（不进 task TTL）；但用户可删除
    isPublic: boolean('is_public').default(false).notNull(), // v1.0 恒 false；预留字段
    // 版权声明（real.md #5）
    copyrightDeclaredBy: uuid('copyright_declared_by').references(() => user.id),
    copyrightDeclaredAt: timestamp('copyright_declared_at', { withTimezone: true }),
    // 解析状态
    parsedAt: timestamp('parsed_at', { withTimezone: true }),
    parseError: text('parse_error'),
    // 内容哈希（task.version_stamp 里 sourceRefsHash 的构成输入）
    contentHash: varchar('content_hash', { length: 64 }).notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userCanonicalIdx: index('idx_reference_user_canonical').on(t.userId, t.canonicalName),
    displayIdUniq: uniqueIndex('uniq_reference_display_id').on(t.displayId),
    hashIdx: index('idx_reference_content_hash').on(t.contentHash),
  }),
);

/* 校对任务 */
export const task = pgTable(
  'task',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    manuscriptId: uuid('manuscript_id')
      .notNull()
      .references(() => manuscript.id, { onDelete: 'restrict' }),
    displayId: varchar('display_id', { length: 32 }).notNull(), // 20260417-001
    // 参考文献 id 数组（ADR-003 + §4.3 决策）
    referenceIds: uuid('reference_ids').array().notNull().default([]),
    // 状态机（盲区 D3 改进：varchar + CHECK 约束，见 migrations/0001_triggers.sql C-03）
    status: varchar('status', { length: 32 }).default('PENDING_PARSE').notNull().$type<TaskStatus>(),
    // 费用（real.md #6）
    costEstimatedCents: integer('cost_estimated_cents'),  // 人民币分
    costActualCents: integer('cost_actual_cents'),
    costCeilingCents: integer('cost_ceiling_cents'),      // 1.5 倍阈值
    costConfirmedAt: timestamp('cost_confirmed_at', { withTimezone: true }),
    costConfirmedBy: uuid('cost_confirmed_by').references(() => user.id),
    // 进度
    totalQuotes: integer('total_quotes'),
    verifiedQuotes: integer('verified_quotes').default(0).notNull(),
    failedQuotes: integer('failed_quotes').default(0).notNull(),
    // 版本戳（real.md #7 + ADR-006/012；冻结后经触发器防改）
    versionStamp: jsonb('version_stamp').$type<{
      modelId: string;
      modelProvider: string;
      promptVersions: { extract: string; verify: string; map: string }; // SHA256
      sourceRefsHash: string;           // 所有 reference.content_hash 连接后 SHA256
      confidenceAlgoVersion: string;    // "v1.0"
      frozenAt: string;                 // ISO
    }>(),
    versionStampFrozenAt: timestamp('version_stamp_frozen_at', { withTimezone: true }),
    // 审核拒绝（ADR-008）
    moderationRejectedAt: timestamp('moderation_rejected_at', { withTimezone: true }),
    moderationReason: text('moderation_reason'),
    // TTL（real.md #3）
    ttlExpiresAt: timestamp('ttl_expires_at', { withTimezone: true }).notNull(),
    destroyedAt: timestamp('destroyed_at', { withTimezone: true }),
    // Inngest 关联
    inngestRunId: varchar('inngest_run_id', { length: 128 }),
    // 暂停 / 取消
    pausedAt: timestamp('paused_at', { withTimezone: true }),
    canceledAt: timestamp('canceled_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    failedAt: timestamp('failed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userStatusIdx: index('idx_task_user_status').on(t.userId, t.status, t.createdAt),
    manuscriptIdx: index('idx_task_manuscript').on(t.manuscriptId),
    ttlIdx: index('idx_task_ttl').on(t.ttlExpiresAt),                    // Inngest Cron 扫描
    displayIdUniq: uniqueIndex('uniq_task_display_id').on(t.displayId),
    // referenceIds GIN 索引在独立 migration 中创建（drizzle-kit 暂未原生支持数组 GIN）
  }),
);

/* 校对结果（含三维度独立 jsonb） */
export const verificationResult = pgTable(
  'verification_result',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    taskId: uuid('task_id').notNull().references(() => task.id, { onDelete: 'cascade' }),
    quoteId: uuid('quote_id').notNull().references(() => quote.id, { onDelete: 'restrict' }),
    // 聚合态（由 result_reference_hit 计算；冗余存以加速列表查询）
    matchStatus: matchStatusEnum('match_status').notNull(),
    // 三维度判定（cog.md §校对结果；独立 jsonb 而非拍平——演进友好）
    verdictTextAccuracy: jsonb('verdict_text_accuracy').$type<{
      verdict: 'MATCH' | 'VARIANT' | 'MISMATCH' | 'NOT_FOUND_IN_REF';
      explanation: string;
      suggestedCorrection?: string;
      referenceLocation?: { chapter?: string; paragraph?: string; offset?: number };
    }>().notNull(),
    verdictInterpretation: jsonb('verdict_interpretation').$type<{
      verdict: 'CONSISTENT' | 'PARTIAL' | 'DIVERGENT' | 'NOT_APPLICABLE';
      explanation: string;
    }>().notNull(),
    verdictContext: jsonb('verdict_context').$type<{
      verdict: 'APPROPRIATE' | 'AMBIGUOUS' | 'OUT_OF_CONTEXT' | 'NOT_APPLICABLE';
      explanation: string;
    }>().notNull(),
    // 客观置信度（real.md #2 + ADR-007）
    confidence: numeric('confidence', { precision: 4, scale: 3 }).notNull(), // 0.000-1.000
    confidenceBreakdown: jsonb('confidence_breakdown').$type<{
      refHit: number;         // 0-1：检索命中度
      locationValid: number;  // 0-1：定位有效性
      crossModel: number;     // v1.0 恒 0
      weights: { w1: number; w2: number; w3: number };
      algoVersion: string;
    }>().notNull(),
    // 审核拒绝标志（ADR-008）
    moderationStatus: varchar('moderation_status', { length: 32 })
      .default('OK')
      .notNull(), // 'OK' / 'REJECTED_BY_MODERATION' / 'FAILED_UPSTREAM'
    moderationDetail: jsonb('moderation_detail'),
    // 重试追踪（notes #1 + 幂等键）
    attemptCount: integer('attempt_count').default(1).notNull(),
    idempotencyKey: varchar('idempotency_key', { length: 128 }).notNull(), // {taskId}_{quoteId}_{attemptN}
    // API 响应快照（脱敏调试用；TTL 时销毁）
    rawResponseSnapshot: jsonb('raw_response_snapshot'),
    rawResponseDestroyedAt: timestamp('raw_response_destroyed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    // 注：此表不设 updatedAt——一旦写入即为定稿；重试时新插一条
  },
  (t) => ({
    taskIdx: index('idx_result_task').on(t.taskId),
    quoteIdx: index('idx_result_quote').on(t.quoteId),
    taskStatusIdx: index('idx_result_task_status').on(t.taskId, t.matchStatus),
    idempotencyUniq: uniqueIndex('uniq_result_idempotency').on(t.idempotencyKey),
    rawSnapshotIdx: index('idx_result_raw_destroyed').on(t.rawResponseDestroyedAt),
  }),
);

/* ─────────────────────────────────────────────────
 * 辅助表
 * ───────────────────────────────────────────────── */

/* result × reference 联接表（ADR-011：PARTIAL_MATCH 载体） */
export const resultReferenceHit = pgTable(
  'result_reference_hit',
  {
    id: serial('id').primaryKey(), // 纯内部，serial 即可
    resultId: uuid('result_id')
      .notNull()
      .references(() => verificationResult.id, { onDelete: 'cascade' }),
    referenceId: uuid('reference_id')
      .notNull()
      .references(() => reference.id, { onDelete: 'restrict' }),
    hit: boolean('hit').notNull(),
    snippet: text('snippet'),
    locationJson: jsonb('location_json').$type<{
      chapter?: string;
      paragraph?: string;
      offset?: number;
      matchedLength?: number;
    }>(),
    similarity: numeric('similarity', { precision: 4, scale: 3 }), // 0-1
    retrievalMethod: varchar('retrieval_method', { length: 32 }), // 'ngram' / 'exact' / ...
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    resultIdx: index('idx_hit_result').on(t.resultId, t.hit),
    referenceIdx: index('idx_hit_reference').on(t.referenceId),
    // 同一 result+reference 唯一（一个参考对一个结果只产生一条记录）
    uniqPair: uniqueIndex('uniq_hit_result_reference').on(t.resultId, t.referenceId),
  }),
);

/* 报告快照（冻结载体，ADR-006） */
export const reportSnapshot = pgTable(
  'report_snapshot',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    taskId: uuid('task_id').notNull().references(() => task.id, { onDelete: 'restrict' }),
    // 完整冻结三元组（对应 task.versionStamp）
    versionStampJson: jsonb('version_stamp_json').$type<{
      modelId: string;
      modelProvider: string;
      promptVersions: { extract: string; verify: string; map: string };
      sourceRefsHash: string;
      confidenceAlgoVersion: string;
    }>().notNull(),
    // 冻结时所有 result 的聚合数据（离线生成 Word/CSV 用）
    resultsAggregate: jsonb('results_aggregate').$type<{
      totalQuotes: number;
      matchCount: number;
      partialMatchCount: number;
      notMatchCount: number;
      notFoundCount: number;
      rejectedByModerationCount: number;
      meanConfidence: number;
    }>().notNull(),
    // 冻结后不可改（PG 触发器强制）
    frozenAt: timestamp('frozen_at', { withTimezone: true }).notNull(),
    // 不加 updatedAt —— 本表 append-only
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    taskUniq: uniqueIndex('uniq_report_snapshot_task').on(t.taskId),
    frozenIdx: index('idx_report_snapshot_frozen').on(t.frozenAt),
  }),
);

/* 审计日志（B 端合规；不含原文——notes #2） */
export const auditLog = pgTable(
  'audit_log',
  {
    id: serial('id').primaryKey(),
    userId: uuid('user_id').references(() => user.id, { onDelete: 'set null' }),
    // 操作类型：'TASK_CREATED' / 'COST_CONFIRMED' / 'REPORT_EXPORTED' / 'TTL_DESTROYED' / 'AGREEMENT_ACCEPTED' ...
    op: varchar('op', { length: 64 }).notNull(),
    targetType: varchar('target_type', { length: 32 }),  // 'task' / 'manuscript' / ...
    targetId: uuid('target_id'),                         // 弱 FK（无 references——允许目标删除后日志保留）
    // 只记元数据，绝不记原文片段
    metadataJson: jsonb('metadata_json').$type<Record<string, unknown>>(),
    ipAddress: varchar('ip_address', { length: 64 }),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userOpIdx: index('idx_audit_user_op').on(t.userId, t.op, t.createdAt),
    targetIdx: index('idx_audit_target').on(t.targetType, t.targetId),
    createdIdx: index('idx_audit_created').on(t.createdAt), // 按期归档用
  }),
);

/* 协议接受记录（MS-L-11 / real.md #3 / MS-D-06） */
export const userAgreementAcceptance = pgTable(
  'user_agreement_acceptance',
  {
    id: serial('id').primaryKey(),
    userId: uuid('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    agreementVersion: varchar('agreement_version', { length: 32 }).notNull(),
    agreementRole: userRoleEnum('agreement_role').notNull(), // B / C 协议差异
    acceptedAt: timestamp('accepted_at', { withTimezone: true }).defaultNow().notNull(),
    ipAddress: varchar('ip_address', { length: 64 }),
    userAgent: text('user_agent'),
    checksum: varchar('checksum', { length: 64 }).notNull(), // 协议文本 SHA256
  },
  (t) => ({
    userVersionUniq: uniqueIndex('uniq_agreement_user_version').on(t.userId, t.agreementVersion),
    userIdx: index('idx_agreement_user').on(t.userId, t.acceptedAt),
  }),
);

/* Prompt 版本登记（ADR-012） */
export const promptVersion = pgTable(
  'prompt_version',
  {
    key: varchar('key', { length: 64 }).primaryKey(), // 'v1-extract' / 'v1-verify' / 'v1-map'
    name: varchar('name', { length: 64 }).notNull(),
    versionTag: varchar('version_tag', { length: 16 }).notNull(), // 'v1'
    sha256: varchar('sha256', { length: 64 }).notNull(),
    byteSize: integer('byte_size').notNull(),
    // 人读注释
    note: text('note'),
    registeredAt: timestamp('registered_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    sha256Idx: index('idx_prompt_sha256').on(t.sha256),
  }),
);

/* ─────────────────────────────────────────────────
 * Relations（供 Drizzle Query API 使用）
 * ───────────────────────────────────────────────── */

export const userRelations = relations(user, ({ many }) => ({
  manuscripts: many(manuscript),
  references: many(reference),
  tasks: many(task),
  sessions: many(session),
  accounts: many(account),
  agreementAcceptances: many(userAgreementAcceptance),
}));

export const manuscriptRelations = relations(manuscript, ({ one, many }) => ({
  user: one(user, { fields: [manuscript.userId], references: [user.id] }),
  paragraphs: many(paragraph),
  quotes: many(quote),
  tasks: many(task),
}));

export const paragraphRelations = relations(paragraph, ({ one, many }) => ({
  manuscript: one(manuscript, {
    fields: [paragraph.manuscriptId],
    references: [manuscript.id],
  }),
  quotes: many(quote),
}));

export const quoteRelations = relations(quote, ({ one, many }) => ({
  paragraph: one(paragraph, { fields: [quote.paragraphId], references: [paragraph.id] }),
  manuscript: one(manuscript, { fields: [quote.manuscriptId], references: [manuscript.id] }),
  verificationResults: many(verificationResult),
}));

export const referenceRelations = relations(reference, ({ one, many }) => ({
  user: one(user, { fields: [reference.userId], references: [user.id] }),
  hits: many(resultReferenceHit),
}));

export const taskRelations = relations(task, ({ one, many }) => ({
  user: one(user, { fields: [task.userId], references: [user.id] }),
  manuscript: one(manuscript, { fields: [task.manuscriptId], references: [manuscript.id] }),
  results: many(verificationResult),
  snapshot: one(reportSnapshot, {
    fields: [task.id],
    references: [reportSnapshot.taskId],
  }),
}));

export const verificationResultRelations = relations(verificationResult, ({ one, many }) => ({
  task: one(task, { fields: [verificationResult.taskId], references: [task.id] }),
  quote: one(quote, { fields: [verificationResult.quoteId], references: [quote.id] }),
  hits: many(resultReferenceHit),
}));

export const resultReferenceHitRelations = relations(resultReferenceHit, ({ one }) => ({
  result: one(verificationResult, {
    fields: [resultReferenceHit.resultId],
    references: [verificationResult.id],
  }),
  reference: one(reference, {
    fields: [resultReferenceHit.referenceId],
    references: [reference.id],
  }),
}));

export const reportSnapshotRelations = relations(reportSnapshot, ({ one }) => ({
  task: one(task, { fields: [reportSnapshot.taskId], references: [task.id] }),
}));
```

### 4.2 类型导出（lib/db/types.ts）

```typescript
import { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import {
  user,
  manuscript,
  paragraph,
  quote,
  reference,
  task,
  verificationResult,
  resultReferenceHit,
  reportSnapshot,
  auditLog,
  userAgreementAcceptance,
  promptVersion,
} from './schema';

export type User = InferSelectModel<typeof user>;
export type NewUser = InferInsertModel<typeof user>;

export type Manuscript = InferSelectModel<typeof manuscript>;
export type NewManuscript = InferInsertModel<typeof manuscript>;

export type Paragraph = InferSelectModel<typeof paragraph>;
export type NewParagraph = InferInsertModel<typeof paragraph>;

export type Quote = InferSelectModel<typeof quote>;
export type NewQuote = InferInsertModel<typeof quote>;

export type Reference = InferSelectModel<typeof reference>;
export type NewReference = InferInsertModel<typeof reference>;

export type Task = InferSelectModel<typeof task>;
export type NewTask = InferInsertModel<typeof task>;

export type VerificationResult = InferSelectModel<typeof verificationResult>;
export type NewVerificationResult = InferInsertModel<typeof verificationResult>;

export type ResultReferenceHit = InferSelectModel<typeof resultReferenceHit>;
export type NewResultReferenceHit = InferInsertModel<typeof resultReferenceHit>;

export type ReportSnapshot = InferSelectModel<typeof reportSnapshot>;
export type NewReportSnapshot = InferInsertModel<typeof reportSnapshot>;

export type AuditLog = InferSelectModel<typeof auditLog>;
export type NewAuditLog = InferInsertModel<typeof auditLog>;

export type UserAgreementAcceptance = InferSelectModel<typeof userAgreementAcceptance>;
export type NewUserAgreementAcceptance = InferInsertModel<typeof userAgreementAcceptance>;

export type PromptVersion = InferSelectModel<typeof promptVersion>;
export type NewPromptVersion = InferInsertModel<typeof promptVersion>;
```

### 4.3 关键设计决策（补架构规约未细化部分）

| # | 决策点 | 选择 | 理由 | 对应 ADR |
|---|-------|------|-----|---------|
| D-01 | `task.reference_ids` 用数组还是联接表 | **`uuid[]` + GIN** | 架构规约 ADR-003 定调；参考文献挂靠任务无额外元数据；GIN 索引支持 `@>` 查询 | ADR-003 |
| D-02 | 三维度 verdict 用三个 `jsonb` 还是拍平为多个列 | **三个 jsonb** | 演进友好——prompt 迭代时字段变化不触发 schema migration；一次读出，无字段级查询需求 | ADR-005 |
| D-03 | 三维度枚举是否落 DB enum | ~~落 enum~~ → **不落 DB enum**（2026-04-19 修订，回应盲区 D3）；三维度 verdict 只存在于 jsonb 字段内部字符串，由 §8.3 Zod 守护；prompt 演进加值无需 DB migration | 用 pgEnum 会导致 prompt 迭代成本过高（`ALTER TYPE ADD VALUE` + 不可删值）；用 varchar+CHECK 也没必要（jsonb 内字符串不落列）；Zod 运行时校验足够 | D3 改进 |
| D-03a | `task.status` 是否落 DB enum | **不落**（varchar + CHECK + Zod）；2026-04-19 从 pgEnum 改造 | 状态机是演进最频繁的枚举（新增失败分类、草稿、归档等），CHECK 约束 + 应用层 Zod 比 pgEnum 更宽松且明确可控 | D3 改进 |
| D-04 | `result_reference_hit` 主键 | **serial**（内部联接，不对外） | SKILL 指引：纯内部表 serial 优先；外部操作走 `result_id` + `reference_id` | — |
| D-05 | `paragraph.text_normalized` 是否落库 | **落** | 避免每次查询重算 OpenCC；代价是磁盘翻倍——书稿 20MB → 40MB 可接受 | ADR-014 |
| D-06 | `quote.manuscript_id` 冗余 FK | **冗余** | 加速"任务下按引文聚合"查询（避免 3 级 join：task → verification_result → quote → paragraph → manuscript） | — |
| D-07 | 是否删除策略 | **软删除**（`deleted_at` / `destroyed_at`）与**硬删除**（`onDelete: 'cascade'`）混用 | TTL 销毁用软删除保留元数据；user 注销用 cascade 清理辅助数据 | ADR-013 |
| D-08 | `audit_log.target_id` 是否加 references | **不加**（弱 FK） | 审计要在目标删除后仍可追溯 | notes #6 |
| D-09 | `verification_result.idempotency_key` 是否唯一 | **唯一** | 幂等性硬保障（notes #4）；重试时上游检测 conflict 即视为已写 | ADR-002 |
| D-10 | `prompt_version.key` 是否用自增 id | **用 varchar 作 PK**（`v1-extract` 等） | 业务可读；版本戳直接引用，无需 join | ADR-012 |
| D-11 | `reference.is_public` 字段 | **保留但 v1.0 恒 false** | cog.md 声明 N:M；v1.0 仅私有；预留字段免后期 schema migration | cog.md §rel |
| D-12 | Better Auth 表命名 | **单数**（`user`, `session`, `account`, `verification`）与业务表一致 | Better Auth 官方默认；与本 schema 单数约定吻合 | — |

---

## 5. PG 触发器（lib/db/migrations/0001_triggers.sql）

> Drizzle Kit 暂不原生支持触发器 DDL，用独立 SQL 迁移管理。执行顺序：drizzle-kit 生成的 `0000_init.sql` → 本 `0001_triggers.sql`。

```sql
-- lib/db/migrations/0001_triggers.sql
-- 版本戳只读 + 报告冻结 + GIN 索引 + 物化约束

-- ─────────────────────────────────────────────
-- T-01: report_snapshot 冻结后不可 UPDATE/DELETE
--   实现 ADR-006 双层保障中的"DB 层"
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION prevent_frozen_report_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.frozen_at IS NOT NULL THEN
    RAISE EXCEPTION 'report_snapshot is frozen at % and cannot be modified (real.md #7)',
      OLD.frozen_at
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL; -- for DELETE; ignored for UPDATE
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_report_snapshot_freeze
BEFORE UPDATE OR DELETE ON report_snapshot
FOR EACH ROW
EXECUTE FUNCTION prevent_frozen_report_mutation();

-- ─────────────────────────────────────────────
-- T-02: task.version_stamp 一旦冻结（version_stamp_frozen_at IS NOT NULL）
--   就禁止 version_stamp / promptVersions / sourceRefsHash 字段修改
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION prevent_version_stamp_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.version_stamp_frozen_at IS NOT NULL THEN
    IF OLD.version_stamp IS DISTINCT FROM NEW.version_stamp THEN
      RAISE EXCEPTION 'task.version_stamp is frozen at % and cannot be modified (real.md #7)',
        OLD.version_stamp_frozen_at
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_task_version_stamp_freeze
BEFORE UPDATE ON task
FOR EACH ROW
EXECUTE FUNCTION prevent_version_stamp_mutation();

-- ─────────────────────────────────────────────
-- T-03: verification_result 写入后不可修改
--   设计上重试即 insert 新行（idempotency_key 不同），不走 update
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION prevent_result_mutation()
RETURNS TRIGGER AS $$
BEGIN
  -- 仅允许更新 raw_response_snapshot → NULL（TTL 销毁用）与 raw_response_destroyed_at
  IF OLD.verdict_text_accuracy IS DISTINCT FROM NEW.verdict_text_accuracy
     OR OLD.verdict_interpretation IS DISTINCT FROM NEW.verdict_interpretation
     OR OLD.verdict_context IS DISTINCT FROM NEW.verdict_context
     OR OLD.confidence IS DISTINCT FROM NEW.confidence
     OR OLD.match_status IS DISTINCT FROM NEW.match_status THEN
    RAISE EXCEPTION 'verification_result core fields are immutable (notes #7)'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_verification_result_immutable
BEFORE UPDATE ON verification_result
FOR EACH ROW
EXECUTE FUNCTION prevent_result_mutation();

-- ─────────────────────────────────────────────
-- T-04: audit_log append-only
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only (notes #6)'
    USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_log_append_only
BEFORE UPDATE OR DELETE ON audit_log
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_log_mutation();

-- ─────────────────────────────────────────────
-- T-05: user_agreement_acceptance append-only
-- ─────────────────────────────────────────────
CREATE TRIGGER trg_agreement_append_only
BEFORE UPDATE OR DELETE ON user_agreement_acceptance
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_log_mutation();  -- 复用函数

-- ─────────────────────────────────────────────
-- T-06: prompt_version 一旦登记不可修改（ADR-012）
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION prevent_prompt_version_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'prompt_version is immutable once registered; create a new version key instead (real.md #7 + ADR-012)'
    USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prompt_version_immutable
BEFORE UPDATE OR DELETE ON prompt_version
FOR EACH ROW
EXECUTE FUNCTION prevent_prompt_version_mutation();

-- ─────────────────────────────────────────────
-- I-01: task.reference_ids GIN 索引
--   drizzle-kit 暂无原生语法，手写
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_task_reference_ids_gin
  ON task USING GIN (reference_ids);

-- ─────────────────────────────────────────────
-- I-02: paragraph / quote 文本全文搜索索引（简体 + trigram 兼容中文）
--   说明：PostgreSQL 默认 GIN tsvector 对中文分词不友好；
--         这里用 trigram 做近似检索（辅助 n-gram 匹配）。需先启用扩展。
-- ─────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_paragraph_text_trgm
  ON paragraph USING GIN (text_normalized gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_quote_normalized_trgm
  ON quote USING GIN (quote_normalized gin_trgm_ops);

-- ─────────────────────────────────────────────
-- C-01: 物化约束——task.cost_actual_cents 不可超过 cost_ceiling_cents × 1.5
--   real.md #6 的 DB 级兜底（应用层也检查）
-- ─────────────────────────────────────────────
-- 不做 CHECK 约束（因为超额时要 PAUSE 而非 abort 写入）；
-- 此约束在应用层（Inngest cost-guard 函数）完成。

-- ─────────────────────────────────────────────
-- C-02: match_status 与 verdict_text_accuracy.verdict 互斥约束
--   如 match_status='NOT_FOUND_IN_REF'，verdict_text_accuracy.verdict 必须也是 'NOT_FOUND_IN_REF'
--   本约束在应用层（Zod + Drizzle insert 前）完成；DB 不做 CHECK（jsonb 字段提取成本）。

-- ─────────────────────────────────────────────
-- C-03: task.status 可接受值（盲区 D3 改进——替代 pgEnum 的 DB 层约束）
--   值域与 lib/db/schema.ts 中 TASK_STATUS_VALUES 常量同源；
--   加新状态时：(a) 更新 schema.ts 常量，(b) 更新此 CHECK，(c) 更新 §8.2 Zod schema。
--   **新增流程**：三处同步；比 pgEnum ALTER TYPE ADD VALUE 更明确可控。
-- ─────────────────────────────────────────────
ALTER TABLE task
  ADD CONSTRAINT chk_task_status_allowed
  CHECK (status IN (
    'PENDING_PARSE', 'PARSING', 'PENDING_ESTIMATE', 'AWAITING_CONFIRM',
    'VERIFYING', 'PAUSED_COST', 'REJECTED_BY_MODERATION',
    'COMPLETED', 'FAILED', 'CANCELED'
  ));

-- ─────────────────────────────────────────────
-- M-01: result_reference_hit 行数增长监控视图（盲区 D5 改进）
--   用于告警：单任务 hit 行数 > 阈值 / 全表 hit 行数 / 无 hit 索引命中的查询量。
--   与 Vercel Analytics / Sentry 对接：暴露 /api/admin/db/hit-stats 路由定时拉取。
-- ─────────────────────────────────────────────
CREATE OR REPLACE VIEW v_result_reference_hit_stats AS
SELECT
  (SELECT count(*) FROM result_reference_hit)                                AS total_rows,
  (SELECT count(*) FROM result_reference_hit WHERE hit = true)               AS hit_true_rows,
  (SELECT count(*) FROM result_reference_hit WHERE hit = false)              AS hit_false_rows,
  (SELECT avg(cnt) FROM (
      SELECT count(*) AS cnt FROM result_reference_hit GROUP BY result_id
  ) t)                                                                       AS avg_hits_per_result,
  (SELECT max(cnt) FROM (
      SELECT count(*) AS cnt FROM result_reference_hit GROUP BY result_id
  ) t)                                                                       AS max_hits_per_result,
  pg_size_pretty(pg_total_relation_size('result_reference_hit'))             AS total_size;

COMMENT ON VIEW v_result_reference_hit_stats IS
  'D5 监控：告警阈值建议 total_rows > 2_000_000 时触发归档迁移（见 M-02）';

-- ─────────────────────────────────────────────
-- M-02: result_reference_hit 冷归档表（盲区 D5 改进）
--   超出监控阈值（默认 200 万行）时，把 90 天前已完成任务的 hit 迁入归档表。
--   归档表无索引（节省写放大）；查询历史 hit 时应用层 UNION ALL。
--   归档由 Inngest cron 'result-hit-archive' 触发（每周日 03:00）。
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS result_reference_hit_archive (
  id           bigint PRIMARY KEY,
  result_id    uuid NOT NULL,
  reference_id uuid NOT NULL,
  hit          boolean NOT NULL,
  snippet      text,
  location_json jsonb,
  similarity   numeric(4,3),
  retrieval_method varchar(32),
  created_at   timestamptz NOT NULL,
  archived_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hit_archive_result
  ON result_reference_hit_archive (result_id);

COMMENT ON TABLE result_reference_hit_archive IS
  'D5 归档：仅存放 >90 天且 task.completed_at 非 NULL 的 hit 记录；应用层查历史报告时 UNION 主表';
```

---

## 6. 索引策略

### 6.1 索引清单（按表）

| 表 | 索引 | 类型 | 用途 | 查询模式 |
|---|-----|------|-----|---------|
| `user` | `uniq_user_email` | B-tree unique | 登录 | `WHERE email = ?` |
| `user` | `idx_user_role` | B-tree | 管理员按角色分面 | `WHERE role = ?` |
| `session` | `uniq_session_token` | B-tree unique | Better Auth 查 token | — |
| `session` | `idx_session_expires` | B-tree | Cron 清过期 | `WHERE expires_at < now()` |
| `manuscript` | `idx_manuscript_user` | 复合 (user_id, created_at) | 用户书稿列表分页 | `WHERE user_id = ? ORDER BY created_at DESC` |
| `manuscript` | `idx_manuscript_destroyed` | B-tree | TTL 扫描 | `WHERE destroyed_at IS NULL` |
| `paragraph` | `idx_paragraph_manuscript_seq` | 复合 | 按书稿取段落 | `WHERE manuscript_id = ? ORDER BY seq` |
| `paragraph` | `idx_paragraph_text_trgm` | GIN trigram | 文本近似检索（n-gram 辅助） | `WHERE text_normalized %% ?` |
| `quote` | `idx_quote_paragraph` | B-tree | 段落的引文 | `WHERE paragraph_id = ?` |
| `quote` | `idx_quote_manuscript_seq` | 复合 | 任务按引文枚举 | `WHERE manuscript_id = ? ORDER BY seq` |
| `quote` | `idx_quote_canonical` | B-tree | 按书名归一筛 | `WHERE canonical_name = ?` |
| `reference` | `idx_reference_user_canonical` | 复合 | 用户参考库按书名 | `WHERE user_id = ? AND canonical_name = ?` |
| `reference` | `idx_reference_content_hash` | B-tree | 重复上传检测 | `WHERE content_hash = ?` |
| `task` | `idx_task_user_status` | 复合 (user_id, status, created_at) | 工作台任务列表 | `WHERE user_id = ? AND status IN (...) ORDER BY created_at DESC` |
| `task` | `idx_task_manuscript` | B-tree | 书稿的历史任务 | `WHERE manuscript_id = ?` |
| `task` | `idx_task_ttl` | B-tree | Inngest TTL cron | `WHERE ttl_expires_at < now() AND destroyed_at IS NULL` |
| `task` | `idx_task_reference_ids_gin` | GIN | "哪些任务用了这份参考" | `WHERE reference_ids @> ARRAY[?]` |
| `verification_result` | `idx_result_task` | B-tree | 任务报告 | `WHERE task_id = ?` |
| `verification_result` | `idx_result_task_status` | 复合 (task_id, match_status) | 报告筛选 | `WHERE task_id = ? AND match_status = ?` |
| `verification_result` | `uniq_result_idempotency` | B-tree unique | 幂等冲突检测 | `INSERT ... ON CONFLICT` |
| `result_reference_hit` | `idx_hit_result` | 复合 (result_id, hit) | ADR-011 盲区 #8——列表页只 join 主命中 | `WHERE result_id = ? AND hit = true` |
| `audit_log` | `idx_audit_user_op` | 复合 | 用户操作历史 | — |

### 6.2 索引性能预算

- **写放大**：每张业务表 2-4 个索引。正常写入开销可控（< 2x 基础写入）。
- **读性能目标**：
  - 工作台列表：p95 < 50ms（10 万任务规模下）
  - 任务详情 + 三维度：p95 < 200ms（500 引文规模下）
  - TTL cron 扫描：每 10 分钟一次，全表扫描限流（LIMIT 100）
- **GIN 索引**：
  - trigram 索引会增加 3-5x 索引空间——段落 20MB 书稿索引约 60-100MB，可接受
  - 数组 GIN（`task.reference_ids`）查询 `@>` 毫秒级

### 6.3 `result_reference_hit` 行数告警阈值（盲区 D5 改进）

| 阶段 | `total_rows` | 动作 | 成本影响 |
|------|-------------|------|---------|
| 🟢 健康 | < 500 k | 仅通过 `v_result_reference_hit_stats` 每周采样 | 无 |
| 🟡 观察 | 500 k ~ 2 M | 每日采样；`/api/admin/db/hit-stats` 上报 Sentry | 查询仍 < 100ms（索引命中） |
| 🟠 归档准备 | 2 M ~ 5 M | 启用 `result_reference_hit_archive`（§5 M-02）；Inngest cron `result-hit-archive` 每周日 03:00 迁入 >90 天数据 | 迁移期短暂 I/O 峰值 |
| 🔴 紧急 | > 5 M | 改用 PG 原生 list partitioning（按 `result_id` hash）；此时已超过 Neon compute 单实例性能边界，需升配 | 停机 <30min 完成分区 |

**查询契约**（强制列表页走 `idx_hit_result`，避免全表扫描）：
- 列表接口：**必须**带 `result_id IN (...)` 过滤 + 默认 `hit = true` + `LIMIT ≤ 3`
- 详情接口：`result_id = ?` 单值过滤，允许 `LIMIT 50`
- 禁止：跨 task 聚合统计的即席查询——改走 `reportSnapshot.resultsAggregate` 预聚合

**监控自动化**（lib/db/monitoring.ts）：

```typescript
import { sql } from 'drizzle-orm';
export async function getHitStats() {
  return db.execute(sql`SELECT * FROM v_result_reference_hit_stats`);
}
// 绑定到 Inngest cron 每日 01:00 拉取；超 2M 触发 Sentry 告警。
```

### 6.3 不建索引的查询

- 全表 COUNT（管理员统计）——走物化视图或 approximate count
- jsonb 字段的深度过滤——应用层过滤，不走 DB 索引

---

## 7. 约束契约：real.md / notes / MS → schema 映射

| 来源 | 条款 | schema 实现 |
|------|-----|------------|
| real.md #1 | AI 不得直接改稿 | `verificationResult.verdictTextAccuracy.suggestedCorrection` 仅作建议；UI 层不提供"一键替换"——见产品规约 N04 |
| real.md #2 | 证据链三要素 | `verificationResult.confidence_breakdown` + `verdictXxx.referenceLocation` + `explanation` 必填（Zod notNull） |
| real.md #2 | 置信度非 AI 自评 | `confidence_breakdown.algoVersion` 记录算法版本；`crossModel=0` v1.0 显式 |
| real.md #3 | N 天自动销毁 | `task.ttl_expires_at` + Inngest cron + `destroyed_at` 软删除 + Blob 主动 del |
| real.md #4 | 异文 ≠ 错误 | `text_accuracy_enum` 枚举强制区分 `VARIANT` / `MISMATCH` / `NOT_FOUND_IN_REF` |
| real.md #5 | 版权用户自证 | `reference.copyright_declared_by` + `copyright_declared_at` |
| real.md #6 | 成本上限 + 二次确认 | `task.cost_ceiling_cents` + `cost_confirmed_at` + `PAUSED_COST` 状态 |
| real.md #7 | 模型 + prompt 版本锁定 | `task.version_stamp` + `report_snapshot.version_stamp_json` + `prompt_version` 表 + **T-01/T-02/T-06 触发器** |
| notes #1 | 审核拒绝语义独立 | `verification_result.moderation_status` 与三维度 verdict 独立；`REJECTED_BY_MODERATION` 也是 `task.status` 枚举 |
| notes #2 | 日志不含原文片段 | `audit_log.metadata_json` 规约只存元数据；应用层 Pino redact 兜底；`raw_response_snapshot` TTL 销毁 |
| notes #3 | 文史字符工程 | `text_normalized` 字段落库（paragraph/quote）；规范化由 `lib/text/normalize.ts` 单一出口 |
| notes #4 | 任务持久化 + 幂等 | `task` 表落库（非 in-memory）；`verification_result.idempotency_key` unique |
| notes #5 | 价值宣传不可实现为 affordance | schema 无字段；命名 lint 规则保障 |
| notes #6 | 合规留痕 | `audit_log` + `user_agreement_acceptance` + T-04/T-05 append-only 触发器 |
| notes #7 | 报告快照不可变 | `report_snapshot` + T-01 触发器 + T-03 结果不可改 |

**MS 映射**（25 MS 全部覆盖，完整表见架构规约附录 A；此处仅列**对 schema 有直接影响**的 MS）：

| MS | schema 关联 |
|----|------------|
| MS-L-01 注册 | `user` + Better Auth 表 |
| MS-L-02 登录 | `session` + `account` |
| MS-L-03 上传 | `manuscript` + `paragraph` + `quote` |
| MS-L-04 参考库 | `reference` |
| MS-L-05 发起任务 | `task` + `version_stamp` |
| MS-L-06 进度 | `task.verified_quotes` / `failed_quotes` |
| MS-L-07 三维度报告 | `verification_result` 三 jsonb |
| MS-L-08 失败重试 | `verification_result.idempotency_key` + `attempt_count` |
| MS-L-09 版本戳冻结 | `report_snapshot` + T-01 |
| MS-L-10 历史报告 | `report_snapshot` read |
| MS-L-11 协议 | `user_agreement_acceptance` |
| MS-L-12/13 导出 | `report_snapshot.results_aggregate` 预聚合 |
| MS-D-02 20000 截取 | `reference.char_count` 预存；应用层判边界 |
| MS-D-03 限流重试 | `verification_result.attempt_count` + 幂等 key |
| MS-D-04 成本超额暂停 | `task.cost_ceiling_cents` + `PAUSED_COST` 状态 |
| MS-D-05 书名别名 | `quote.canonical_name` 预归一 |
| MS-D-06 TTL 销毁 | `task.ttl_expires_at` + `destroyed_at` |
| MS-G-01 参考库管理 | `reference.deleted_at` |
| MS-G-02 任务暂停 | `task.status = PAUSED_COST` + `paused_at` |
| MS-G-03 新旧报告对比 | 多 `report_snapshot` 共存（每 task 唯一） |
| MS-G-04 历史列表 | `idx_task_user_status` |
| MS-G-05 协议弹窗再签 | `user_agreement_acceptance` unique (user+version) |

---

## 8. Zod 校验层（lib/validations/*）

> 与 schema 对齐的运行时校验。关键原则：**API 边界严格；LLM 输出宽松**（ADR-005 盲区 #10）。

### 8.1 lib/validations/manuscript.ts

```typescript
import { z } from 'zod';

export const uploadManuscriptSchema = z.object({
  filename: z.string().min(1).max(512),
  mimeType: z.enum([
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
    'application/pdf',
    'application/epub+zip',
    'text/markdown',
    'text/plain',
  ]),
  fileSize: z.number().int().positive().max(20 * 1024 * 1024), // 20MB 上限
});

export type UploadManuscriptInput = z.infer<typeof uploadManuscriptSchema>;
```

### 8.2 lib/validations/task.ts

```typescript
import { z } from 'zod';

export const createTaskSchema = z.object({
  manuscriptId: z.string().uuid(),
  referenceIds: z.array(z.string().uuid()).min(1).max(10), // 一次最多 10 份参考
  // MS-L-11 协议版本确认
  agreementVersion: z.string().min(1).max(32),
});

export const confirmCostSchema = z.object({
  taskId: z.string().uuid(),
  estimatedCents: z.number().int().positive(),
  userAcceptedCeilingCents: z.number().int().positive(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type ConfirmCostInput = z.infer<typeof confirmCostSchema>;
```

### 8.3 lib/validations/llm-output.ts（宽松 schema）

```typescript
import { z } from 'zod';

/**
 * 关键：LLM 输出的 schema 对未知字段宽容（`.passthrough()`），
 * 字段缺失用 fallback，避免 generateObject 抛错（盲区 #10）。
 */

export const extractQuotesOutputSchema = z
  .object({
    quotes: z.array(
      z
        .object({
          text: z.string(),
          kind: z.enum(['DIRECT', 'INDIRECT', 'NOTED']).catch('DIRECT'),
          sourceWorkHint: z.string().optional().nullable(),
          paragraphSeq: z.number().int().optional().nullable(),
        })
        .passthrough(),
    ),
  })
  .passthrough();

export const verifyQuoteOutputSchema = z
  .object({
    verdictTextAccuracy: z
      .object({
        verdict: z.enum(['MATCH', 'VARIANT', 'MISMATCH', 'NOT_FOUND_IN_REF']).catch('NOT_FOUND_IN_REF'),
        explanation: z.string().default(''),
        suggestedCorrection: z.string().optional().nullable(),
        referenceLocation: z
          .object({
            chapter: z.string().optional(),
            paragraph: z.string().optional(),
            offset: z.number().int().optional(),
          })
          .passthrough()
          .optional()
          .nullable(),
      })
      .passthrough(),
    verdictInterpretation: z
      .object({
        verdict: z.enum(['CONSISTENT', 'PARTIAL', 'DIVERGENT', 'NOT_APPLICABLE']).catch('NOT_APPLICABLE'),
        explanation: z.string().default(''),
      })
      .passthrough(),
    verdictContext: z
      .object({
        verdict: z.enum(['APPROPRIATE', 'AMBIGUOUS', 'OUT_OF_CONTEXT', 'NOT_APPLICABLE']).catch('NOT_APPLICABLE'),
        explanation: z.string().default(''),
      })
      .passthrough(),
  })
  .passthrough();

export type VerifyQuoteOutput = z.infer<typeof verifyQuoteOutputSchema>;
```

### 8.4 lib/validations/agreement.ts

```typescript
import { z } from 'zod';

export const acceptAgreementSchema = z.object({
  agreementVersion: z.string().min(1).max(32),
  role: z.enum(['B', 'C']),
  checksum: z.string().length(64), // SHA256 hex
});

export type AcceptAgreementInput = z.infer<typeof acceptAgreementSchema>;
```

### 8.5 lib/validations/reference.ts

```typescript
import { z } from 'zod';

export const uploadReferenceSchema = z.object({
  canonicalName: z.string().min(1).max(200),
  versionLabel: z.string().max(200).optional(),
  role: z.enum(['CANON', 'ANNOTATED', 'TRANSLATED', 'TOOL', 'OTHER']),
  filename: z.string().min(1).max(512),
  mimeType: z.string().min(1).max(128),
  fileSize: z.number().int().positive().max(50 * 1024 * 1024), // 参考文献 50MB 上限
  // real.md #5 版权声明
  copyrightAcknowledged: z.literal(true),
});

export type UploadReferenceInput = z.infer<typeof uploadReferenceSchema>;
```

---

## 9. 常见查询范式（Drizzle 用法示例）

### 9.1 工作台任务列表（分页 + 状态筛选）

```typescript
import { db } from '@/lib/db';
import { task } from '@/lib/db/schema';
import { and, desc, eq, inArray } from 'drizzle-orm';

export async function listTasksForUser(
  userId: string,
  statuses: TaskStatus[] = ['VERIFYING', 'COMPLETED', 'FAILED'],
  cursor?: { createdAt: Date; id: string },
  limit = 20,
) {
  return db
    .select()
    .from(task)
    .where(
      and(
        eq(task.userId, userId),
        inArray(task.status, statuses),
        // 游标分页
        cursor ? undefined /* build cursor clause */ : undefined,
      ),
    )
    .orderBy(desc(task.createdAt))
    .limit(limit);
}
```

### 9.2 任务详情 + 三维度聚合（单次查询）

```typescript
export async function getTaskWithResults(taskId: string, userId: string) {
  return db.query.task.findFirst({
    where: (t, { eq, and }) => and(eq(t.id, taskId), eq(t.userId, userId)),
    with: {
      manuscript: { columns: { displayId: true, filename: true } },
      results: {
        with: {
          quote: { columns: { quoteText: true, canonicalName: true, displayId: true } },
          // 默认只取命中的 hit（ADR-011 盲区 #8）
          hits: { where: (h, { eq }) => eq(h.hit, true), limit: 3 },
        },
        orderBy: (r, { asc }) => asc(r.createdAt),
      },
      snapshot: true,
    },
  });
}
```

### 9.3 TTL 销毁扫描（Inngest cron）

```typescript
import { and, isNull, lte } from 'drizzle-orm';

export async function fetchDueTasksForDestruction(limit = 100) {
  return db
    .select({ id: task.id, manuscriptId: task.manuscriptId, ttlExpiresAt: task.ttlExpiresAt })
    .from(task)
    .where(and(isNull(task.destroyedAt), lte(task.ttlExpiresAt, new Date())))
    .limit(limit);
}
```

### 9.4 幂等写入校对结果（ADR-002）

```typescript
import { sql } from 'drizzle-orm';

export async function insertVerificationResult(data: NewVerificationResult) {
  // ON CONFLICT 复用（idempotency_key 已 unique）
  return db
    .insert(verificationResult)
    .values(data)
    .onConflictDoNothing({ target: verificationResult.idempotencyKey })
    .returning();
}
```

### 9.5 按参考文献反查任务（MS-G-01 删除参考时的依赖检查）

```typescript
import { sql } from 'drizzle-orm';

export async function findTasksUsingReference(referenceId: string) {
  return db
    .select({ id: task.id, displayId: task.displayId, status: task.status })
    .from(task)
    .where(sql`${task.referenceIds} @> ARRAY[${referenceId}]::uuid[]`);
}
```

---

## 10. 迁移策略（Neon 分支 + drizzle-kit 工作流）

### 10.1 drizzle.config.ts

```typescript
import type { Config } from 'drizzle-kit';

export default {
  schema: './lib/db/schema.ts',
  out: './lib/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!, // Neon connection string
  },
  // 不启用 strict，生产 migration 前人工审查
  verbose: true,
  strict: false,
} satisfies Config;
```

### 10.2 本地开发（Neon dev branch）

```bash
# 1. 创建/切换到 dev 分支（一次性）
bunx neonctl branches create --name dev
export DATABASE_URL=$(bunx neonctl connection-string dev)

# 2. 改 schema.ts → 生成 migration
bunx drizzle-kit generate --name="describe_change"

# 3. 审查 lib/db/migrations/XXXX_describe_change.sql

# 4. 应用到 dev
bunx drizzle-kit migrate

# 5. 应用触发器 migration（独立 SQL，drizzle-kit 不生成）
psql $DATABASE_URL -f lib/db/migrations/0001_triggers.sql
```

### 10.3 部署到生产（main branch）

```bash
# 在 Vercel 构建阶段自动执行
# package.json:
"scripts": {
  "db:migrate": "drizzle-kit migrate && psql $DATABASE_URL -f lib/db/migrations/0001_triggers.sql"
}

# vercel.json: 或在 CI（GitHub Actions）中
# build → db:migrate → deploy
```

### 10.4 分支迁移同步规范

**问题（盲区 #4）**：dev 分支和 main 分支 schema 漂移。

**解决**：
1. 所有 migration 文件（`lib/db/migrations/*.sql`）提交 git
2. main 分支部署前 CI 执行 `drizzle-kit check`——检查 migration 状态与 schema.ts 一致
3. hotfix 场景：main 直接改 schema → 新建 migration → dev 分支同步 `git pull && bunx drizzle-kit migrate`
4. **禁止**：在 Neon console 直接改 schema（不落 migration，会导致生产漂移）

### 10.5 回滚

drizzle-kit 不提供自动 down migration。回滚策略：

- **前滚优先**：发现 bug 就写新 migration 反向修改
- **Neon 点时恢复**：Neon 提供 restore point；重大事故用 `neonctl branches restore`
- **生产 migration 一律人工 review 后合并 PR 才触发**

---

## 11. Seed 与初始数据（scripts/seed.ts）

```typescript
/**
 * scripts/seed.ts
 * 初始化：
 * 1. prompt_version 登记（3 条）
 * 2. 管理员账号（邮箱从 env 读）
 *
 * 运行：bun scripts/seed.ts
 */
import { db } from '@/lib/db';
import { promptVersion, user } from '@/lib/db/schema';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

async function seedPromptVersions() {
  const promptsDir = path.join(process.cwd(), 'prompts', 'v1');
  const prompts = [
    { key: 'v1-extract', name: 'extract', file: 'extract.txt' },
    { key: 'v1-verify', name: 'verify', file: 'verify.txt' },
    { key: 'v1-map', name: 'map', file: 'map.txt' },
  ];

  for (const p of prompts) {
    const content = readFileSync(path.join(promptsDir, p.file));
    const sha = createHash('sha256').update(content).digest('hex');
    await db
      .insert(promptVersion)
      .values({
        key: p.key,
        name: p.name,
        versionTag: 'v1',
        sha256: sha,
        byteSize: content.byteLength,
        note: `Initial v1 prompt for ${p.name}; migrated from origin/app/prompts/`,
      })
      .onConflictDoNothing();
  }
}

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL;
  if (!email) {
    console.log('SEED_ADMIN_EMAIL unset, skipping admin seed');
    return;
  }
  // 注意：实际密码通过 Better Auth API 设置；此处只落 user 行
  await db
    .insert(user)
    .values({
      email,
      name: 'admin',
      role: 'admin',
      emailVerified: true,
      agreementVersion: 'admin-bypass',
      agreementAcceptedAt: new Date(),
    })
    .onConflictDoNothing();
}

async function main() {
  await seedPromptVersions();
  await seedAdmin();
  console.log('Seed done');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

---

## 12. Non-scope（本规约不涉及）

- **读写分离**：Neon 默认单 primary + read replica，v1.0 全走 primary；v2.0 考虑
- **多租户隔离**：v1.0 通过 `user_id` 软隔离；无 row-level security (RLS) 策略（B 端深度合规上 RLS 再考虑）
- **OLAP 分析**：运营看板将来走 Neon → dbt → 分析 DB（非本规约范围）
- **向量检索**：v1.0 用 trigram GIN 做 n-gram 近似；pgvector 留 v2.0 RAG 时再装扩展
- **分库分表**：单库可撑 10 万任务 × 500 引文 = 5000 万行；v2.0 按 user_id 分区（pg_partman）

---

## 13. 质量检查清单（对应 SKILL.md §Quality Checklist）

### 设计决策
- [x] 每个实体都已评估：cog.md 定义？用户故事依赖？未来重构成本？——见 §4.3 决策表

### 实现质量
- [x] cog.md 7 实体全部反映到 schema.ts（user / manuscript / paragraph / quote / reference / task / verification_result）
- [x] 关系通过 `references()` 正确定义（§4.1 relations 段）
- [x] 索引覆盖常见查询模式（§6）
- [x] real.md 7 约束全部实现（§7 约束契约表）
- [x] 命名规范一致（snake_case for DB，camelCase for TS——Drizzle 映射）
- [x] JSONB 用在需要灵活性的地方（三维度 verdict / version_stamp / confidence_breakdown）
- [x] 类型导出完整（§4.2）
- [x] Zod 校验与 schema 对应（§8）

### 安全检查
- [x] 外部 API 暴露表用 UUID 主键（防枚举攻击）
- [x] 纯内部表用 serial（audit_log / result_reference_hit）
- [x] 不依赖 ID 不可预测作为权限控制（所有查询强制注入 user_id）
- [x] 敏感字段：password 由 Better Auth argon2 处理；API key 不落库
- [x] 所有 public endpoint 必须校验权限（Route Handler 首行 `requireUser()`）——见架构规约 §9.3

### 本项目额外检查
- [x] real.md #7 版本冻结：schema 层（`versionStampFrozenAt`）+ 应用层（不 export update）+ DB 层（T-01/T-02 触发器）三重保障
- [x] notes #2 日志脱敏：audit_log 规约不含原文 + Pino redact（架构规约 ADR-015）
- [x] PARTIAL_MATCH（ADR-011）：`result_reference_hit` 联接表 + `idx_hit_result` 索引（ADR 盲区 #8）
- [x] 幂等（notes #4）：`verification_result.idempotency_key` unique
- [x] TTL 销毁（real.md #3）：`task.ttl_expires_at` + `destroyed_at` 软删除 + Blob 主动 del

---

## 14. 盲区清单（本规约新披露）

除继承架构规约 10 条盲区外，本规约新识别：

| # | 盲区 | 对应 |
|---|------|-----|
| D1 | **trigram 索引对中文分词的准确度**：pg_trgm 按字符 trigram 工作，对中文只能做粗匹配；细粒度检索仍需应用层 n-gram 算法 | §5 I-02 |
| D2 | **`task.reference_ids` 数组删除参考的级联**：用户删除一份参考，历史任务的 `reference_ids` 中该 UUID 仍保留；查询时若 reference 软删除需显式过滤 `deleted_at IS NULL` | §9.5 |
| D3 | **三维度枚举的演进成本**：pgEnum 的值扩充需 migration；如果 prompt 演进新增 verdict 分类（如 `INCONCLUSIVE`），要额外 migration。建议 v2.0 考虑改 jsonb 字段中 varchar + 应用层枚举 | §4.1 enums |
| D3✓ | **【2026-04-19 已缓解】** 三维度 enum 从未在列上使用（只在 jsonb 内），已**删除** `textAccuracyEnum`/`interpretAccuracyEnum`/`contextAccuracyEnum` pgEnum 定义；约束迁移到 §8.3 Zod `verifyQuoteOutputSchema`。另外 `taskStatusEnum` 从 pgEnum 改造为 `varchar + CHECK + Zod` 三层约束（§4.3 D-03a / §5 C-03 / §8.2）——最易演进的状态机现在加值只需三处同步，无需 `ALTER TYPE` | §4.1 + §4.3 + §5 + §8 |
| D4 | **版本戳 SHA256 碰撞假设**：sourceRefsHash 合并多份参考的 content_hash 后再 sha256；理论上存在碰撞。v1.0 可接受（10^-77 概率），v2.0 可考虑 blake3 | §7 real.md #7 |
| D5 | **`result_reference_hit` 行数随参考指数增长**：100 任务 × 500 引文 × 5 参考 = 25 万行；1000 任务时 250 万行。GIN 索引 OK，但列表页 join 必须 lazy-load（架构规约盲区 #8 已披露） | §6.1 |
| D5✓ | **【2026-04-19 已缓解】** 加了四层防御：(1) §5 M-01 监控视图 `v_result_reference_hit_stats` + Inngest 每日采样；(2) §5 M-02 冷归档表 `result_reference_hit_archive` + 周期 cron 迁移 >90 天数据；(3) §6.3 明确 4 档告警阈值（500k→5M）与对应动作；(4) §6.3 查询契约——列表接口必须 `result_id IN` 过滤 + 默认 `hit=true LIMIT 3`，禁止即席全表聚合。过渡路径一直规划到 PG 原生 list partitioning（5M+ 行临界）| §5 + §6.3 |
| D6 | **raw_response_snapshot TTL 销毁边界**：调试用但含原文；TTL 时必须清，否则违反 real.md #3 | §4.1 verificationResult |
| D7 | **PG 触发器 vs Drizzle ORM 的可见性**：触发器错误会抛到应用层为 DB exception；应用层需捕获并转为友好 ErrorCode（架构规约 `lib/errors.ts`） | §5 T-01~T-06 |
| D8 | **Better Auth 自带表的字段微调风险**：Better Auth 版本升级时可能要求新增字段；我们的 schema 写死字段版本会导致 `drizzle-kit push` 冲突。对策：跟踪 Better Auth CHANGELOG，版本升级前 dry-run migration | §4.1 better auth block |

---

## 15. 交付物 + 下游

### 15.1 本规约交付物

| 产物 | 位置 | 状态 |
|------|-----|------|
| **本规约文件** | `.42cog/spec/spec-database-design.md` | ✅ 本次交付 |
| **`lib/db/schema.ts`** | §4.1（规约内代码块） | ⏳ `dev-coding` 阶段 copy |
| **`lib/db/types.ts`** | §4.2 | ⏳ 同上 |
| **`lib/db/migrations/0001_triggers.sql`** | §5 | ⏳ 同上 |
| **`lib/validations/*.ts`** | §8 | ⏳ 同上 |
| **`scripts/seed.ts`** | §11 | ⏳ 同上 |
| **`drizzle.config.ts`** | §10.1 | ⏳ 同上 |

### 15.2 关联更新（本规约发布后需同步）

- `.42cog/work/milestones.md`：追加 D 级条目——数据库设计规约 v1.0-draft 完成
- `.42cog/spec/spec-system-architecture.md` 附录 C：从"表名对照"升级为"见 spec-database-design.md §4 完整 DDL"——但按**只追加原则**不改旧条目，此处以脚注形式处理（若规约演进需要）

### 15.3 触发下游

- `dev-ui-design`：按本规约 §4.1 的 TS 类型（`Task`, `VerificationResult`, `ResultReferenceHit`）设计三维度卡片的 props 契约
- `dev-coding`：起 Next.js 脚手架后按 §10.2 工作流跑首次 migration；按 §11 跑 seed；之后起 Better Auth + API

---

## 附录 A：cog.md 7 实体 × Drizzle 表 × 字段对照

| cog 实体 | Drizzle 表 | 关键字段 | 分类实现 | 唯一编码实现 |
|---------|-----------|---------|---------|------------|
| 用户 | `user` | email, role, agreementVersion, organization | `user_role_enum` (B/C/admin) | `email` unique 索引 |
| 书稿 | `manuscript` | userId, filename, blobUrl, charCount, displayId | （未枚举；MVP 不区分） | `display_id`（如 20260417-001） |
| 段落 | `paragraph` | manuscriptId, seq, text, hasQuote, hasFootnote | `has_quote` + `has_footnote` 布尔组合 | `display_id`（如 20260417-001-para-042） |
| 引文 | `quote` | paragraphId, quoteText, kind, canonicalName | `quote_kind_enum` (DIRECT/INDIRECT/NOTED) | `display_id`（如 20260417-001-quote-042） |
| 参考文献 | `reference` | canonicalName, role, versionLabel, contentHash | `reference_role_enum` (CANON/ANNOTATED/TRANSLATED/TOOL) | `display_id`（slug-hash8） |
| 校对任务 | `task` | status, costCeilingCents, ttlExpiresAt, versionStamp | `task_status_enum` (9 状态) | `display_id`（与 manuscript 一对一） |
| 校对结果 | `verification_result` | 三 verdict jsonb + confidence + matchStatus | 三 verdict 枚举 + `match_status_enum` | `idempotency_key` unique |

**7/7 覆盖 ✓**

---

## 附录 B：SQL migrations 全文索引

| 文件 | 内容 | 来源 |
|------|-----|------|
| `lib/db/migrations/0000_init.sql` | `drizzle-kit generate` 自动产出（全表 DDL） | §4.1 schema.ts |
| `lib/db/migrations/0001_triggers.sql` | 6 触发器 + 2 GIN 索引 + pg_trgm 扩展 + `chk_task_status_allowed` CHECK + `v_result_reference_hit_stats` 视图 + `result_reference_hit_archive` 归档表（2026-04-19 补 D3/D5 改进） | §5 |
| `lib/db/migrations/NNNN_*.sql` | 后续 schema 演进（每次改 schema.ts 后 generate） | 按需 |

---

## 附录 C：术语表（补充）

| 术语 | 定义 |
|------|-----|
| **drizzle-kit** | Drizzle ORM 的 CLI 工具；负责生成/应用 migration、studio、check |
| **neon-http driver** | Neon Postgres 的 HTTP serverless driver；无连接池开销，适合 Vercel Functions |
| **neon-serverless driver** | WebSocket driver；支持事务，用于 Inngest 函数等长会话场景 |
| **pg_trgm** | PostgreSQL trigram 扩展；按字符三元组做模糊匹配 |
| **GIN (Generalized Inverted Index)** | 倒排索引；适合数组、jsonb、trigram 等多值字段 |
| **触发器冻结（Trigger Freeze）** | 本规约对 report_snapshot / version_stamp / verification_result 的 BEFORE UPDATE/DELETE RAISE EXCEPTION 技法 |
| **幂等键（Idempotency Key）** | `{taskId}_{quoteId}_{attemptN}` 结构字符串，unique 索引保证重试不双写 |
| **协议接受记录（Agreement Acceptance）** | real.md #3 要求的数据流向明示的合规证据；每次协议文本变动都要重签 |

---

**本规约撰写期**：2026-04-18
**规约版本**：v1.0-draft
**方法论来源**：`.42plugin/42edu/dev-database-design/SKILL.md`
**作者**：yubo（通过 Claude Code）
**数据栈**：PostgreSQL (Neon) + Drizzle ORM + Zod + Better Auth
