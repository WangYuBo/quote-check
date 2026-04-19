/**
 * Drizzle schema for quote-check v1.0
 * - 7 核心业务实体（cog.md）
 * - 4 辅助表（result_reference_hit / report_snapshot / audit_log / user_agreement_acceptance）
 * - 3 Better Auth 表（session / account / verification）
 * - 1 版本登记表（prompt_version，ADR-012）
 *
 * spec-database-design §4.1 · ADR-003/006/011/012 · real.md #7 · notes #6/#7
 */

import { relations } from 'drizzle-orm';
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

/* ─────────────────────────────────────────────────
 * Enums
 *
 * 策略（§4.3 D-03 改进）：
 *   - 低演进概率 → pgEnum（user_role / reference_role / quote_kind / match_status）
 *   - 高演进概率 → varchar + CHECK + Zod（task.status；见 0001_triggers.sql C-03）
 *   - jsonb 内部字段 → 不落 DB，由 Zod 独家守护（三维度 verdict）
 * ───────────────────────────────────────────────── */

export const userRoleEnum = pgEnum('user_role_enum', ['B', 'C', 'admin']);

export const referenceRoleEnum = pgEnum('reference_role_enum', [
  'CANON',
  'ANNOTATED',
  'TRANSLATED',
  'TOOL',
  'OTHER',
]);

export const quoteKindEnum = pgEnum('quote_kind_enum', ['DIRECT', 'INDIRECT', 'NOTED']);

export const matchStatusEnum = pgEnum('match_status_enum', [
  'MATCH',
  'PARTIAL_MATCH',
  'NOT_MATCH',
  'NOT_FOUND_IN_REF',
]);

// task.status —— varchar + CHECK，不落 pgEnum（D-03a）
// 新增状态的三处同步：(a) 本常量 (b) 0001_triggers.sql chk_task_status_allowed (c) §8.2 Zod
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

/* ─────────────────────────────────────────────────
 * Better Auth 表（user / session / account / verification）
 * ───────────────────────────────────────────────── */

export const user = pgTable(
  'user',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull(),
    emailVerified: boolean('email_verified').default(false).notNull(),
    name: varchar('name', { length: 100 }),
    image: text('image'),
    role: userRoleEnum('role').default('C').notNull(),
    agreementVersion: varchar('agreement_version', { length: 32 }),
    agreementAcceptedAt: timestamp('agreement_accepted_at', { withTimezone: true }),
    organization: varchar('organization', { length: 200 }),
    suspendedAt: timestamp('suspended_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    emailUniq: uniqueIndex('uniq_user_email').on(t.email),
    roleIdx: index('idx_user_role').on(t.role),
  }),
);

export const session = pgTable(
  'session',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
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
    expIdx: index('idx_session_expires').on(t.expiresAt),
  }),
);

export const account = pgTable(
  'account',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    providerId: varchar('provider_id', { length: 64 }).notNull(),
    accountId: varchar('account_id', { length: 255 }).notNull(),
    password: text('password'),
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
    identifier: varchar('identifier', { length: 255 }).notNull(),
    value: text('value').notNull(),
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
 * 核心业务实体
 * ───────────────────────────────────────────────── */

export const manuscript = pgTable(
  'manuscript',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    displayId: varchar('display_id', { length: 32 }).notNull(),
    filename: varchar('filename', { length: 512 }).notNull(),
    mimeType: varchar('mime_type', { length: 128 }).notNull(),
    fileSize: bigint('file_size', { mode: 'number' }).notNull(),
    charCount: integer('char_count'),
    blobUrl: text('blob_url').notNull(),
    blobPathname: text('blob_pathname').notNull(),
    parsedAt: timestamp('parsed_at', { withTimezone: true }),
    parseError: text('parse_error'),
    destroyedAt: timestamp('destroyed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('idx_manuscript_user').on(t.userId, t.createdAt),
    displayIdUniq: uniqueIndex('uniq_manuscript_display_id').on(t.displayId),
    destroyedIdx: index('idx_manuscript_destroyed').on(t.destroyedAt),
  }),
);

export const paragraph = pgTable(
  'paragraph',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    manuscriptId: uuid('manuscript_id')
      .notNull()
      .references(() => manuscript.id, { onDelete: 'cascade' }),
    seq: integer('seq').notNull(),
    displayId: varchar('display_id', { length: 48 }).notNull(),
    text: text('text').notNull(),
    textHash: varchar('text_hash', { length: 64 }).notNull(),
    textNormalized: text('text_normalized'),
    chapter: varchar('chapter', { length: 200 }),
    hasQuote: boolean('has_quote').default(false).notNull(),
    hasFootnote: boolean('has_footnote').default(false).notNull(),
    destroyedAt: timestamp('destroyed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    manuscriptSeqIdx: index('idx_paragraph_manuscript_seq').on(t.manuscriptId, t.seq),
    hashIdx: index('idx_paragraph_hash').on(t.textHash),
  }),
);

