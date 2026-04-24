import { generateText } from 'ai';
import { z } from 'zod';

import { inngest } from '@/inngest/client';
import { DEFAULT_GENERATION_OPTIONS, MODEL_ID, defaultModel } from '@/lib/ai/client';
import { CONFIDENCE_ALGO_VERSION, computeConfidence } from '@/lib/ai/confidence';
import { PROMPT_VERSION, loadPromptRaw } from '@/lib/ai/prompts';
import { buildResultIdempotencyKey } from '@/lib/idempotency';
import {
  createReportSnapshot,
  getReport,
  getTaskContext,
  saveQuotes,
  saveVerificationResult,
  updateTaskProgress,
  updateTaskStatus,
} from '@/lib/services/task';

// ─── Zod schema: LLM extract output ──────────────────────────────────────────
const ExtractedQuoteSchema = z.object({
  quote: z.string(),
  context_before: z.string().optional().default(''),
  context_after: z.string().optional().default(''),
  author_explanation: z.string().optional().default(''),
  location_hint: z.string().optional().default(''),
  source_work: z.string().optional().default(''),
  para_index: z.number().int().min(0),
  chapter: z.string().optional().default(''),
});
const ExtractOutputSchema = z.array(ExtractedQuoteSchema);

// ─── Zod schema: LLM verify output ───────────────────────────────────────────
const VerifyOutputSchema = z.object({
  quote: z.string(),
  text_accuracy: z.object({
    match_status: z.enum(['match', 'partial', 'mismatch', 'not_found']),
    differences: z.string().default(''),
    original_text: z.string().default(''),
    variant_note: z.string().default(''),
  }),
  interpretation_accuracy: z.object({
    match_status: z.enum(['match', 'partial', 'mismatch', 'not_applicable']),
    differences: z.string().default(''),
    editor_suggestion: z.string().default(''),
  }),
  context_appropriateness: z.object({
    match_status: z.enum(['match', 'partial', 'mismatch', 'not_applicable']),
    differences: z.string().default(''),
    editor_suggestion: z.string().default(''),
  }),
  reference_hits: z
    .array(z.object({ snippet: z.string(), location: z.string().default('') }))
    .default([]),
  overall_remark: z.string().default(''),
});

function llmMatchToDb(
  status: 'match' | 'partial' | 'mismatch' | 'not_found',
): 'MATCH' | 'PARTIAL_MATCH' | 'NOT_MATCH' | 'NOT_FOUND_IN_REF' {
  const map = {
    match: 'MATCH',
    partial: 'PARTIAL_MATCH',
    mismatch: 'NOT_MATCH',
    not_found: 'NOT_FOUND_IN_REF',
  } as const;
  return map[status];
}

function llmMatchToVerdict(
  status: 'match' | 'partial' | 'mismatch' | 'not_found',
): 'MATCH' | 'VARIANT' | 'MISMATCH' | 'NOT_FOUND_IN_REF' {
  const map = {
    match: 'MATCH',
    partial: 'VARIANT',
    mismatch: 'MISMATCH',
    not_found: 'NOT_FOUND_IN_REF',
  } as const;
  return map[status];
}

