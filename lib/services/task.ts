import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { paragraph, quote, reportSnapshot, task, verificationResult } from '@/lib/db/schema';
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
}): Promise<Task> {
  const [row] = await db
    .insert(task)
    .values({
      userId: values.userId,
      manuscriptId: values.manuscriptId,
      referenceIds: values.referenceIds ?? [],
      displayId: `T-${shortId()}`,
      status: 'PENDING_PARSE',
      // TTL 默认 30 天（MAS-6 将由 cron 清理）
      ttlExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    })
    .returning();
  if (!row) throw new Error('task insert failed');
  return row;
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

export interface ReportRow {
  task: Task;
  results: (VerificationResult & {
    quoteText: string;
    sourceWorkHint: string | null;
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
    .innerJoin(quote, and(eq(verificationResult.quoteId, quote.id)))
    .where(eq(verificationResult.taskId, taskId));

  return { task: taskRow, results: results as ReportRow['results'] };
}