export const quote = pgTable(
  'quote',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    paragraphId: uuid('paragraph_id')
      .notNull()
      .references(() => paragraph.id, { onDelete: 'cascade' }),
    manuscriptId: uuid('manuscript_id')
      .notNull()
      .references(() => manuscript.id, { onDelete: 'cascade' }),
    seq: integer('seq').notNull(),
    displayId: varchar('display_id', { length: 48 }).notNull(),
    quoteText: text('quote_text').notNull(),
    quoteNormalized: text('quote_normalized'),
    kind: quoteKindEnum('kind').notNull(),
    sourceWorkHint: varchar('source_work_hint', { length: 200 }),
    canonicalName: varchar('canonical_name', { length: 200 }),
    locationHint: text('location_hint'),
    contextWindow: text('context_window'),
    destroyedAt: timestamp('destroyed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    paragraphIdx: index('idx_quote_paragraph').on(t.paragraphId),
    manuscriptSeqIdx: index('idx_quote_manuscript_seq').on(t.manuscriptId, t.seq),
    canonicalIdx: index('idx_quote_canonical').on(t.canonicalName),
  }),
);

export const reference = pgTable(
  'reference',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    displayId: varchar('display_id', { length: 64 }).notNull(),
    canonicalName: varchar('canonical_name', { length: 200 }).notNull(),
    versionLabel: varchar('version_label', { length: 200 }),
    role: referenceRoleEnum('role').notNull(),
    filename: varchar('filename', { length: 512 }).notNull(),
    mimeType: varchar('mime_type', { length: 128 }).notNull(),
    fileSize: bigint('file_size', { mode: 'number' }).notNull(),
    charCount: integer('char_count'),
    blobUrl: text('blob_url').notNull(),
    blobPathname: text('blob_pathname').notNull(),
    // v1.0 恒 false；预留字段（cog.md N:M）
    isPublic: boolean('is_public').default(false).notNull(),
    // real.md #5 版权用户自证
    copyrightDeclaredBy: uuid('copyright_declared_by').references(() => user.id),
    copyrightDeclaredAt: timestamp('copyright_declared_at', { withTimezone: true }),
    parsedAt: timestamp('parsed_at', { withTimezone: true }),
    parseError: text('parse_error'),
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

export const task = pgTable(
  'task',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    manuscriptId: uuid('manuscript_id')
      .notNull()
      .references(() => manuscript.id, { onDelete: 'restrict' }),
    displayId: varchar('display_id', { length: 32 }).notNull(),
    referenceIds: uuid('reference_ids').array().notNull().default([]),
    status: varchar('status', { length: 32 })
      .$type<TaskStatus>()
      .default('PENDING_PARSE')
      .notNull(),
    costEstimatedCents: integer('cost_estimated_cents'),
    costActualCents: integer('cost_actual_cents'),
    costCeilingCents: integer('cost_ceiling_cents'),
    costConfirmedAt: timestamp('cost_confirmed_at', { withTimezone: true }),
    costConfirmedBy: uuid('cost_confirmed_by').references(() => user.id),
    totalQuotes: integer('total_quotes'),
    verifiedQuotes: integer('verified_quotes').default(0).notNull(),
    failedQuotes: integer('failed_quotes').default(0).notNull(),
    versionStamp: jsonb('version_stamp').$type<{
      modelId: string;
      modelProvider: string;
      promptVersions: { extract: string; verify: string; map: string };
      sourceRefsHash: string;
      confidenceAlgoVersion: string;
      frozenAt: string;
    }>(),
    versionStampFrozenAt: timestamp('version_stamp_frozen_at', { withTimezone: true }),
    moderationRejectedAt: timestamp('moderation_rejected_at', { withTimezone: true }),
    moderationReason: text('moderation_reason'),
    ttlExpiresAt: timestamp('ttl_expires_at', { withTimezone: true }).notNull(),
    destroyedAt: timestamp('destroyed_at', { withTimezone: true }),
    inngestRunId: varchar('inngest_run_id', { length: 128 }),
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
    ttlIdx: index('idx_task_ttl').on(t.ttlExpiresAt),
    displayIdUniq: uniqueIndex('uniq_task_display_id').on(t.displayId),
    // referenceIds GIN 索引在 0001_triggers.sql I-01 创建
  }),
);

