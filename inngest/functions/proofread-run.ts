import { inngest } from '@/inngest/client';
import { buildResultIdempotencyKey } from '@/lib/idempotency';

/**
 * 校对主工作流骨架（MS-L-05/06/07 · ADR-002）
 *
 * 本文件当前是**骨架**——按 step.run 分步定好结构 + TODO 占位，让后续 MAS-1~6 直接填肉：
 *
 *   load-task       — 按 taskId 读 task/manuscript/references/user 全量上下文
 *   parse           — mammoth/pdf-parse/epubjs 解析为 paragraph 行（MAS-2）
 *   moderation-gate — DeepSeek /chat/completions 审核拒绝检测（lib/ai/moderation.ts）
 *   extract         — prompt v1/extract.txt → quote 行（MAS-3）
 *   verify          — prompt v1/verify.txt 循环每条 quote → verification_result（MAS-4）
 *   map             — prompt v1/map.txt → result_reference_hit（PARTIAL_MATCH · ADR-011 · MAS-4）
 *   compute-confidence — lib/ai/confidence.ts 三信号融合（ADR-007）
 *   freeze-report   — report_snapshot.frozen_at 写入（real.md #7 · T-01 触发器）
 *
 * idempotency key 关键约束（ADR-002 · memory quote-check-idempotency-key-attempt）：
 *   verify/map 步骤写 verification_result 时必须用 `buildResultIdempotencyKey({taskId, quoteId, attemptN})`；
 *   attemptN = ctx.attempt（Inngest 函数级重试计数，0-based）。
 *   复用旧 key 会被 unique 约束 + DO NOTHING 静默吞掉——这是 memory 重点标注的陷阱。
 *
 * 为什么骨架要尽早落盘：
 *   Inngest Cloud 的 serve 注册需要函数对象存在；先把清单坐实，便于：
 *     (a) 部署链路在 MAS 动工前就能 PUT sync 通过
 *     (b) 手工 inngest.send('task/proofread.requested') 验证 event → handler 链路
 *     (c) 后续 MAS 只动 step.run 内部而不牵动注册层
 *
 * 不做的事（v1.0 范围外）：
 *   - 跨模型交叉校验（confidence.crossModel weight = 0）
 *   - 真实 AI 调用（骨架阶段仅 TODO）
 *   - 部分步骤的并发控制（verify-each-quote 后续会用 step.parallel）
 */
export const proofreadRunFn = inngest.createFunction(
  {
    id: 'task-proofread-run',
    name: 'task · 校对主工作流（骨架）',
    // 整个函数级重试：Inngest 默认 4 次；对于长任务，降低到 2 次避免雪崩式消耗配额
    // 每次 function-level 重试会让 ctx.attempt 递增，驱动新的 idempotency_key
    retries: 2,
    // 并发上限：同 taskId 只允许一个在飞，避免手误重复触发（MS-G-02 暂停/恢复不算双跑）
    concurrency: { key: 'event.data.taskId', limit: 1 },
  },
  { event: 'task/proofread.requested' },
  async ({ event, step, attempt, logger }) => {
    const { taskId, userId, triggeredBy, requestedAt } = event.data;
    logger.info(
      { taskId, userId, triggeredBy, requestedAt, attempt },
      '[proofread-run] 启动 · 骨架占位',
    );

    // ─── S1: load-task ────────────────────────────────────────────────
    // TODO(MAS-1): 查 task + manuscript + references + user；校验 status=VERIFYING；
    //              若 status 非法（COMPLETED/CANCELED）直接 return，不报错（幂等）
    const ctx = await step.run('load-task', async () => {
      // placeholder：返回事件体 + attempt 便于下游 TODO 填充时能编译通过
      return { taskId, userId, attempt, quoteIds: [] as string[] };
    });

    // ─── S2: parse-manuscript ─────────────────────────────────────────
    // TODO(MAS-2): 按 manuscript.mime 走 docx/pdf/epub 解析器；
    //              落 paragraph 行（含 text_normalized：OpenCC 繁简 + 异体字归一）
    await step.run('parse-manuscript', async () => {
      // placeholder
      return { paragraphCount: 0 };
    });

    // ─── S3: moderation-gate ──────────────────────────────────────────
    // TODO(MAS-3): 对稿件抽样或整体做一次 DeepSeek 调用；
    //              若 isModerationRejection() → 写 task.status=REJECTED_BY_MODERATION 并 return
    await step.run('moderation-gate', async () => {
      return { rejected: false as boolean };
    });

    // ─── S4: extract-quotes ───────────────────────────────────────────
    // TODO(MAS-3): prompts/v1/extract.txt + generateObject + zod 宽容 schema；
    //              批量落 quote 行，拿到 quoteIds 传给下游 verify
    await step.run('extract-quotes', async () => {
      return { quoteIds: [] as string[] };
    });

    // ─── S5: verify-each-quote ────────────────────────────────────────
    // TODO(MAS-4): 对每条 quote 走 verify prompt；当前骨架只演示 key 构造契约。
    //              真实实现应：
    //                1. step.run(`verify-${quoteId}`, ...) 或 step.parallel 批次化
    //                2. INSERT verification_result ... idempotency_key=<key> ... ON CONFLICT DO NOTHING
    //                3. stripLlmSelfScores(raw) 先剥离 LLM 自评分（real.md #2）
    //                4. 落 result_reference_hit（可选 M:N）
    for (const quoteId of ctx.quoteIds) {
      const idempotencyKey = buildResultIdempotencyKey({
        taskId: ctx.taskId,
        quoteId,
        attemptN: attempt,
      });
      await step.run(`verify-${quoteId}`, async () => {
        logger.debug({ quoteId, idempotencyKey }, '[proofread-run] verify TODO');
        return { ok: true };
      });
    }

    // ─── S6: map-references ───────────────────────────────────────────
    // TODO(MAS-4): prompts/v1/map.txt → result_reference_hit 批插；
    //              hit=true/false 与 snippet/location_json 一并写入（ADR-011）
    await step.run('map-references', async () => {
      return { hitCount: 0 };
    });

    // ─── S7: compute-confidence ───────────────────────────────────────
    // TODO(MAS-4): 读回 verification_result 全部行，遍历调 computeConfidence(signals)；
    //              UPDATE verification_result SET confidence=... WHERE id=...
    //              注意：T-03 触发器把 confidence 列入 immutable 字段——只能在初次 INSERT 时写入
    //              所以实际应在 S5 插入时就计算好，此 step 仅兜底校验 / 无事
    await step.run('compute-confidence', async () => {
      return { scored: 0 };
    });

    // ─── S8: freeze-report ────────────────────────────────────────────
    // TODO(MAS-5): 生成 report_snapshot 行；写入 frozen_at=now() 后 T-01 触发器接管只读
    //              同步 task.status=COMPLETED，写 audit_log（action=report.frozen）
    const frozenAt = await step.run('freeze-report', async () => new Date().toISOString());

    logger.info({ taskId, frozenAt, attempt }, '[proofread-run] 骨架完成（真实逻辑 TODO）');
    return { ok: true, taskId, frozenAt, attempt };
  },
);