export const proofreadRunFn = inngest.createFunction(
  {
    id: 'task-proofread-run',
    name: 'task · 校对主工作流',
    retries: 2,
    concurrency: { key: 'event.data.taskId', limit: 1 },
  },
  { event: 'task/proofread.requested' },
  async ({ event, step, attempt, logger }) => {
    const { taskId, userId, triggeredBy, requestedAt } = event.data;
    logger.info({ taskId, userId, triggeredBy, requestedAt, attempt }, '[proofread-run] 启动');

    // ─── S1: load-task ────────────────────────────────────────────────
    const ctx = await step.run('load-task', async () => {
      const context = await getTaskContext(taskId);
      if (!context) throw new Error(`task ${taskId} not found`);

      const { task, paragraphs } = context;
      if (task.status === 'COMPLETED' || task.status === 'CANCELED') {
        logger.info({ taskId, status: task.status }, '[proofread-run] 幂等跳过');
        return null;
      }

      return {
        taskId: task.id,
        manuscriptId: task.manuscriptId,
        userId: task.userId,
        attempt,
        paragraphs,
      };
    });

    if (!ctx) return { ok: true, taskId, skipped: true };

    // ─── S2: moderation-gate ──────────────────────────────────────────
    const moderationResult = await step.run('moderation-gate', async () => {
      // v1.0 骨架：直接通过（MAS-3 填充真实审核调用）
      return { rejected: false };
    });

    if (moderationResult.rejected) {
      await updateTaskStatus(taskId, 'REJECTED_BY_MODERATION');
      return { ok: true, taskId, rejected: true };
    }

    // ─── S3: extract-quotes ───────────────────────────────────────────
    const extracted = await step.run('extract-quotes', async () => {
      const extractPrompt = loadPromptRaw('extract');

      // 拼装书稿文本（[段落N] 格式）
      const manuscriptText = ctx.paragraphs.map((p) => `[段落${p.seq}]\n${p.text}`).join('\n\n');

      const { text: rawOutput } = await generateText({
        model: defaultModel,
        ...DEFAULT_GENERATION_OPTIONS,
        messages: [
          { role: 'system', content: extractPrompt.text },
          { role: 'user', content: manuscriptText },
        ],
      });

      // 提取 JSON（LLM 可能含 markdown 代码块）
      const jsonMatch = rawOutput.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch?.[1] ?? rawOutput.trim();

      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        logger.warn({ rawOutput }, '[proofread-run] extract JSON parse failed');
        return { quotes: [], promptSha: extractPrompt.sha256 };
      }

      const result = ExtractOutputSchema.safeParse(parsed);
      if (!result.success) {
        logger.warn({ issues: result.error.issues }, '[proofread-run] extract schema mismatch');
        return { quotes: [], promptSha: extractPrompt.sha256 };
      }

      return { quotes: result.data, promptSha: extractPrompt.sha256 };
    });

    if (extracted.quotes.length === 0) {
      await updateTaskProgress(taskId, { status: 'COMPLETED', totalQuotes: 0 });
      return { ok: true, taskId, quotesFound: 0 };
    }

    // 落库 quote 行
    const savedQuotes = await step.run('save-quotes', async () => {
      const rows = extracted.quotes.map((q) => {
        const row: {
          paragraphSeq: number;
          quoteText: string;
          kind: 'DIRECT' | 'INDIRECT' | 'NOTED';
          sourceWorkHint?: string;
          locationHint?: string;
          contextWindow?: string;
        } = {
          paragraphSeq: q.para_index,
          quoteText: q.quote,
          kind: 'DIRECT',
        };
        if (q.source_work) row.sourceWorkHint = q.source_work;
        if (q.location_hint) row.locationHint = q.location_hint;
        const ctx =
          q.context_before || q.context_after
            ? `${q.context_before}\n\n${q.context_after}`.trim()
            : undefined;
        if (ctx) row.contextWindow = ctx;
        return row;
      });

      const quotes = await saveQuotes(ctx.manuscriptId, rows);
      await updateTaskProgress(taskId, { status: 'VERIFYING', totalQuotes: quotes.length });
      return quotes.map((q) => ({
        id: q.id,
        quoteText: q.quoteText,
        sourceWorkHint: q.sourceWorkHint ?? '',
        locationHint: q.locationHint ?? '',
        contextWindow: q.contextWindow ?? '',
        authorExplanation:
          extracted.quotes.find((e) => e.quote === q.quoteText)?.author_explanation ?? '',
      }));
    });

    // ─── S4: verify-each-quote ────────────────────────────────────────
    // DG-m2.1：v1.0 串行（Inngest 免费层配额约束）
    const verifyPrompt = loadPromptRaw('verify');
    let verifiedCount = 0;

    for (const q of savedQuotes) {
      const idempotencyKey = buildResultIdempotencyKey({
        taskId: ctx.taskId,
        quoteId: q.id,
        attemptN: attempt,
      });

      await step.run(`verify-${q.id}`, async () => {
        const userMsg = [
          `引用文字：${q.quoteText}`,
          `作者解释：${q.authorExplanation}`,
          `引用前文：${q.contextWindow}`,
          `引用后文：`,
          q.locationHint ? `位置提示：${q.locationHint}` : '',
          `原文来源：${q.sourceWorkHint || '未知'}`,
          `（无参考文献内容可用，请基于已知知识判断）`,
        ]
          .filter(Boolean)
          .join('\n');

        const { text: rawOutput } = await generateText({
          model: defaultModel,
          ...DEFAULT_GENERATION_OPTIONS,
          messages: [
            { role: 'system', content: verifyPrompt.text },
            { role: 'user', content: userMsg },
          ],
        });

        const jsonMatch = rawOutput.match(/```(?:json)?\s*([\s\S]*?)```/);
        const jsonStr = jsonMatch?.[1] ?? rawOutput.trim();

        let verifyResult: z.infer<typeof VerifyOutputSchema> | null = null;
        try {
          const parsedRaw = JSON.parse(jsonStr);
          const parsed = VerifyOutputSchema.safeParse(parsedRaw);
          if (parsed.success) verifyResult = parsed.data;
        } catch {
          logger.warn({ quoteId: q.id }, '[proofread-run] verify JSON parse failed');
        }

        if (!verifyResult) {
          await saveVerificationResult({
            taskId: ctx.taskId,
            quoteId: q.id,
            matchStatus: 'NOT_FOUND_IN_REF',
            verdictTextAccuracy: {
              verdict: 'NOT_FOUND_IN_REF',
              explanation: 'LLM 返回格式异常，无法解析',
            },
            verdictInterpretation: {
              verdict: 'NOT_APPLICABLE',
              explanation: '',
            },
            verdictContext: {
              verdict: 'NOT_APPLICABLE',
              explanation: '',
            },
            confidence: '0',
            confidenceBreakdown: {
              refHit: 0,
              locationValid: 0,
              crossModel: 0,
              weights: { w1: 0.5, w2: 0.5, w3: 0 },
              algoVersion: CONFIDENCE_ALGO_VERSION,
            },
            idempotencyKey,
            attemptCount: attempt + 1,
          });
          return { ok: false };
        }

        // 客观置信度（real.md #2：不用 LLM 自评）
        const refHit = verifyResult.reference_hits.length > 0 ? 1 : 0;
        const locationValid = verifyResult.reference_hits.some((h) => h.location.length > 0)
          ? 1
          : 0;
        const conf = computeConfidence({ refHit, locationValid, crossModel: 0 });

        await saveVerificationResult({
          taskId: ctx.taskId,
          quoteId: q.id,
          matchStatus: llmMatchToDb(verifyResult.text_accuracy.match_status),
          verdictTextAccuracy: {
            verdict: llmMatchToVerdict(verifyResult.text_accuracy.match_status),
            explanation: verifyResult.text_accuracy.differences || verifyResult.overall_remark,
          },
          verdictInterpretation: {
            verdict: (() => {
              const m = verifyResult.interpretation_accuracy.match_status;
              if (m === 'match') return 'CONSISTENT';
              if (m === 'partial') return 'PARTIAL';
              if (m === 'mismatch') return 'DIVERGENT';
              return 'NOT_APPLICABLE';
            })(),
            explanation: verifyResult.interpretation_accuracy.differences,
          },
          verdictContext: {
            verdict: (() => {
              const m = verifyResult.context_appropriateness.match_status;
              if (m === 'match') return 'APPROPRIATE';
              if (m === 'partial') return 'AMBIGUOUS';
              if (m === 'mismatch') return 'OUT_OF_CONTEXT';
              return 'NOT_APPLICABLE';
            })(),
            explanation: verifyResult.context_appropriateness.differences,
          },
          confidence: String(conf.value),
          confidenceBreakdown: {
            refHit: conf.signals.refHit,
            locationValid: conf.signals.locationValid,
            crossModel: conf.signals.crossModel,
            weights: {
              w1: conf.weights.refHit,
              w2: conf.weights.locationValid,
              w3: conf.weights.crossModel,
            },
            algoVersion: conf.algoVersion,
          },
          rawResponseSnapshot: { raw: rawOutput },
          idempotencyKey,
          attemptCount: attempt + 1,
        });

        return { ok: true };
      });

      verifiedCount++;
      await updateTaskProgress(taskId, { verifiedQuotes: verifiedCount });
    }

    // ─── S5: freeze-report ────────────────────────────────────────────
    const frozenAt = await step.run('freeze-report', async () => {
      const report = await getReport(taskId);
      const matchCount = report?.results.filter((r) => r.matchStatus === 'MATCH').length ?? 0;
      const partialCount =
        report?.results.filter((r) => r.matchStatus === 'PARTIAL_MATCH').length ?? 0;
      const notMatchCount =
        report?.results.filter((r) => r.matchStatus === 'NOT_MATCH').length ?? 0;
      const notFoundCount =
        report?.results.filter((r) => r.matchStatus === 'NOT_FOUND_IN_REF').length ?? 0;

      const meanConf =
        report && report.results.length > 0
          ? report.results.reduce((sum, r) => sum + Number(r.confidence), 0) / report.results.length
          : 0;

      await createReportSnapshot({
        taskId,
        frozenAt: new Date(),
        versionStampJson: {
          modelId: MODEL_ID,
          modelProvider: 'siliconflow',
          promptVersions: {
            extract: PROMPT_VERSION,
            verify: PROMPT_VERSION,
            map: PROMPT_VERSION,
          },
          sourceRefsHash: '',
          confidenceAlgoVersion: CONFIDENCE_ALGO_VERSION,
        },
        resultsAggregate: {
          totalQuotes: savedQuotes.length,
          matchCount,
          partialMatchCount: partialCount,
          notMatchCount,
          notFoundCount,
          rejectedByModerationCount: 0,
          meanConfidence: Math.round(meanConf * 1000) / 1000,
        },
      });

      await updateTaskProgress(taskId, {
        status: 'COMPLETED',
        verifiedQuotes: verifiedCount,
      });

      return new Date().toISOString();
    });

    logger.info({ taskId, frozenAt, quotesVerified: verifiedCount }, '[proofread-run] 完成');
    return { ok: true, taskId, frozenAt, quotesVerified: verifiedCount };
  },
);
