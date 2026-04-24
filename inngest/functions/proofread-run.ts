import { generateText } from 'ai';
import { z } from 'zod';

import { inngest } from '@/inngest/client';
import { DEFAULT_GENERATION_OPTIONS, MODEL_ID, defaultModel } from '@/lib/ai/client';
import {
  CONFIDENCE_ALGO_VERSION,
  SIMILARITY_MATCH_THRESHOLD,
  SIMILARITY_PARTIAL_THRESHOLD,
  computeConfidence,
} from '@/lib/ai/confidence';
import { retrievePassagesForQuote } from '@/lib/ai/retrieval';
import { PROMPT_VERSION, loadPromptRaw } from '@/lib/ai/prompts';
import { buildResultIdempotencyKey } from '@/lib/idempotency';
import { listUserReferences } from '@/lib/services/reference';
import {
  createReportSnapshot,
  getReport,
  getTaskContext,
  saveQuotes,
  saveReferenceHits,
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

// LLM 有时返回中文值（"无需比对"/"部分一致"/"不一致"等），需要归一化
function normMatchStatus(
  raw: unknown,
  type: 'text' | 'dim',
): 'match' | 'partial' | 'mismatch' | 'not_found' | 'not_applicable' {
  const s = String(raw ?? '').toLowerCase().trim();
  if (s.includes('not_found') || s.includes('未找到') || s.includes('原文中未找到')) return 'not_found';
  if (s.includes('not_applicable') || s.includes('无需') || s.includes('不适用')) return 'not_applicable';
  if (s.includes('partial') || s.includes('部分') || s.includes('mismatch') || s.includes('不一致') || s.includes('不符')) {
    // 分离 partial vs mismatch
    if (s.includes('partial') || s.includes('部分')) return 'partial';
    return 'mismatch';
  }
  if (s.includes('mismatch') || s.includes('不一致') || s.includes('不符')) return 'mismatch';
  if (s.includes('match') || s.includes('一致') || s.includes('符合')) return 'match';
  return type === 'text' ? 'not_found' : 'not_applicable';
}

const MatchStatusCoerce = z.unknown().transform((v) => normMatchStatus(v, 'text'));
const DimStatusCoerce = z.unknown().transform((v) => normMatchStatus(v, 'dim'));

// ─── Zod schema: LLM verify output ───────────────────────────────────────────
const VerifyOutputSchema = z.object({
  quote: z.string(),
  text_accuracy: z.object({
    match_status: MatchStatusCoerce,
    differences: z.string().default(''),
    original_text: z.string().default(''),
    variant_note: z.string().default(''),
  }),
  interpretation_accuracy: z.object({
    match_status: DimStatusCoerce,
    differences: z.string().default(''),
    editor_suggestion: z.string().default(''),
  }),
  context_appropriateness: z.object({
    match_status: DimStatusCoerce,
    differences: z.string().default(''),
    editor_suggestion: z.string().default(''),
  }),
  reference_hits: z
    .array(z.object({ snippet: z.string(), location: z.string().default('') }))
    .default([]),
  overall_remark: z.string().default(''),
});

function llmMatchToDb(status: string): 'MATCH' | 'PARTIAL_MATCH' | 'NOT_MATCH' | 'NOT_FOUND_IN_REF' {
  if (status === 'match') return 'MATCH';
  if (status === 'partial') return 'PARTIAL_MATCH';
  if (status === 'mismatch') return 'NOT_MATCH';
  return 'NOT_FOUND_IN_REF';
}

function llmMatchToVerdict(status: string): 'MATCH' | 'VARIANT' | 'MISMATCH' | 'NOT_FOUND_IN_REF' {
  if (status === 'match') return 'MATCH';
  if (status === 'partial') return 'VARIANT';
  if (status === 'mismatch') return 'MISMATCH';
  return 'NOT_FOUND_IN_REF';
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
        referenceIds: task.referenceIds,
        attempt,
        paragraphs,
      };
    });

    if (!ctx) return { ok: true, taskId, skipped: true };

    // ─── S1.5: load-references ───────────────────────────────────────
    const refContext = await step.run('load-references', async () => {
      if (ctx.referenceIds.length === 0) return { refs: [] as { id: string; canonicalName: string }[] };
      const allRefs = await listUserReferences(ctx.userId);
      const refs = allRefs
        .filter((r) => ctx.referenceIds.includes(r.id) && r.parsedAt !== null)
        .map((r) => ({ id: r.id, canonicalName: r.canonicalName }));
      return { refs };
    });

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
        // MAS-2: pg_trgm 段落检索
        const passages =
          refContext.refs.length > 0
            ? await retrievePassagesForQuote({
                quoteText: q.quoteText,
                referenceIds: refContext.refs.map((r) => r.id),
              })
            : [];

        // 四态前置计算：有 ref 上传但无段落命中 → NOT_FOUND_IN_REF
        const hasUploadedRefs = refContext.refs.length > 0;
        const topSim = passages[0]?.similarity ?? 0;
        const preMatchStatus: 'MATCH' | 'PARTIAL_MATCH' | 'NOT_MATCH' | 'NOT_FOUND_IN_REF' | undefined =
          !hasUploadedRefs
            ? undefined
            : passages.length === 0
              ? 'NOT_FOUND_IN_REF'
              : topSim >= SIMILARITY_MATCH_THRESHOLD
                ? 'MATCH'
                : topSim >= SIMILARITY_PARTIAL_THRESHOLD
                  ? 'PARTIAL_MATCH'
                  : 'NOT_MATCH';

        // 构建参考原文字段（替换 hardcoded 无参考分支）
        const refContent =
          passages.length > 0
            ? passages.map((p, i) => `参考段落${i + 1}：${p.text}`).join('\n')
            : '（无参考文献内容可用，请基于已知知识判断）';

        const userMsg = [
          `引用文字：${q.quoteText}`,
          `作者解释：${q.authorExplanation}`,
          `引用前文：${q.contextWindow}`,
          q.locationHint ? `位置提示：${q.locationHint}` : '',
          `原文来源：${q.sourceWorkHint || '未知'}`,
          `参考原文内容：\n${refContent}`,
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

        // 多策略 JSON 提取：① 代码块 ② 纯 JSON 起始位置 ③ 全文
        let verifyResult: z.infer<typeof VerifyOutputSchema> | null = null;
        const jsonCandidates: string[] = [];
        const codeBlockMatch = rawOutput.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (codeBlockMatch?.[1]) jsonCandidates.push(codeBlockMatch[1].trim());
        const braceMatch = rawOutput.match(/\{[\s\S]*\}/);
        if (braceMatch?.[0]) jsonCandidates.push(braceMatch[0]);
        jsonCandidates.push(rawOutput.trim());

        for (const candidate of jsonCandidates) {
          try {
            const parsedRaw = JSON.parse(candidate);
            const parsed = VerifyOutputSchema.safeParse(parsedRaw);
            if (parsed.success) {
              verifyResult = parsed.data;
              break;
            }
          } catch {
            // try next candidate
          }
        }

        if (!verifyResult) {
          logger.warn({ quoteId: q.id, rawPreview: rawOutput.slice(0, 200) }, '[proofread-run] verify parse failed');
          const failResult = await saveVerificationResult({
            taskId: ctx.taskId,
            quoteId: q.id,
            matchStatus: 'NOT_FOUND_IN_REF',
            verdictTextAccuracy: {
              verdict: 'NOT_FOUND_IN_REF',
              explanation: 'LLM 返回格式异常，无法解析',
            },
            verdictInterpretation: { verdict: 'NOT_APPLICABLE', explanation: '' },
            verdictContext: { verdict: 'NOT_APPLICABLE', explanation: '' },
            confidence: '0',
            confidenceBreakdown: {
              refHit: 0,
              locationValid: 0,
              crossModel: 0,
              weights: { w1: 0.5, w2: 0.5, w3: 0 },
              algoVersion: CONFIDENCE_ALGO_VERSION,
            },
            rawResponseSnapshot: { raw: rawOutput.slice(0, 2000) },
            idempotencyKey,
            attemptCount: attempt + 1,
          });
          if (failResult && hasUploadedRefs) {
            await saveReferenceHits(
              failResult.id,
              refContext.refs.map((r) => ({ referenceId: r.id, hit: false })),
            );
          }
          return { ok: false };
        }

        // 客观置信度（real.md #2：不用 LLM 自评）
        // 有上传参考时，refHit = top similarity；无时用 LLM reference_hits 作信号
        const refHitSignal = hasUploadedRefs ? topSim : (verifyResult.reference_hits.length > 0 ? 1 : 0);
        const locationValid = hasUploadedRefs
          ? (passages.some((p) => p.paragraphSeq >= 0) ? 1 : 0)
          : (verifyResult.reference_hits.some((h) => h.location.length > 0) ? 1 : 0);
        const conf = computeConfidence({ refHit: refHitSignal, locationValid, crossModel: 0 });

        // matchStatus：有 preMatchStatus 时覆盖 LLM 结果
        const finalMatchStatus = preMatchStatus ?? llmMatchToDb(verifyResult.text_accuracy.match_status);

        const savedResult = await saveVerificationResult({
          taskId: ctx.taskId,
          quoteId: q.id,
          matchStatus: finalMatchStatus,
          verdictTextAccuracy: {
            verdict: llmMatchToVerdict(verifyResult.text_accuracy.match_status),
            explanation: verifyResult.text_accuracy.differences || verifyResult.overall_remark,
          },
          verdictInterpretation: {
            verdict: ((): 'CONSISTENT' | 'PARTIAL' | 'DIVERGENT' | 'NOT_APPLICABLE' => {
              const m = verifyResult.interpretation_accuracy.match_status;
              if (m === 'match') return 'CONSISTENT';
              if (m === 'partial') return 'PARTIAL';
              if (m === 'mismatch') return 'DIVERGENT';
              return 'NOT_APPLICABLE';
            })(),
            explanation: verifyResult.interpretation_accuracy.differences,
          },
          verdictContext: {
            verdict: ((): 'APPROPRIATE' | 'AMBIGUOUS' | 'OUT_OF_CONTEXT' | 'NOT_APPLICABLE' => {
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

        // M:N result_reference_hit 写入
        if (savedResult && hasUploadedRefs) {
          await saveReferenceHits(
            savedResult.id,
            refContext.refs.map((r) => {
              const hit = passages.find((p) => p.referenceId === r.id);
              return {
                referenceId: r.id,
                hit: !!hit,
                ...(hit ? { snippet: hit.text.slice(0, 200), similarity: hit.similarity, retrievalMethod: 'pg_trgm' } : {}),
              };
            }),
          );
        }

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