export const verificationResult = pgTable(
  'verification_result',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => task.id, { onDelete: 'cascade' }),
    quoteId: uuid('quote_id')
      .notNull()
      .references(() => quote.id, { onDelete: 'restrict' }),
    matchStatus: matchStatusEnum('match_status').notNull(),
    verdictTextAccuracy: jsonb('verdict_text_accuracy')
      .$type<{
        verdict: 'MATCH' | 'VARIANT' | 'MISMATCH' | 'NOT_FOUND_IN_REF';
        explanation: string;
        suggestedCorrection?: string;
        referenceLocation?: { chapter?: string; paragraph?: string; offset?: number };
      }>()
      .notNull(),
    verdictInterpretation: jsonb('verdict_interpretation')
      .$type<{
        verdict: 'CONSISTENT' | 'PARTIAL' | 'DIVERGENT' | 'NOT_APPLICABLE';
        explanation: string;
      }>()
      .notNull(),
    verdictContext: jsonb('verdict_context')
      .$type<{
        verdict: 'APPROPRIATE' | 'AMBIGUOUS' | 'OUT_OF_CONTEXT' | 'NOT_APPLICABLE';
        explanation: string;
      }>()
      .notNull(),
    confidence: numeric('confidence', { precision: 4, scale: 3 }).notNull(),
    confidenceBreakdown: jsonb('confidence_breakdown')
      .$type<{
        refHit: number;
        locationValid: number;
        crossModel: number;
        weights: { w1: number; w2: number; w3: number };
        algoVersion: string;
      }>()
      .notNull(),
    moderationStatus: varchar('moderation_status', { length: 32 }).default('OK').notNull(),
    moderationDetail: jsonb('moderation_detail'),
    attemptCount: integer('attempt_count').default(1).notNull(),
    idempotencyKey: varchar('idempotency_key', { length: 128 }).notNull(),
    rawResponseSnapshot: jsonb('raw_response_snapshot'),
    rawResponseDestroyedAt: timestamp('raw_response_destroyed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    // 无 updatedAt —— 一旦写入即定稿；重试另插新行（T-03 触发器兜底）
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

export const resultReferenceHit = pgTable(
  'result_reference_hit',
  {
    id: serial('id').primaryKey(),
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
    similarity: numeric('similarity', { precision: 4, scale: 3 }),
    retrievalMethod: varchar('retrieval_method', { length: 32 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    resultIdx: index('idx_hit_result').on(t.resultId, t.hit),
    referenceIdx: index('idx_hit_reference').on(t.referenceId),
    uniqPair: uniqueIndex('uniq_hit_result_reference').on(t.resultId, t.referenceId),
  }),
);

export const reportSnapshot = pgTable(
  'report_snapshot',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => task.id, { onDelete: 'restrict' }),
    versionStampJson: jsonb('version_stamp_json')
      .$type<{
        modelId: string;
        modelProvider: string;
        promptVersions: { extract: string; verify: string; map: string };
        sourceRefsHash: string;
        confidenceAlgoVersion: string;
      }>()
      .notNull(),
    resultsAggregate: jsonb('results_aggregate')
      .$type<{
        totalQuotes: number;
        matchCount: number;
        partialMatchCount: number;
        notMatchCount: number;
        notFoundCount: number;
        rejectedByModerationCount: number;
        meanConfidence: number;
      }>()
      .notNull(),
    frozenAt: timestamp('frozen_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    // 无 updatedAt —— append-only（T-01 触发器兜底）
  },
  (t) => ({
    taskUniq: uniqueIndex('uniq_report_snapshot_task').on(t.taskId),
    frozenIdx: index('idx_report_snapshot_frozen').on(t.frozenAt),
  }),
);

export const auditLog = pgTable(
  'audit_log',
  {
    id: serial('id').primaryKey(),
    // 弱 FK：目标删除后日志保留（D-08 / notes #6）
    userId: uuid('user_id').references(() => user.id, { onDelete: 'set null' }),
    op: varchar('op', { length: 64 }).notNull(),
    targetType: varchar('target_type', { length: 32 }),
    targetId: uuid('target_id'),
    // 只记元数据，绝不记原文片段（notes #2）
    metadataJson: jsonb('metadata_json').$type<Record<string, unknown>>(),
    ipAddress: varchar('ip_address', { length: 64 }),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userOpIdx: index('idx_audit_user_op').on(t.userId, t.op, t.createdAt),
    targetIdx: index('idx_audit_target').on(t.targetType, t.targetId),
    createdIdx: index('idx_audit_created').on(t.createdAt),
  }),
);

export const userAgreementAcceptance = pgTable(
  'user_agreement_acceptance',
  {
    id: serial('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    agreementVersion: varchar('agreement_version', { length: 32 }).notNull(),
    agreementRole: userRoleEnum('agreement_role').notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }).defaultNow().notNull(),
    ipAddress: varchar('ip_address', { length: 64 }),
    userAgent: text('user_agent'),
    checksum: varchar('checksum', { length: 64 }).notNull(),
  },
  (t) => ({
    userVersionUniq: uniqueIndex('uniq_agreement_user_version').on(t.userId, t.agreementVersion),
    userIdx: index('idx_agreement_user').on(t.userId, t.acceptedAt),
  }),
);

export const promptVersion = pgTable(
  'prompt_version',
  {
    key: varchar('key', { length: 64 }).primaryKey(),
    name: varchar('name', { length: 64 }).notNull(),
    versionTag: varchar('version_tag', { length: 16 }).notNull(),
    sha256: varchar('sha256', { length: 64 }).notNull(),
    byteSize: integer('byte_size').notNull(),
    note: text('note'),
    registeredAt: timestamp('registered_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    sha256Idx: index('idx_prompt_sha256').on(t.sha256),
  }),
);

/* ─────────────────────────────────────────────────
 * Relations（Drizzle Query API）
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
  manuscript: one(manuscript, {
    fields: [task.manuscriptId],
    references: [manuscript.id],
  }),
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
