import { eq, sql } from 'drizzle-orm';

import { db } from '@/lib/db';
import { paragraph, quote, reference, reportSnapshot, resultReferenceHit, task, verificationResult } from '@/lib/db/schema';
import type {
  NewQuote,
  NewReportSnapshot,
  NewVerificationResult,
  Quote,
  Task,
  VerificationResult,
} from '@/lib/db/types';
import type { TaskStatus } from '@/lib/db/schema';

function shortId(): string {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

export async function createTask(values: {
  userId: string;
  manuscriptId: string;
  referenceIds?: string[];
  costEstimatedCents?: number;
  costCeilingCents?: number;
  costConfirmedAt?: Date;
}): Promise<Task> {
  const [row] = await db
    .insert(task)
    .values({
      userId: values.userId,
      manuscriptId: values.manuscriptId,
      referenceIds: values.referenceIds ?? [],
      displayId: `T-${shortId()}`,
      status: 'PENDING_PARSE',
      ...(values.costEstimatedCents !== undefined && { costEstimatedCents: values.costEstimatedCents }),
      ...(values.costCeilingCents !== undefined && { costCeilingCents: values.costCeilingCents }),
      ...(values.costConfirmedAt !== undefined && {
        costConfirmedAt: values.costConfirmedAt,
        costConfirmedBy: values.userId,
      }),
      // TTL 默认 30 天（MAS-6 将由 cron 清理）
      ttlExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    })
    .returning();
  if (!row) throw new Error('task insert failed');
  return row;
}

/** 原子累加实际费用（分），并发安全（DB 层 += ） */
export async function updateTaskCost(taskId: string, additionalFen: number): Promise<void> {
  await db
    .update(task)
    .set({ costActualCents: sql`COALESCE(${task.costActualCents}, 0) + ${additionalFen}` })
    .where(eq(task.id, taskId));
}

/** 确认成本并记录（AWAITING_CONFIRM → 可发 Inngest） */
export async function confirmTaskCost(taskId: string, confirmedBy: string): Promise<void> {
  await db
    .update(task)
    .set({ costConfirmedAt: new Date(), costConfirmedBy: confirmedBy })
    .where(eq(task.id, taskId));
}

export async function getTask(id: string): Promise<Task | undefined> {
  return db.query.task.findFirst({ where: eq(task.id, id) });
}

export async function updateTaskStatus(id: string, status: TaskStatus): Promise<void> {
  await db.update(task).set({ status }).where(eq(task.id, id));
}

export async function updateTaskProgress(
  id: string,
  updates: {
    status?: TaskStatus;
    totalQuotes?: number;
    verifiedQuotes?: number;
    failedQuotes?: number;
  },
): Promise<void> {
  await db.update(task).set(updates).where(eq(task.id, id));
}

/**
 * 按 taskId 读全量上下文（load-task step 使用）
 */
export async function getTaskContext(taskId: string): Promise<{
  task: Task;
  paragraphs: { id: string; seq: number; text: string; displayId: string }[];
} | null> {
  const taskRow = await db.query.task.findFirst({ where: eq(task.id, taskId) });
  if (!taskRow) return null;

  const paras = await db
    .select({
      id: paragraph.id,
      seq: paragraph.seq,
      text: paragraph.text,
      displayId: paragraph.displayId,
    })
    .from(paragraph)
    .where(eq(paragraph.manuscriptId, taskRow.manuscriptId));

  return { task: taskRow, paragraphs: paras };
}

/**
 * 批量落 quote 行，返回 inserted quote ids
 */
export async function saveQuotes(
  manuscriptId: string,
  rows: {
    paragraphSeq: number;
    quoteText: string;
    kind: 'DIRECT' | 'INDIRECT' | 'NOTED';
    sourceWorkHint?: string;
    locationHint?: string;
    contextWindow?: string;
  }[],
): Promise<Quote[]> {
  if (rows.length === 0) return [];

  const paragraphRows = await db
    .select({ id: paragraph.id, seq: paragraph.seq })
    .from(paragraph)
    .where(eq(paragraph.manuscriptId, manuscriptId));

  const seqToId = new Map(paragraphRows.map((p) => [p.seq, p.id]));

  const quoteInserts: NewQuote[] = rows.map((r, i) => ({
    manuscriptId,
    paragraphId: seqToId.get(r.paragraphSeq) ?? paragraphRows[0]?.id ?? '',
    seq: i,
    displayId: `Q-${shortId()}`,
    quoteText: r.quoteText,
    kind: r.kind,
    ...(r.sourceWorkHint !== undefined ? { sourceWorkHint: r.sourceWorkHint } : {}),
    ...(r.locationHint !== undefined ? { locationHint: r.locationHint } : {}),
    ...(r.contextWindow !== undefined ? { contextWindow: r.contextWindow } : {}),
  }));

  const inserted = await db.insert(quote).values(quoteInserts).returning();
  return inserted;
}

export async function saveVerificationResult(
  row: NewVerificationResult,
): Promise<VerificationResult | null> {
  const [inserted] = await db
    .insert(verificationResult)
    .values(row)
    .onConflictDoNothing()
    .returning();
  return inserted ?? null;
}

export async function createReportSnapshot(values: NewReportSnapshot): Promise<void> {
  await db.insert(reportSnapshot).values(values);
}

export async function saveReferenceHits(
  resultId: string,
  hits: {
    referenceId: string;
    hit: boolean;
    snippet?: string;
    similarity?: number;
    retrievalMethod?: string;
  }[],
): Promise<void> {
  if (hits.length === 0) return;
  await db
    .insert(resultReferenceHit)
    .values(
      hits.map((h) => ({
        resultId,
        referenceId: h.referenceId,
        hit: h.hit,
        ...(h.snippet !== undefined ? { snippet: h.snippet } : {}),
        ...(h.similarity !== undefined ? { similarity: String(h.similarity) } : {}),
        ...(h.retrievalMethod !== undefined ? { retrievalMethod: h.retrievalMethod } : {}),
      })),
    )
    .onConflictDoNothing();
}

export interface ReferenceHitRow {
  referenceId: string;
  canonicalName: string;
  versionLabel: string | null;
  hit: boolean;
  snippet: string | null;
  similarity: string | null;
}

export interface ReportRow {
  task: Task;
  results: (VerificationResult & {
    quoteText: string;
    sourceWorkHint: string | null;
    referenceHits: ReferenceHitRow[];
  })[];
}

export async function getReport(taskId: string): Promise<ReportRow | null> {
  const taskRow = await db.query.task.findFirst({ where: eq(task.id, taskId) });
  if (!taskRow) return null;

  const results = await db
    .select({
      id: verificationResult.id,
      taskId: verificationResult.taskId,
      quoteId: verificationResult.quoteId,
      matchStatus: verificationResult.matchStatus,
      verdictTextAccuracy: verificationResult.verdictTextAccuracy,
      verdictInterpretation: verificationResult.verdictInterpretation,
      verdictContext: verificationResult.verdictContext,
      confidence: verificationResult.confidence,
      confidenceBreakdown: verificationResult.confidenceBreakdown,
      moderationStatus: verificationResult.moderationStatus,
      moderationDetail: verificationResult.moderationDetail,
      attemptCount: verificationResult.attemptCount,
      idempotencyKey: verificationResult.idempotencyKey,
      rawResponseSnapshot: verificationResult.rawResponseSnapshot,
      rawResponseDestroyedAt: verificationResult.rawResponseDestroyedAt,
      createdAt: verificationResult.createdAt,
      quoteText: quote.quoteText,
      sourceWorkHint: quote.sourceWorkHint,
    })
    .from(verificationResult)
    .innerJoin(quote, eq(verificationResult.quoteId, quote.id))
    .where(eq(verificationResult.taskId, taskId));

  // 批量拉取所有结果的 reference hits
  const resultIds = results.map((r) => r.id);
  const hitRows =
    resultIds.length > 0
      ? await db
          .select({
            resultId: resultReferenceHit.resultId,
            referenceId: resultReferenceHit.referenceId,
            hit: resultReferenceHit.hit,
            snippet: resultReferenceHit.snippet,
            similarity: resultReferenceHit.similarity,
            canonicalName: reference.canonicalName,
            versionLabel: reference.versionLabel,
          })
          .from(resultReferenceHit)
          .innerJoin(reference, eq(resultReferenceHit.referenceId, reference.id))
          .where(eq(resultReferenceHit.hit, true))
      : [];

  const hitsByResultId = new Map<string, ReferenceHitRow[]>();
  for (const h of hitRows) {
    if (!hitsByResultId.has(h.resultId)) hitsByResultId.set(h.resultId, []);
    const existing = hitsByResultId.get(h.resultId);
    if (existing) {
      existing.push({
        referenceId: h.referenceId,
        canonicalName: h.canonicalName,
        versionLabel: h.versionLabel,
        hit: h.hit,
        snippet: h.snippet,
        similarity: h.similarity,
      });
    }
  }

  return {
    task: taskRow,
    results: results.map((r) => ({
      ...(r as unknown as VerificationResult),
      quoteText: r.quoteText,
      sourceWorkHint: r.sourceWorkHint,
      referenceHits: hitsByResultId.get(r.id) ?? [],
    })) as ReportRow['results'],
  };
}

/** 列出用户所有任务（历史列表，L-10） */
export async function listUserTasks(userId: string): Promise<{
  id: string;
  displayId: string;
  status: string;
  totalQuotes: number | null;
  verifiedQuotes: number;
  createdAt: Date;
  completedAt: Date | null;
  costActualCents: number | null;
}[]> {
  return db
    .select({
      id: task.id,
      displayId: task.displayId,
      status: task.status,
      totalQuotes: task.totalQuotes,
      verifiedQuotes: task.verifiedQuotes,
      createdAt: task.createdAt,
      completedAt: task.completedAt,
      costActualCents: task.costActualCents,
    })
    .from(task)
    .where(eq(task.userId, userId))
    .orderBy(task.createdAt);
}

/** 查找 TTL 已过期且未销毁的任务（MAS-6） */
export async function findExpiredTasks(): Promise<{
  id: string;
  manuscriptId: string;
}[]> {
  const { lt } = await import('drizzle-orm');
  return db
    .select({ id: task.id, manuscriptId: task.manuscriptId })
    .from(task)
    .where(lt(task.ttlExpiresAt, new Date()));
}

/** 标记任务已销毁（MAS-6 TTL destroy） */
export async function markTaskDestroyed(taskId: string): Promise<void> {
  await db.update(task).set({ destroyedAt: new Date() }).where(eq(task.id, taskId));
}
