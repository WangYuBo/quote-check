---
name: spec-system-architecture
description: 文史类引用校对软件 v1.0 系统架构规约——基于 TypeScript / Next.js 15 / Vercel / Inngest / Neon / Drizzle 栈，把 25 个 MS 锚定到 7 个子系统 + 16 条 ADR
version: v1.0.0-draft
generated_by: dev-system-architecture skill
depends_on:
  - .42cog/meta/meta.md
  - .42cog/cog/cog.md
  - .42cog/real/real.md
  - .42cog/spec/spec-product-requirements.md
  - .42cog/spec/spec-user-story.md
  - notes/260417-engineering-and-ethics-notes.md
stack_lock:
  language: TypeScript 5.x
  framework: Next.js 15 (App Router)
  ui: Tailwind CSS + shadcn/ui
  runtime_dev: Bun
  runtime_prod: Node (Vercel)
  database: PostgreSQL via Neon
  orm: Drizzle ORM
  auth: Better Auth
  ai_sdk: Vercel AI SDK (@ai-sdk/openai with siliconflow baseURL)
  long_tasks: Inngest
  deploy: Vercel
  blob: Vercel Blob
created: 2026-04-18
---

# 系统架构规约（System Architecture）

## 0. 读法

- **上游**：产品规约 `spec-product-requirements.md`（12 affordance）+ 用户故事规约 `spec-user-story.md`（25 MS）
- **本规约**：把 MS 落到**子系统 / 目录 / API / 数据流 / 技术决策**
- **下游**：`dev-database-design` 按本规约的实体 + 联接表出 Drizzle schema；`dev-ui-design` 按本规约的组件边界出高保真；`dev-coding` 按本规约的目录与模块展开
- **关键**：本规约是**栈转向后的起点**——MVP（Python/FastAPI）降级为只读归档，v1.0 断代重写为 TS 栈

---

## 1. Context：为什么换栈、为什么断代重写

### 1.1 栈转向决策

在产品规约与用户故事交付后，原计划走 Python/FastAPI 渐进演进（沿用 `origin/` MVP）。最终选型为：

**TypeScript + Next.js 15 + Tailwind/shadcn/ui + Bun + PostgreSQL(Neon) + Drizzle + Better Auth + Vercel AI SDK + Inngest + Vercel**

### 1.2 驱动因素

1. **部署门槛**：Neon/Vercel 托管替代 PG/Docker/VPS 自托管——一个人项目不背运维负担
2. **类型统一**：TS 前后端同构；Drizzle + Zod + React props 类型贯通
3. **生态成熟度**：shadcn/ui + Better Auth + Vercel AI SDK 是 2025 年 Next.js 栈的事实最佳实践
4. **长任务解**：Inngest 原生支持步骤化重试 + 幂等键 + Realtime，精确匹配 `notes #4`（持久化+幂等+断点续跑）硬约束

### 1.3 代价

- **MVP 变为只读归档**：`origin/` 所有 Python 代码不再演进
- **用户故事 MVP 复用度退化**：`spec-user-story.md` 中 12 条标"已有/改造"的 MS 中除 prompt 外全部退为"全新"——详见附录 D 更新表
- **prompt 是唯一跨语言资产**：3 份 `.txt` 文件 + `_BOOK_NAME_ALIASES` 别名表直搬（后者译为 TS 常量）

### 1.4 不变项

- **cog.md 7 实体** / **real.md 7 约束** / **notes 7 条工程伦理** 与栈无关，完全保留
- **子系统划分** 与前版 plan 一致（SS-1 ~ SS-7），只是实现栈换
- **25 MS 的用户价值锚点** 不变，只是工程锚点换了文件路径

---

## 2. 架构总纲

### 2.1 模式

**Next.js App Router 单仓模块化 + Inngest 外接事件工作流 + Neon 托管 PG**

- **前台**：Next.js 15 App Router，React Server Components 优先，Client Components 只在必要处
- **API**：Route Handlers（短请求）+ Server Actions（表单/变更）
- **后台**：Inngest 函数承担所有长任务（主校对流程、TTL 销毁、费用守卫）
- **数据**：Neon PostgreSQL（主存储）+ Vercel Blob（文件上传/导出）+ Inngest Realtime（SSE 事件流）

### 2.2 部署形态图

```
                         ┌──────────────────────────┐
                         │      Vercel Edge/Node    │
  Browser  ── HTTPS ───▶ │   Next.js 15 (RSC)       │◄── Route Handlers / Server Actions
                         │   + Tailwind + shadcn/ui │
                         └──────┬───────────────────┘
                                │
              ┌─────────────────┼──────────────────────────────┐
              │                 │                              │
              ▼                 ▼                              ▼
     ┌──────────────┐    ┌──────────────┐              ┌──────────────┐
     │ Vercel Blob  │    │   Neon PG    │              │   Inngest    │
     │ (上传/导出)  │    │  (7 实体表)  │              │ (长任务工作流)│
     └──────────────┘    └──────▲───────┘              └──────┬───────┘
                                │                             │
                                │  Drizzle ORM                │  step.run
                                │                             ▼
                                │                     ┌─────────────────┐
                                │                     │  硅基流动 API   │
                                │                     │  DeepSeek V3.2  │
                                │                     └─────────────────┘
                                │                             ▲
                                │                             │ Vercel AI SDK
                                │                             │ (@ai-sdk/openai)
                                └─────────────────────────────┘
```

### 2.3 运行时边界

| 边界 | 形态 | 超时 |
|-----|------|------|
| Route Handler（Node runtime） | 请求-响应，Edge or Node | 300s (Vercel Pro) / 10s (Hobby) |
| Server Action | 请求-响应，Node runtime | 同上 |
| Inngest Function | 事件驱动，步骤化，可断点续跑 | 单 step 默认 120s，可配 |
| SSE Route Handler | 长连接，订阅 Inngest Realtime | 浏览器端断线重连由 Resume Token 处理 |

---

## 3. 技术栈锁定表（不可在下游 skill 自行改动）

| 层 | 选型 | 版本下限 | 关键理由 | 替换条件 |
|---|------|---------|---------|---------|
| 语言 | TypeScript | 5.4+ | 类型一体化；`satisfies` / const type parameters | — |
| 框架 | Next.js | 15.x | App Router + Server Components + Server Actions 完整形态 | — |
| UI | Tailwind CSS + shadcn/ui | Tailwind 4.x / shadcn 最新 | 无运行时依赖；按需 copy 组件 | — |
| 运行时（dev） | Bun | 1.1+ | 装包启动快；`bun test` 可选 | — |
| 运行时（prod） | Node（Vercel） | Vercel managed | — | — |
| 数据库 | PostgreSQL via Neon | PG 15+ | pgbouncer + branching + serverless driver | Supabase 兼容替代 |
| ORM | Drizzle ORM | 0.35+ | SQL 可读 + 类型安全 + 支持 RLS | — |
| 认证 | Better Auth | 最新 | B/C 角色 plugin + email verification + session | — |
| AI SDK | Vercel AI SDK | 4.x+ | `@ai-sdk/openai` 走硅基流动 baseURL | — |
| 长任务 | Inngest | 最新 | step.run + 幂等键 + Realtime | Trigger.dev 兼容替代 |
| 部署 | Vercel | — | Next.js 原生 | 自托管 VPS（v1.1+ 考虑） |
| 文件存储 | Vercel Blob | 最新 | 签名 URL + 元数据 API | R2 / Supabase Storage 兼容替代 |

### 3.1 依赖清单（package.json 主要项，待 dev-coding 细化）

```
dependencies:
  next
  react, react-dom
  tailwindcss, postcss, autoprefixer
  @radix-ui/* (shadcn 底层)
  lucide-react (icons)
  drizzle-orm, @neondatabase/serverless
  better-auth
  ai, @ai-sdk/openai
  zod
  inngest
  @vercel/blob
  pino, pino-pretty
  opencc-js (繁简)
  mammoth (docx 解析)
  unpdf (pdf 解析)
  docx (docx 生成——导出报告)
  date-fns

devDependencies:
  drizzle-kit
  @types/*
  typescript
  eslint, eslint-config-next
  prettier
```

---

## 4. 子系统详目（7 个）

### SS-1：Auth（认证与角色）

**职责**：编辑的注册、登录、会话、角色区分（B 端 / C 端）、账户安全恢复。

**覆盖 MS**：MS-L-01 注册（B/C 角色）、MS-L-02 登录、MS-D-01 登录异常

**组件**：
- `lib/auth.ts` — Better Auth 实例化 + 配置（email provider、session 时长差异化、RBAC 插件）
- `app/api/auth/[...all]/route.ts` — Better Auth 全接管所有 `/api/auth/*` 子路径
- `app/(auth)/login/page.tsx` / `register/page.tsx` — UI
- `middleware.ts`（Next.js middleware） — 未登录访问 `(main)` 路由组的重定向

**接口**：
- **输入**：注册表单（email + password + role）；登录表单
- **输出**：Session cookie（`httpOnly + sameSite=lax + secure`）、`user` 对象（`id / email / role / agreementVersion`）

**依赖**：Neon PG（session 表、user 表）、Vercel Email（邮件验证）

**关键决策**：
- 角色在注册时即落 `user.role = "b_institution" | "c_individual"`，不提供后续修改（盲区 #5）
- B 端 session 时长 4h，C 端 7d——通过 Better Auth `sessionConfig` 按角色分别配置

---

### SS-2：Ingestion（上传与解析）

**职责**：接收书稿文件、解析为结构化段落、落库、返回摘要。

**覆盖 MS**：MS-L-03 上传书稿

**组件**：
- `lib/parsers/docx.ts` — 用 `mammoth`
- `lib/parsers/pdf.ts` — 用 `unpdf`（比 `pdf-parse` 现代；Edge runtime 兼容）
- `lib/parsers/epub.ts` — 用 `epubjs`
- `lib/parsers/index.ts` — 统一 `parseManuscript(file): ParsedManuscript` 入口，按 MIME / 扩展名分发
- `lib/storage/blob.ts` — Vercel Blob 封装（上传 + 签名 URL + `del()` 销毁）
- `app/api/manuscripts/route.ts` — POST 接上传
- `app/(main)/manuscripts/new/page.tsx` — 前端拖拽 UI

**接口**：
- **输入**：`FormData { file: Blob, meta: { role, type } }`
- **输出**：`{ manuscriptId, paragraphCount, quoteHintCount, fileSize, pageCount }`

**依赖**：Vercel Blob、Neon PG（`manuscript` / `paragraph` 表）

**关键决策**：
- 解析在 Server Action 里同步完成（<10s 可达）；超大文件（>20MB）拒绝上传
- PDF 竖排检测：`unpdf` 解析后检查首页行方向，竖排时走特殊切分路径（`notes #3`）
- 文本规范化**在索引匹配时**走 `lib/text/normalize.ts`；**展示时**原文不变（盲区 #10）

---

### SS-3：Corpus（参考文献管理）

**职责**：用户上传参考文献、标注版本角色、在校对时提供检索服务；预留未来外部语料库接入。

**覆盖 MS**：MS-L-04 关联多版本参考

**组件**：
- `lib/corpus/provider.ts` — `SourceCorpusProvider` interface 定义
- `lib/corpus/user-uploaded.ts` — v1.0 唯一实现；基于 `lib/parsers` 解析 + n-gram 相关度检索（从 `origin/app/services/text_retriever.py` 重写）
- `lib/text/aliases.ts` — `BOOK_NAME_ALIASES`（从 Python 译 TS；盲区 #9）
- `app/api/references/route.ts` — POST 上传 / GET 列表
- `app/(main)/references/page.tsx` — 管理 UI

**接口** (Provider):

```typescript
interface SearchResult {
  snippet: string;
  location: { chapter?: string; paragraph?: number; offset: number };
  similarity: number;  // 0..1
  referenceId: string;
}

interface SourceCorpusProvider {
  search(quote: string, canonicalName: string, opts?: { topK?: number }): Promise<SearchResult[]>;
  providerName(): string;
  providerVersion(): string;
}
```

**关键决策**：
- v1.0 只实例化 `UserUploadedCorpus`；未来 `CtextCorpus` / `DaizhigeCorpus` 并行加入走同 interface
- 参考文献的 `canonical_name` 通过 LLM 归一化（走 `map.txt` prompt）
- Provider 的 `search()` 必须过 `lib/text/normalize.ts`（`real.md #4` + `notes #3` 双约束）

---

### SS-4：Verification（核校编排）

**职责**：引文提取、三维度校对、客观置信度融合、审核拒绝检测。这是系统**核心价值流**。

**覆盖 MS**：MS-L-05（发起）、MS-L-06（SSE 进度）、MS-L-07（三维度报告）、MS-D-02（拒绝显式）、MS-D-03（API 重试）、MS-D-04（超额暂停）、MS-D-05（置信度客观化）

**组件**：
- `lib/ai/client.ts` — Vercel AI SDK client，`createOpenAI({ apiKey, baseURL: "https://api.siliconflow.cn/v1" })`
- `lib/ai/prompts.ts` — 启动时读取 `prompts/v1/*.txt`，计算 SHA256 冻结；提供 `getPrompt(name: "extract" | "verify" | "map")` 函数
- `lib/ai/moderation.ts` — `isModerationRejection(response, error)` 检测
- `lib/ai/confidence.ts` — 三信号融合函数 `computeConfidence({refHit, locationValid, crossModel})`
- `inngest/functions/proofread-run.ts` — 主工作流（见下）
- `app/(main)/manuscripts/[id]/page.tsx` — 三维度报告 UI（引用 `components/quote-card`）

**主工作流** `proofread-run`（伪代码）：

```typescript
inngest.createFunction(
  { id: "proofread-run", concurrency: { limit: 3, key: "event.data.userId" } },
  { event: "task/proofread.requested" },
  async ({ event, step }) => {
    const { taskId, manuscriptId, referenceIds } = event.data;

    // 1. 解析确认（快）
    const parsed = await step.run("parse-confirm", () => confirmParsed(manuscriptId));

    // 2. 提取引文（LLM）
    const quotes = await step.run("extract-quotes", async () => {
      return await extractQuotesLLM(parsed.paragraphs, getPrompt("extract"));
    });
    await step.run("persist-quotes", () => persistQuotes(taskId, quotes));

    // 3. 校对每条（LLM）——按 batch + 幂等
    for (const batch of chunk(quotes, 10)) {
      await step.run(`verify-batch-${batch[0].id}`, async () => {
        for (const quote of batch) {
          await verifyQuote({
            quote,
            referenceIds,
            idempotencyKey: `${taskId}_${quote.id}_${attempt}`,
          });
          await publishProgress(taskId, { type: "verify_progress", ... });
        }
      });

      // 费用守卫检查
      await step.sendEvent("cost-guard-check", { name: "task/cost.check", data: { taskId } });
    }

    // 4. 冻结报告
    await step.run("freeze-report", () => freezeReport(taskId));
    await publishProgress(taskId, { type: "completed" });
  }
);
```

**关键决策**：
- **Inngest step 粒度**：一个 step = 一批 10 条引文（`chunk(quotes, 10)`）。平衡 Inngest 步骤数限额 vs 幂等粒度（盲区 #2）
- **Vercel AI SDK `generateObject`**：用 Zod schema 做结构化校验；但 schema 设计为宽松（允许 `unknown` 字段）防模型输出抖动（盲区 #10）
- **审核拒绝**：`isModerationRejection` 在 `generateObject` 抛错时检查错误签名；识别后结果状态直写 `REJECTED_BY_MODERATION`，不再重试
- **置信度 v1.0 权重**：`w1=0.5`（参考命中度）+ `w2=0.5`（原文定位）+ `w3=0`（跨模型，v1.0 不做跨模型调用以控费）
- **进度推送**：通过 Inngest Realtime `step.publish("task.progress", {...})`；SSE 端点订阅（见 SS-5）

---

### SS-5：Task Lifecycle（任务生命周期）

**职责**：任务状态机、费用预估与守卫、SSE 进度、断点续跑、取消。

**覆盖 MS**：MS-L-05（发起+预估）、MS-L-06（SSE）、MS-D-04（超额暂停）、MS-G-02（续跑）、MS-L-08（失败重试）

**组件**：
- `lib/db/schema.ts` 中的 `task` 表（状态字段 + 费用字段 + 幂等键）
- `inngest/functions/cost-guard.ts` — 费用守卫定时任务
- `app/api/tasks/estimate/route.ts` — 费用预估
- `app/api/tasks/route.ts` — POST 发起
- `app/api/tasks/[id]/stream/route.ts` — SSE 端点
- `app/api/tasks/[id]/pause/route.ts` / `cancel/route.ts` / `resume/route.ts`

**状态机**：

```
    pending ──► parsing ──► extracting ──► verifying ──► completed
                              │                │            │
                              │                │            ▼
                              │                │        (report_frozen)
                              │                │
                              │                ▼
                              │          paused_by_cost (MS-D-04)
                              │                │
                              │                ├──► resume→ verifying
                              │                └──► cancel → cancelled
                              │
                              └──► failed (global)
                              └──► cancelled (user)
                              └──► rejected_partial (部分条审核拒绝但整体完成)
```

**SSE 契约**：

```typescript
// 事件类型（客户端 EventSource 接收）
type ProgressEvent =
  | { type: "parse_done";      data: { paragraphCount } }
  | { type: "extract_done";    data: { quoteCount } }
  | { type: "verify_progress"; data: { current, total, costAccumulated } }
  | { type: "retry_scheduled"; data: { quoteId, nextAttemptInSec, reason } }
  | { type: "cost_alert";      data: { ratio, action: "paused" | "warning" } }
  | { type: "task_completed";  data: { reportId } }
  | { type: "heartbeat";       data: { timestamp } };

// Resume Token: base64({ taskId, lastEventSeq })
// 客户端在 EventSource 的 Last-Event-ID header 中带上，服务端从 seq+1 续推
```

**关键决策**：
- **费用预估公式**：`estimatedCost = avgTokensPerQuote × estimatedQuoteCount × pricePerToken`；`estimatedQuoteCount` 从段落数 × `quoteRate`（历史均值）
- **断点续跑**：任务表 `lastCompletedQuoteId` + Inngest 的 `event.id` 幂等——服务重启后由 Inngest 自动续跑最后未完成 step
- **SSE 实现**：Route Handler 返回 `ReadableStream`，内部 `await` Inngest `subscribe()`；客户端断开时 cleanup 订阅
- **Resume 事件缓存**：最近 100 条 event 缓存在 Inngest（不落 PG，盲区 #6 平衡）

---

### SS-6：Report（报告与导出）

**职责**：报告内容冻结、版本戳生成、历史列表、Word/CSV 导出、新旧版本对比。

**覆盖 MS**：MS-L-07（三维度呈现）、MS-L-09（版本戳冻结）、MS-L-10（打开历史）、MS-G-03（新旧对比）、MS-G-04（筛选历史）、MS-L-12（Word 导出）、MS-L-13（CSV 导出）、MS-D-07（导出失败）

**组件**：
- `lib/version-stamp.ts` — 生成 `VersionStamp = { modelId, promptVersions, sourceRefsHash, confidenceAlgoVersion, frozenAt }`
- `app/api/reports/route.ts` — GET 列表（带筛选）
- `app/api/reports/[id]/route.ts` — GET 详情
- `app/api/reports/[id]/export/word/route.ts` — 用 `docx` 库生成
- `app/api/reports/[id]/export/csv/route.ts` — native CSV
- `app/api/reports/[id]/compare/[otherId]/route.ts` — 对比视图
- `components/quote-card` — 三维度卡片（核心 UI 组件）
- `components/version-stamp` — 版本戳展示
- `components/reference-hit-panel` — PARTIAL_MATCH 命中详情

**数据模型要点**：
- `verification_result` 表：三维度独立列 `verdict_text_accuracy` / `verdict_interpretation` / `verdict_context`（JSONB 存问题描述+建议+置信度分项）
- `result_reference_hit` 联接表：`(result_id, reference_id, hit: bool, snippet, location)` —— PARTIAL_MATCH 的载体（ADR-011）
- `report_snapshot` 表：冻结字段 `version_stamp_json / created_at` 只读

**关键决策**：
- **版本戳字段**：`modelId="deepseek-ai/DeepSeek-V3.2"` + `promptVersions={extract: sha256, verify: sha256, map: sha256}` + `sourceRefsHash=sha256([参考内容hash...].join)` + `confidenceAlgoVersion="v1.0"` + `frozenAt=ISO`
- **导出分片**：报告 >500 条时 Word/CSV 按 500 分文件 + zip（盲区 #8 分页）
- **只读强制**：`report_snapshot` 表加 PG 触发器 `BEFORE UPDATE → RAISE EXCEPTION`（ADR-006）

---

### SS-7：Privacy & Observability（保密与可观测性）

**职责**：协议弹窗、TTL 销毁、用户主动销毁、日志脱敏、审计留痕、健康检查。

**覆盖 MS**：MS-L-11（协议弹窗）、MS-G-05（TTL 销毁）、MS-D-06（主动销毁）

**组件**：
- `app/api/privacy/agreement/route.ts` — GET 协议版本 / POST 同意记录
- `app/api/privacy/manuscripts/[id]/destroy/route.ts` — POST 主动销毁
- `inngest/functions/ttl-destroy.ts` — Inngest Cron（每 10min）扫 TTL 到期任务
- `components/agreement-dialog` — 弹窗 UI（B/C 差异化）
- `lib/logger.ts` — Pino + redaction 配置
- `app/api/admin/health/route.ts` — 健康检查
- `lib/db/schema.ts` 中的 `audit_log` 表

**TTL 销毁脚本要点**：

```typescript
// inngest/functions/ttl-destroy.ts
inngest.createFunction(
  { id: "ttl-destroy" },
  { cron: "*/10 * * * *" },  // 每 10 分钟
  async ({ step }) => {
    const tasks = await step.run("scan-expired", () => findTasksPastTTL());
    for (const task of tasks) {
      await step.run(`destroy-${task.id}`, async () => {
        await del(task.manuscriptBlobUrl);           // Vercel Blob del()
        await delMany(task.referenceBlobUrls);
        await clearParseCache(task.id);
        await clearApiResponseSnapshots(task.id);
        await markDestroyed(task.id);                // 任务标 destroyed=true
        await auditLog({ op: "ttl_destroy", taskId: task.id });
        // 注意：不删 verification_result / report_snapshot（real.md #7）
      });
    }
  }
);
```

**日志脱敏（Pino redact）**：

```typescript
// lib/logger.ts
export const logger = pino({
  redact: {
    paths: [
      "*.manuscriptText",
      "*.quoteText",
      "*.referenceSnippet",
      "*.context",
      "req.body.text",
      "res.body.*.quote",
      "res.body.*.snippet",
    ],
    censor: "[REDACTED]",
  },
});
```

**关键决策**：
- 协议弹窗在注册后首次访问主应用时拦截（Next.js middleware 检查 `user.agreementVersion < CURRENT_AGREEMENT_VERSION`）
- B 端协议含"机构条款"块；C 端简化版；通过角色字段切换组件
- 审计日志**只含元数据**（op, taskId, userId, timestamp），绝不含原文

---

## 5. 目录结构

（完整结构见 §5.1；关键约定见 §5.2）

### 5.1 完整目录

```
/（项目根）
├── app/                                    # Next.js App Router 路由
│   ├── (auth)/                             # 未登录路由组
│   │   ├── login/page.tsx                  # MS-L-02
│   │   └── register/page.tsx               # MS-L-01
│   ├── (main)/                             # 已登录路由组
│   │   ├── layout.tsx                      # Auth guard + shell
│   │   ├── page.tsx                        # 工作台
│   │   ├── manuscripts/
│   │   │   ├── new/page.tsx                # 上传
│   │   │   └── [id]/page.tsx               # 详情+三维度报告
│   │   ├── tasks/[id]/
│   │   │   ├── page.tsx                    # SSE 进度页
│   │   │   └── results/page.tsx            # 结果页
│   │   ├── reports/
│   │   │   ├── page.tsx                    # 历史列表
│   │   │   ├── [id]/page.tsx               # 历史报告
│   │   │   └── [id]/compare/[other]/page.tsx # 对比
│   │   ├── references/page.tsx             # 参考库
│   │   └── settings/page.tsx
│   ├── api/                                # Route Handlers
│   │   ├── auth/[...all]/route.ts
│   │   ├── manuscripts/route.ts
│   │   ├── references/route.ts
│   │   ├── tasks/
│   │   │   ├── route.ts
│   │   │   ├── estimate/route.ts
│   │   │   └── [id]/
│   │   │       ├── stream/route.ts
│   │   │       ├── pause/route.ts
│   │   │       ├── resume/route.ts
│   │   │       ├── cancel/route.ts
│   │   │       └── retry-failed/route.ts
│   │   ├── reports/
│   │   │   ├── route.ts
│   │   │   ├── [id]/route.ts
│   │   │   ├── [id]/export/word/route.ts
│   │   │   ├── [id]/export/csv/route.ts
│   │   │   └── [id]/compare/[other]/route.ts
│   │   ├── privacy/
│   │   │   ├── agreement/route.ts
│   │   │   └── manuscripts/[id]/destroy/route.ts
│   │   ├── admin/
│   │   │   ├── health/route.ts
│   │   │   └── metrics/route.ts
│   │   └── inngest/route.ts                # Inngest serve handler
│   ├── layout.tsx                          # Root layout
│   └── globals.css
├── components/                             # React 组件
│   ├── ui/                                 # shadcn/ui 基元
│   ├── quote-card/                         # 三维度卡片
│   ├── reference-hit-panel/                # PARTIAL_MATCH 面板
│   ├── progress-stream/                    # SSE 客户端
│   ├── agreement-dialog/                   # 协议弹窗
│   ├── version-stamp/                      # 版本戳展示
│   └── cost-estimate-dialog/               # 费用预估弹窗
├── lib/                                    # 业务逻辑（无 framework 依赖优先）
│   ├── auth.ts
│   ├── db/
│   │   ├── schema.ts                       # Drizzle table 定义
│   │   ├── index.ts                        # db client
│   │   └── migrations/                     # drizzle-kit 生成
│   ├── ai/
│   │   ├── client.ts
│   │   ├── prompts.ts
│   │   ├── moderation.ts
│   │   └── confidence.ts
│   ├── corpus/
│   │   ├── provider.ts
│   │   └── user-uploaded.ts
│   ├── text/
│   │   ├── normalize.ts
│   │   └── aliases.ts
│   ├── parsers/
│   │   ├── docx.ts
│   │   ├── pdf.ts
│   │   ├── epub.ts
│   │   └── index.ts
│   ├── storage/
│   │   └── blob.ts
│   ├── version-stamp.ts
│   ├── idempotency.ts
│   ├── logger.ts
│   ├── errors.ts
│   └── utils.ts
├── inngest/
│   ├── client.ts
│   ├── functions/
│   │   ├── proofread-run.ts                # 主工作流
│   │   ├── ttl-destroy.ts                  # Cron
│   │   └── cost-guard.ts
│   └── events.ts                           # 事件类型
├── prompts/                                # 只读冻结
│   └── v1/
│       ├── extract.txt                     # origin/ 直搬
│       ├── verify.txt                      # origin/ 搬+措辞改造
│       └── map.txt                         # origin/ 直搬
├── public/
├── tests/
│   ├── unit/
│   └── integration/
├── scripts/
│   ├── migrate.ts
│   ├── seed.ts
│   └── freeze-prompts.ts                   # 启动时 hash 验证
├── origin/                                 # Python MVP（只读归档）
│   └── README-archive.md                   # 说明本目录已冻结
├── drizzle.config.ts
├── next.config.ts
├── package.json
├── bun.lockb
├── tsconfig.json
├── middleware.ts                           # 全局 middleware（auth guard）
├── .env.example
└── README.md
```

### 5.2 关键目录约定

| 目录 | 规则 | 为什么 |
|------|------|-------|
| `app/` | 仅放 Next.js 特定文件（`page.tsx` / `layout.tsx` / `route.ts`） | App Router 规范 |
| `components/` | React 组件；按 feature 分子目录；`ui/` 放 shadcn 基元 | 未按技术类型（hooks/forms）分，按可辨识的用户面 feature 分 |
| `lib/` | 纯业务逻辑；**不 import `next/*` 或 React**（除非必要） | 保持可测试性；`lib/*` 可被 Inngest function / Route Handler / Server Action 共用 |
| `inngest/` | 所有后台工作流 | 集中 Inngest 函数，避免散落 |
| `prompts/v1/` | 只读；SHA256 在启动时计算并缓存 | 版本锁定（ADR-012） |
| `origin/` | **绝对只读**；不再任何修改 | 栈转向后的历史归档（ADR-000 本次转向） |

### 5.3 命名规范

- 文件：`kebab-case.ts`（e.g. `user-uploaded.ts`）
- React 组件：`PascalCase.tsx`（e.g. `QuoteCard.tsx`）
- DB 列：`snake_case`；TS interface 字段：`camelCase`；通过 Drizzle schema 映射
- 错误码：`SCREAMING_SNAKE`（e.g. `REJECTED_BY_MODERATION`）
- Inngest 事件名：`domain/action.state` 三段式（e.g. `task/proofread.requested`）

---

## 6. API 设计

### 6.1 Route Handlers（简表）

```
/api/auth/[...all]            → Better Auth 接管（register/login/logout/session）
/api/privacy/agreement        → GET/POST
/api/privacy/manuscripts/:id/destroy → POST （MS-D-06）

/api/manuscripts              → POST 上传（MS-L-03）
/api/manuscripts/:id          → GET / DELETE

/api/references               → POST 上传 / GET 列表（MS-L-04）
/api/references/:id           → DELETE

/api/tasks/estimate           → POST 费用预估（MS-L-05）
/api/tasks                    → POST 发起（MS-L-05） / GET 列表
/api/tasks/:id                → GET 详情
/api/tasks/:id/stream         → GET SSE（MS-L-06）
/api/tasks/:id/pause          → POST（MS-G-02）
/api/tasks/:id/resume         → POST
/api/tasks/:id/cancel         → POST
/api/tasks/:id/retry-failed   → POST（MS-L-08）

/api/reports                  → GET 列表（MS-G-04）
/api/reports/:id              → GET 详情（MS-L-10）
/api/reports/:id/export/word  → POST / GET（MS-L-12）
/api/reports/:id/export/csv   → POST / GET（MS-L-13）
/api/reports/:id/compare/:otherId → GET（MS-G-03）

/api/admin/health             → GET
/api/admin/metrics            → GET（admin-only）

/api/inngest                  → Inngest serve handler
```

### 6.2 API 端点模板（以 POST /api/tasks 为例）

```markdown
### POST /api/tasks

**Description**: 发起校对任务（需已预估 + 二次确认 token）

**Auth**: Required (session cookie)

**Request**:
- Body (JSON):
  ```json
  {
    "manuscriptId": "string",
    "referenceIds": ["string", ...],
    "estimateToken": "string",       // 来自 /estimate 的签名 token
    "acceptedCostCap": 50.00         // 用户确认的上限
  }
  ```

**Response**:
- 200 OK:
  ```json
  {
    "taskId": "string",
    "status": "pending",
    "versionStampPlaceholder": { ... }
  }
  ```
- 400 INVALID_INPUT | ESTIMATE_EXPIRED | COST_CAP_MISMATCH
- 401 UNAUTHORIZED
- 402 AGREEMENT_NOT_ACCEPTED
- 409 DUPLICATE_TASK
- 429 RATE_LIMITED
```

### 6.3 Inngest 事件契约

```typescript
// inngest/events.ts
export type Events = {
  "task/proofread.requested": {
    data: {
      taskId: string;
      manuscriptId: string;
      referenceIds: string[];
      userId: string;
      estimatedCost: number;
      costCap: number;
    };
  };
  "task/cost.check": {
    data: { taskId: string };
  };
  "task/proofread.paused": {
    data: { taskId: string; reason: "cost_exceeded" | "user_request" };
  };
  "task/proofread.resumed": {
    data: { taskId: string };
  };
  "task/progress": {
    data: { taskId: string; progress: ProgressEvent };  // 推送到 Realtime
  };
  "task/ttl.expired": {
    data: { taskId: string };
  };
};
```

### 6.4 错误码枚举

```typescript
// lib/errors.ts
export enum ErrorCode {
  // Auth
  UNAUTHORIZED = "UNAUTHORIZED",
  SESSION_EXPIRED = "SESSION_EXPIRED",
  AGREEMENT_NOT_ACCEPTED = "AGREEMENT_NOT_ACCEPTED",
  // Input
  INVALID_INPUT = "INVALID_INPUT",
  FILE_TOO_LARGE = "FILE_TOO_LARGE",
  UNSUPPORTED_FORMAT = "UNSUPPORTED_FORMAT",
  // Task
  ESTIMATE_EXPIRED = "ESTIMATE_EXPIRED",
  COST_CAP_MISMATCH = "COST_CAP_MISMATCH",
  COST_EXCEEDED = "COST_EXCEEDED",
  DUPLICATE_TASK = "DUPLICATE_TASK",
  TASK_NOT_FOUND = "TASK_NOT_FOUND",
  TASK_NOT_RESUMABLE = "TASK_NOT_RESUMABLE",
  // Verification
  REJECTED_BY_MODERATION = "REJECTED_BY_MODERATION",
  RATE_LIMITED = "RATE_LIMITED",
  API_ERROR = "API_ERROR",
  PARSE_ERROR = "PARSE_ERROR",
  NO_SOURCE_IN_REF = "NO_SOURCE_IN_REF",
  // Report
  REPORT_FROZEN = "REPORT_FROZEN",
  EXPORT_FAILED = "EXPORT_FAILED",
  // System
  INTERNAL_ERROR = "INTERNAL_ERROR",
}
```

---

## 7. 数据流图

### 7.1 主流程：上传 → 校对 → 报告

```
Browser                  Next.js                  Inngest                DeepSeek/Neon
──────────────────────────────────────────────────────────────────────────────────
  │
  │─ POST /api/manuscripts ──▶│
  │    (Server Action)        │─ parseManuscript() ──▶ lib/parsers ──▶ Vercel Blob
  │                           │                                       Neon (paragraph)
  │◄── manuscriptId ──────────│
  │
  │─ POST /api/references ──▶│ ...(同上)
  │
  │─ POST /api/tasks/estimate ▶ │ 估算 + 签 estimateToken
  │◄── {cost, token} ─────────│
  │
  │─ POST /api/tasks ───────▶│ verify token ──▶ create task (pending)
  │                           │                 send event "task/proofread.requested"
  │                           │                                       │
  │                           │                                       ▼
  │                           │                                 ┌──────────────┐
  │                           │                                 │ step: parse  │
  │                           │                                 │   confirm    │
  │                           │                                 └──────┬───────┘
  │                           │                                        ▼
  │                           │                                 ┌──────────────┐
  │                           │                                 │ step: extract│─▶ DeepSeek
  │                           │                                 │   quotes     │
  │                           │                                 └──────┬───────┘
  │                           │                                        ▼
  │─ GET /api/tasks/:id/stream│                                 ┌──────────────┐
  │    (SSE)                  │─ subscribe Realtime ──◄────────▶│ step: verify │─▶ DeepSeek
  │◄── progress events ───────│                                 │   batches... │
  │    (ReadableStream)       │                                 └──────┬───────┘
  │                           │                                        │
  │                           │                                        ▼
  │                           │                                 ┌──────────────┐
  │                           │                                 │ step: freeze │─▶ Neon
  │                           │                                 │   report     │   (result + version_stamp)
  │                           │                                 └──────┬───────┘
  │                           │                                        ▼
  │◄── task_completed ─────── │◄── publish completed ─────────────────┘
  │
  │─ GET /api/reports/:id ──▶│─ read report_snapshot ──▶ Neon
  │◄── full report ──────────│
```

### 7.2 断点续跑（服务崩溃恢复）

```
┌─────────────────────────────────────────────────────────────┐
│ Scenario: Inngest step 执行中 Vercel function 崩溃           │
│                                                              │
│ Inngest detects failure → 自动按 retry policy 重调 step       │
│   ├── step 有幂等键 → 跳过已完成工作                         │
│   └── 继续从上次 step 断点                                   │
│                                                              │
│ 用户侧：SSE 断线 → 客户端 EventSource 自动重连              │
│   └── 带 Last-Event-ID → 服务端从 seq+1 续推                │
└─────────────────────────────────────────────────────────────┘
```

### 7.3 TTL 销毁（Inngest Cron）

```
┌──────────────────────────────────────────────────────────────┐
│ cron: "*/10 * * * *"                                         │
│                                                              │
│ step 1: scan tasks WHERE ttl_expires_at < now()              │
│ step 2: for each task:                                       │
│   2a. del(blobUrl) × N （上传文件 + 参考文件）               │
│   2b. clear parse_cache                                      │
│   2c. clear api_response_snapshots                           │
│   2d. UPDATE task SET destroyed_at = now()                  │
│   2e. 保留 verification_result + report_snapshot            │
│   2f. auditLog(ttl_destroy)                                  │
└──────────────────────────────────────────────────────────────┘
```

---

## 8. 架构决策记录（16 条 ADR）

### ADR-001：Next.js 15 App Router

**Status**: Accepted

**Context**: 需要 React 同构渲染 + 现代路由 + Server Components 降低客户端 JS 负担。

**Decision**: 使用 Next.js 15 App Router；Server Components 优先；Client Components 用 `"use client"` 显式标注；避免 Pages Router。

**Consequences**:
- ✅ RSC 自动代码拆分，首屏 JS 小
- ✅ Server Actions 取代部分 Route Handler
- ⚠️ 学习成本：团队（当前 1 人）需熟悉 RSC 数据获取模式
- ⚠️ 某些库（zustand 等）需小心使用上下文边界

---

### ADR-002：Inngest 承担所有长任务

**Status**: Accepted

**Context**: Vercel Serverless 函数默认超时 10s（Hobby）/ 300s（Pro）；一次完整校对需 10-30 分钟，远超限制。`notes #4` 硬约束要求持久化 + 幂等 + 断点续跑。

**Decision**: 所有超过单请求能完成的任务走 Inngest。主工作流 `proofread-run` 按 step 切分（每 step 处理一批引文），内置幂等键 `{taskId}_{quoteId}_{attempt}`。

**Consequences**:
- ✅ 破解 Vercel serverless 超时；`notes #4` 一站达成
- ✅ Inngest dashboard 天然提供任务历史 / 失败重试 / 可视化
- ⚠️ 免费层有事件数/步骤数限额——需在 v1.0 评估 10 万字书稿能否跑进免费层（盲区 #2）
- ⚠️ 新增外部依赖（Inngest Cloud）

---

### ADR-003：Neon Postgres + Drizzle ORM

**Status**: Accepted

**Context**: 需要托管型 PostgreSQL（免运维）+ 类型安全 ORM。

**Decision**: Neon 作主库（serverless driver + pgbouncer + 分支数据库）；Drizzle ORM 操作。schema 统一在 `lib/db/schema.ts`；迁移用 `drizzle-kit generate`。

**Consequences**:
- ✅ 零运维，冷启动优化（Neon serverless driver）
- ✅ Drizzle 类型推导精确到字段；JSONB 类型保留 TS 原型
- ⚠️ 数据库分支（dev/main）的迁移同步需流程化（盲区 #4）
- ⚠️ 冷启动偶发延迟（Neon 首次连接 ~500ms）

---

### ADR-004：Better Auth 角色模型

**Status**: Accepted

**Context**: 双用户（B 端机构 / C 端个人），需要注册区分、session 时长差异化、未来扩展 admin。

**Decision**:
- 注册时表单选项区分 `role: "b_institution" | "c_individual"`，落 `user.role`
- Better Auth `sessionConfig` 按 `role` 配置：B=4h / C=7d
- RBAC 插件管 admin 角色
- 角色一经确定**不允许自助切换**（盲区 #5）

**Consequences**:
- ✅ UI 侧可按 `role` 切换协议弹窗形态、工作台样式
- ⚠️ 误选角色的用户需联系客服切换——v1.0 可接受

---

### ADR-005：Vercel AI SDK + DeepSeek（via 硅基流动）

**Status**: Accepted

**Context**: 需要结构化 JSON 输出 + 多 provider 抽象 + 流式支持。硅基流动 API 是 OpenAI 兼容端点。

**Decision**:
```typescript
// lib/ai/client.ts
import { createOpenAI } from "@ai-sdk/openai";
export const deepseek = createOpenAI({
  apiKey: process.env.SILICONFLOW_API_KEY,
  baseURL: "https://api.siliconflow.cn/v1",
});

// 使用
import { generateObject } from "ai";
const { object } = await generateObject({
  model: deepseek("deepseek-ai/DeepSeek-V3.2"),
  schema: z.object({ ... }),
  prompt: "...",
});
```

**Consequences**:
- ✅ Zod schema 自动做结构校验
- ✅ 未来替换成 Qwen/Claude 只需换 client
- ⚠️ `generateObject` 一次性返回，无流式逐字段——UI 侧无法边跑边显示（盲区 #1）；接受此限制，SSE 用于进度推送
- ⚠️ 严格 schema 对 LLM 抖动不宽容——需设计宽松 schema + 手工清洗（盲区 #10）

---

### ADR-006：版本戳只读约束（双层）

**Status**: Accepted

**Context**: `real.md #7` + `notes #7` 要求报告冻结后不可变；仅 Drizzle 层约束可被绕过。

**Decision**:
- **应用层**：`report_snapshot` 表的 schema 不 export `update` 方法；所有写操作走 `insert` 或不写
- **数据库层**：迁移脚本里手写 SQL 触发器

```sql
CREATE OR REPLACE FUNCTION prevent_report_update()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'report_snapshot rows are immutable once frozen';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER report_snapshot_immutable
BEFORE UPDATE OR DELETE ON report_snapshot
FOR EACH ROW
WHEN (OLD.frozen_at IS NOT NULL)
EXECUTE FUNCTION prevent_report_update();
```

**Consequences**:
- ✅ 双重保险，应用 bug 也打不破 DB 约束
- ⚠️ 迁移/测试时需临时禁用触发器（脚本提供开关）

---

### ADR-007：客观置信度三信号融合

**Status**: Accepted

**Context**: `real.md #2` 硬约束要求置信度**不得由 AI 自评**。MVP 的 `raw.get("confidence")` 违规。

**Decision**: `confidence = 0.5 × refHit + 0.5 × locationValid + 0 × crossModel`

- `refHit`：引文在参考文献中的归一化相似度（`lib/text/normalize.ts` 规范化后做 n-gram 相似）
- `locationValid`：返回的参考定位（书名/章节/段落）是否真实存在于上传参考的元数据
- `crossModel`：v1.0 设权重为 0（跨模型调用费用翻倍，v1.0 不做）

**Consequences**:
- ✅ 根除 `raw.get("confidence")` 依赖
- ✅ 每条结果可追溯置信度分项（UI 可展开显示）
- ⚠️ v1.0 无 `crossModel`——置信度相对单一，v1.1 可加入 Qwen 作 cross-check

---

### ADR-008：审核拒绝检测

**Status**: Accepted

**Context**: `notes #1` 要求国产 AI 审核拒绝必须显式，不得伪装成"通过"或混入"API 错误"。

**Decision**: `lib/ai/moderation.ts` 提供 `isModerationRejection(error: unknown, response?: Response): boolean`，三信号组合判定：

```typescript
export function isModerationRejection(error: unknown, response?: Response): boolean {
  // 1. 状态码
  if (response?.status === 400 || response?.status === 451) { /* check body */ }
  // 2. 响应体签名（硅基流动特定错误 JSON）
  // 3. 关键词特征（"sensitive_content" / "审核未通过" / "moderation"）
  return /* 三者任一命中 */;
}
```

在 `verifyQuote()` 捕获错误 → 调用 `isModerationRejection` → 是则结果状态 `REJECTED_BY_MODERATION`，不计入重试、不消耗幂等槽。

**Consequences**:
- ✅ `notes #1` 显式达成
- ✅ UI 橙色卡片 + 禁用"采纳建议"（MS-D-02 AC3）
- ⚠️ 硅基流动错误签名可能调整——需版本化 `moderationSignatures` 并监控

---

### ADR-009：SSE via Inngest Realtime

**Status**: Accepted

**Context**: 长任务进度推送需跨 Vercel serverless 边界；Inngest 原生有 Realtime 能力。

**Decision**:
- 后台：`proofread-run` 函数通过 `step.publish(event)` 发布进度
- 前台：`app/api/tasks/[id]/stream/route.ts` 返回 `ReadableStream`
- 内部：用 Inngest 的 `subscribe({ event, filter })` 订阅；转为 SSE event-stream 格式推送给浏览器

参考实现（伪码）：
```typescript
export async function GET(req: Request, { params }) {
  const stream = new ReadableStream({
    async start(controller) {
      const sub = await inngest.subscribe({
        event: "task/progress",
        filter: { taskId: params.id },
      });
      for await (const msg of sub) {
        controller.enqueue(`data: ${JSON.stringify(msg.data)}\n\n`);
      }
    },
    cancel() { sub.close(); }
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream" },
  });
}
```

**Consequences**:
- ✅ 跨进程进度推送不需自建消息总线
- ⚠️ Inngest Realtime 在免费层有连接数限额——需监控（盲区 #6）
- ⚠️ Resume Token：最近 100 条 event 缓存于 Inngest；用户长时间断线后历史 event 会丢

---

### ADR-010：Vercel Blob 作文件存储

**Status**: Accepted

**Context**: 需要上传书稿/参考 + 导出报告文件；Vercel 部署下 Blob 是首选。

**Decision**: `lib/storage/blob.ts` 封装所有 Blob API 调用（`put` / `del` / `list`）；签名 URL 默认 24h 有效期；元数据（blobUrl, taskId, uploadedAt）落 PG。

**Consequences**:
- ✅ 零外部配置
- ⚠️ Blob 无自动删除——TTL 销毁需主动调 `del()`（盲区 #3 - ADR-013 兑现）
- ⚠️ Blob 单文件上限 500MB（v1.0 书稿上限 20MB，充足）

---

### ADR-011：PARTIAL_MATCH 数据模型

**Status**: Accepted

**Context**: 用户故事 §8.2 决定用"PARTIAL_MATCH + 逐一命中清单"策略。需要在数据层承载。

**Decision**: 引入 `result_reference_hit` 联接表：

```
result_reference_hit
├─ result_id (FK verification_result)
├─ reference_id (FK reference)
├─ hit (boolean)
├─ snippet (text nullable)
├─ location_json (jsonb: {chapter, paragraph, offset})
├─ similarity (numeric 0-1)
└─ (PK: result_id + reference_id)
```

API 响应的 `match_status` 字段按该表聚合计算：
- 全命中 → `MATCH`
- 部分命中 → `PARTIAL_MATCH`
- 全不命中 → `NOT_MATCH`
- 全部 reference 都没覆盖该引文来源 → `NOT_FOUND_IN_REF`

**Consequences**:
- ✅ 编辑可在 UI 看到每份参考的独立判定（审计面最大化）
- ⚠️ 联接表行数爆炸：1000 引文 × 5 参考 = 5000 行——列表页默认只 join 主命中，详情页 lazy-load 全量（盲区 #8）

---

### ADR-012：Prompt 版本化（文件 + SHA256）

**Status**: Accepted

**Context**: `real.md #7` + `notes #7` 要求模型+prompt 冻结。

**Decision**:
- 物理：`prompts/v1/{extract,verify,map}.txt`（从 Python 迁移）
- 读取：`lib/ai/prompts.ts` 用 `fs.readFileSync(path, "utf-8")` + 缓存（server-only 模块）
- 冻结：启动时对每份 prompt 计算 SHA256，写入 `version-stamp.ts` 全局常量
- 演进：v2 改动新开 `prompts/v2/`；两目录并存，历史任务走原版本

**Consequences**:
- ✅ `real.md #7` 结构性达成
- ⚠️ Next.js 读 `.txt` 需保证文件被打包：用 `fs` 读取 + 项目根 `prompts/` 目录 + `server-only` import 保证不进客户端 bundle（盲区 #7）

---

### ADR-013：TTL 销毁走 Inngest Cron

**Status**: Accepted

**Context**: `real.md #3` 要求上传文件 N 天后自动删除；`notes #2` 要求同时清日志中的片段缓存。

**Decision**: Inngest Cron `*/10 * * * *` 扫 `task.ttl_expires_at < now()` 任务：
- 删 Vercel Blob 对象（`del(url)`）
- 清解析缓存行
- 清 API response snapshots 行
- 标记 `task.destroyed_at = now()`
- **保留** `verification_result` / `report_snapshot` / `audit_log`（`real.md #7` 要求报告留存）

**Consequences**:
- ✅ 销毁与保留边界清晰
- ⚠️ Cron 10min 精度——最坏情况比 TTL 晚 10 分钟销毁；可接受

---

### ADR-014：文史字符工程单一出口

**Status**: Accepted

**Context**: `notes #3` 要求 OpenCC 繁简转换 + CJK Ext B-G 兼容 + 异体字处理。

**Decision**: `lib/text/normalize.ts` 是**唯一**文本规范化出口：

```typescript
export function normalizeForMatch(text: string): string {
  // 1. OpenCC 繁→简（opencc-js）
  // 2. 异体字映射（aliases.ts 中的 VARIANT_MAP）
  // 3. 合文展开（卅→三十；廿→二十；仅在匹配路径展开）
  // 4. Unicode 规范化 NFC
  return normalized;
}

// 对外的原文始终用原始字符串；normalize 仅用于索引 / 匹配
export function displayText(text: string): string {
  return text;  // 等同原文
}
```

**Consequences**:
- ✅ "发/髪"等经典错误不再发生
- ⚠️ 展示时用原文，匹配用规范化——所有调用者必须分清用哪个（盲区 #10）；lint 规则辅助（如直接在匹配函数里用原文会报警）

---

### ADR-015：日志脱敏（Pino + Sentry 兜底）

**Status**: Accepted

**Context**: `notes #2` 要求日志不含书稿 / 参考原文片段。

**Decision**:
- **主线**：`lib/logger.ts` 用 Pino，配 `redact` 屏蔽 `manuscriptText / quoteText / referenceSnippet / context / *.text / *.snippet` 等字段
- **兜底**：若接 Sentry，必须配置 `beforeSend` + `beforeBreadcrumb` 剥原文
- **审计**：`audit_log` 表只记 op/userId/taskId，不记原文

**Consequences**:
- ✅ `notes #2` 系统性达成
- ⚠️ 开发时 debug 不便——Pino redact 在 dev 也生效；临时 debug 需在本地开关而非生产

---

### ADR-016：宣传话术非 affordance（lint 强制）

**Status**: Accepted

**Context**: `notes #5` 是**产品语言层硬约束**——"自动校对 / 取代人工"等话术禁用。

**Decision**:
- `components/` 里禁用 `autoProofread` / `replaceEditor` / `aiRobot` 等命名
- 通过 eslint 自定义规则 `no-forbidden-naming`：匹配特定正则的 identifier / string literal 报错
- 文案层在 `lib/i18n/`（未来）白名单审核；v1.0 先人工 review

**Consequences**:
- ✅ 代码层挡一道；话术漂移风险降低
- ⚠️ 偶尔误报——正则需精调

---

## 9. 安全架构

### 9.1 分层

```
┌─────────────────────────────────────────────────┐
│  Transport: HTTPS + HSTS（Vercel 自动）         │
├─────────────────────────────────────────────────┤
│  Authentication: Better Auth session cookie     │
│    (httpOnly + sameSite=lax + secure)           │
├─────────────────────────────────────────────────┤
│  Authorization: requireUser() 中间件             │
│    每 query 强制 userId 注入                    │
├─────────────────────────────────────────────────┤
│  Data Protection:                                │
│    - Password: argon2 (Better Auth 内置)        │
│    - API Key: Vercel env var（不落 DB）         │
│    - Input: Zod 校验                            │
│    - SQL: Drizzle 参数化                        │
│    - XSS: React 自动转义                        │
│    - Log: Pino redact + Sentry scrubber         │
└─────────────────────────────────────────────────┘
```

### 9.2 关键机制

| 机制 | 位置 | 覆盖约束 |
|-----|------|---------|
| Session cookie | Better Auth | real.md #3 |
| 资源所有者检查 | `lib/auth/require-user.ts` | — |
| Zod 输入校验 | 每 Route Handler / Server Action 首行 | — |
| Pino redact | `lib/logger.ts` | notes #2 |
| TTL 销毁 | `inngest/functions/ttl-destroy.ts` | real.md #3 |
| 主动销毁 | `/api/privacy/manuscripts/:id/destroy` | real.md #3 |
| 协议弹窗 | `components/agreement-dialog` + middleware 拦截 | real.md #3 |
| 审计日志 | `audit_log` 表（不含原文） | — |
| 版本戳只读 | PG 触发器 + Drizzle schema | real.md #7 |
| 客观置信度 | `lib/ai/confidence.ts` | real.md #2 |
| 审核拒绝显式 | `lib/ai/moderation.ts` | notes #1 |

---

## 10. 可观测性

### 10.1 轻量起步（v1.0）

- **Health Check**：`GET /api/admin/health` 返回：
  ```json
  {
    "status": "ok",
    "checks": {
      "neon": true,
      "vercel_blob": true,
      "inngest": true,
      "siliconflow": true
    },
    "versionStamp": { "promptHashes": {...}, "modelId": "..." }
  }
  ```
- **内部指标**：`GET /api/admin/metrics`（admin-only）返回近 30 天任务数、成功率、平均耗时、累计费用
- **Inngest Dashboard**：原生提供工作流执行历史、失败重试、幂等键去重
- **Audit Log 表**：B 端关键操作（登录、任务发起、销毁、导出）入库；不含原文

### 10.2 可选补强（v1.0 后期）

- **Sentry**：预留 DSN 环境变量 `SENTRY_DSN`；必须启用 `beforeSend` PII scrubber
- **Vercel Analytics**：网页性能追踪（无 PII 风险）

---

## 11. 非架构范围（显式排除）

- ❌ **SaaS 多租户**：v1.0 单租户；多机构共用一部署但不做租户隔离（v2.0 再论）
- ❌ **外部 agent API（MCP/OpenAPI）**：MAS-候选-7 留待 v1.1+
- ❌ **自托管部署支持**：v1.0 只支持 Vercel；v1.1 可加 Docker Compose 自托管包
- ❌ **Celery / Arq / RabbitMQ 等任务队列**：Inngest 已覆盖
- ❌ **React SPA 外客户端 / 移动 App**：v1.0 不做
- ❌ **多模型跨验证**：置信度 `w3=0`；v1.1 再引入
- ❌ **受版权保护的内置语料库**：永不做（real.md #5）
- ❌ **综合评分 / 通过率**：永不做（notes #6）

---

## 12. 质量检查清单

对齐 SKILL.md 7 条 + 本项目加项：

- [x] 架构模式适配需求（Next.js App Router + Inngest 破解长任务）
- [x] 子系统职责清晰（7 个，每个对应明确 MS 集合）
- [x] API 遵循 RESTful 约定（`/resource` 复数、HTTP 方法语义、嵌套资源）
- [x] 目录结构支持模块化（`lib/` 无 framework 依赖，`components/` 按 feature 分）
- [x] 安全约束全覆盖（§9 矩阵）
- [x] 技术决策文档化（16 条 ADR 三段式）
- [x] real.md 7 条约束全映射（附录 B）

**本项目加项**：

- [x] 25 MS 全部对应某子系统（附录 A）
- [x] cog.md 7 实体全部对应 `lib/db/schema.ts` 表（附录 C）
- [x] notes 7 条工程伦理全映射 ADR（附录 B）
- [x] MVP 资产迁移表显式（附录 D）
- [x] 栈转向在 §1 Context 显式说明
- [x] 10 项工程盲区显式列出（见 §14）
- [x] `real.md #7` 版本冻结通过 ADR-006 + ADR-012 + 触发器 三重保障
- [x] `real.md #2` 客观置信度通过 ADR-007 根除 AI 自评
- [x] `notes #1` 审核拒绝通过 ADR-008 独立状态码

---

## 13. 下一步

### 13.1 直接触发的下游 skill

- **`dev-database-design`**
  - 把 7 实体 + `result_reference_hit` + `audit_log` + `user_agreement_acceptance` + `report_snapshot` 落为 Drizzle schema + 索引 + 迁移脚本 + PG 触发器（ADR-006）
  - 给出 `drizzle.config.ts` + Neon 连接配置
  - 解决盲区 #4（dev/main 分支迁移工作流）

- **`dev-ui-design`**
  - CS-01 主价值流（三维度卡片）shadcn/ui 高保真稿
  - CS-05 导出（Word/CSV 页眉设计）
  - CS-04 协议弹窗（B/C 差异化）
  - 非 affordance 清单对照（禁"综合评分"等）
  - Tailwind theme token（B 端深色严肃 / C 端明亮轻量）

- **`dev-coding`**
  - `bun create next-app` 搭骨架 → 按本规约目录结构落位
  - 三份 prompt 从 `origin/` cp 到 `prompts/v1/`
  - Better Auth 最小可用（注册+登录）
  - Drizzle 连 Neon
  - Inngest client + 第一个 cron（health check）

### 13.2 工程起步顺序（对齐 v1.0-m1 迭代）

1. 项目骨架（0.5 周）：Next.js + Tailwind + shadcn + Drizzle + Neon 初始化
2. Auth + 角色（0.5 周）：Better Auth + 注册/登录页 + B/C 差异化
3. Ingestion + Corpus（1 周）：上传 + 解析 + 参考库
4. 主工作流骨架（1 周）：Inngest `proofread-run` + 提取 + 基础校对
5. 三维度报告 UI（1 周）：`QuoteCard` + PARTIAL_MATCH 呈现
6. 数据流向弹窗 + 审核拒绝显式（0.5 周）

v1.0-m1 合计约 4.5 周——与用户故事规约 §5.1 预估吻合。

---

## 14. 规约显式暴露的盲区（工程落地前需回答）

| # | 盲区 | 建议处置 | 关联 ADR |
|---|------|---------|---------|
| 1 | Vercel AI SDK `generateObject` 无流式 → UI 无法边跑边显示单条结果 | **接受限制**；进度推送用 SSE（ADR-009），单条结果不流式 | ADR-005 |
| 2 | Inngest 免费层事件数/步骤数限额，10 万字书稿可能越界 | **v1.0-m1 之前跑实测**：10 万字书稿能否跑进免费层；否则批 10→50 条/step | ADR-002 |
| 3 | Vercel Blob 无自动删除；TTL 要主动 `del()` | `inngest/functions/ttl-destroy.ts` 统一处理（已在 ADR-013 兑现） | ADR-010, ADR-013 |
| 4 | Neon dev/main 分支迁移同步流程 | CI 中 `drizzle-kit migrate` + `neonctl branches` 自动化；规约文档化流程 | ADR-003 |
| 5 | Better Auth 的角色一经确定不允许切换 | 规约接受此设计；提供客服切换后门（走 admin） | ADR-004 |
| 6 | SSE Resume 依赖 Inngest Realtime 最近 N 条缓存；长断线后 event 丢失 | **接受**：长断线视为"查报告"场景，跳转到任务详情页而非继续流式 | ADR-009 |
| 7 | `prompts/v1/*.txt` 在 Next.js 下的读取需保证打包 | 用 `fs.readFileSync(path.join(process.cwd(), "prompts/v1/xxx.txt"))` + `import "server-only"` 隔离 | ADR-012 |
| 8 | `result_reference_hit` 行数爆炸（N 引文 × M 参考） | 列表页只 join 主命中；详情页 lazy-load；DB 索引 `(result_id, hit)` | ADR-011 |
| 9 | `_BOOK_NAME_ALIASES` 是 TS 硬编码还是 DB 表 | v1.0 先 TS 硬编码；超过 200 条或需用户编辑时迁 DB | ADR-014 |
| 10 | `generateObject` 的 Zod schema 对 LLM 抖动不宽容 | schema 宽松设计（允许额外字段）；关键字段 fallback + 手工清洗 | ADR-005 |

---

## 15. 本规约交付物

- **主文件**：`.42cog/spec/spec-system-architecture.md`（本文件）
- **关联更新**：
  - `.42cog/spec/spec-user-story.md`：追加附录，标注"栈转向后的 MVP 复用度更新"
  - `.42cog/work/milestones.md`：追加栈转向 M 级里程碑 + 规约交付条目
  - `docs/architecture.md`：首行加横幅注销 MVP 文档
- **不动产**：`origin/` 保持只读；`origin/README-archive.md` 添加归档说明（由 `dev-coding` 阶段创建）

---

## 附录 A：ADR × MS 覆盖矩阵

| MS | 主 ADR | 次 ADR |
|----|--------|--------|
| MS-L-01 注册 | ADR-004 | — |
| MS-L-02 登录 | ADR-004 | — |
| MS-D-01 登录异常 | ADR-004 | — |
| MS-L-03 上传 | ADR-010 | — |
| MS-L-04 关联参考 | ADR-010 | ADR-014 |
| MS-L-05 费用预估+发起 | ADR-002 | — |
| MS-L-06 SSE 进度 | ADR-009 | ADR-002 |
| MS-L-07 三维度报告 | ADR-005, ADR-011 | ADR-007 |
| MS-G-01 筛选搜索 | — | ADR-014 |
| MS-G-02 断点续跑 | ADR-002 | — |
| MS-D-02 审核拒绝 | ADR-008 | — |
| MS-D-03 API 重试 | ADR-002 | — |
| MS-D-04 超额暂停 | ADR-002 | — |
| MS-D-05 客观置信度 | ADR-007 | — |
| MS-L-08 失败重试 | ADR-002, ADR-006 | — |
| MS-L-09 版本戳冻结 | ADR-006, ADR-012 | — |
| MS-L-10 打开历史 | ADR-006 | — |
| MS-G-03 新旧版本 | ADR-006 | — |
| MS-G-04 筛选历史 | ADR-003 | — |
| MS-L-11 协议弹窗 | ADR-004 | ADR-016 |
| MS-G-05 TTL 销毁 | ADR-013 | ADR-010 |
| MS-D-06 主动销毁 | ADR-013 | ADR-010 |
| MS-L-12 Word 导出 | ADR-006 | — |
| MS-L-13 CSV 导出 | ADR-006 | — |
| MS-D-07 导出失败 | — | — |

**覆盖校核**：25 / 25 MS 全覆盖 ✓

---

## 附录 B：ADR × real.md / notes 约束矩阵

| 约束 | 内容 | 实现 ADR |
|-----|------|---------|
| real.md #1 | AI 只给提示，不改稿 | ADR-016（话术禁用）+ UI 设计层（dev-ui-design） |
| real.md #2 | 置信度不得 AI 自评 | **ADR-007** |
| real.md #3 | 上传内容保密 + TTL 销毁 | **ADR-013** + ADR-010 + ADR-015 |
| real.md #4 | 异文≠错误，中性措辞 | **prompts/v1/verify.txt 迁移改造**（在规约 §1.4 标注；由 dev-coding 兑现） |
| real.md #5 | 版权责任在用户 | 不预置版权语料（规约 §11 非范围） |
| real.md #6 | 成本上限+二次确认 | ADR-002（Inngest cost-guard） |
| real.md #7 | 模型+Prompt 版本锁定 | **ADR-006 + ADR-012** |
| notes #1 | 审核拒绝显式 | **ADR-008** |
| notes #2 | 日志不含原文 | **ADR-015** |
| notes #3 | 文史字符工程 | **ADR-014** |
| notes #4 | 长任务不丢+幂等 | **ADR-002** |
| notes #5 | "辅助"而非"取代"话术 | ADR-016 |
| notes #6 | 禁综合总分 | 规约 §11 非范围 + UI 设计层 |
| notes #7 | 报告快照不可变 | **ADR-006** |

**覆盖校核**：real.md 7/7 + notes 7/7 全覆盖 ✓

---

## 附录 C：cog.md 7 实体 × Drizzle schema 对照

（完整 DDL 由 `dev-database-design` 交付；此处仅表名对照）

| cog 实体 | Drizzle 表 | 关键字段 |
|---------|-----------|---------|
| 用户 | `user` | id, email, role, agreementVersion, createdAt |
| 书稿 | `manuscript` | id, userId, filename, blobUrl, fileSize, parsedAt |
| 段落 | `paragraph` | id, manuscriptId, seq, text, textHash, chapter |
| 引文 | `quote` | id, paragraphId, seq, quoteText, sourceWork, locationHint |
| 参考文献 | `reference` | id, userId, canonicalName, versionRole, blobUrl |
| 校对任务 | `task` | id, userId, manuscriptId, referenceIds (array), status, costEstimated, costActual, ttlExpiresAt, versionStamp (jsonb) |
| 校对结果 | `verification_result` | id, taskId, quoteId, verdictTextAccuracy (jsonb), verdictInterpretation (jsonb), verdictContext (jsonb), matchStatus, confidence, confidenceBreakdown (jsonb), moderationStatus |
| *辅助* | `result_reference_hit` | resultId, referenceId, hit, snippet, locationJson, similarity |
| *辅助* | `report_snapshot` | id, taskId, versionStampJson (readonly), frozenAt |
| *辅助* | `audit_log` | id, userId, op, targetId, metadataJson (无原文), createdAt |
| *辅助* | `user_agreement_acceptance` | userId, agreementVersion, acceptedAt |

**覆盖校核**：7/7 实体 + 4 辅助表 ✓

---

## 附录 D：MVP → v1.0 资产迁移表（栈转向后）

| MVP 文件 | v1.0 目标 | 迁移方式 | MS 影响 |
|---------|----------|---------|--------|
| `origin/app/prompts/extract_quotes_prompt.txt` | `prompts/v1/extract.txt` | **直搬**（唯一全保留资产） | — |
| `origin/app/prompts/verify_quote_prompt.txt` | `prompts/v1/verify.txt` | **搬 + 措辞改造**（去"错误/有误/误引" → "符合/不符合/未找到"） | MS-L-07 AC7 |
| `origin/app/prompts/map_sources_prompt.txt` | `prompts/v1/map.txt` | **直搬** | — |
| `origin/app/services/proofreader.py:_BOOK_NAME_ALIASES` | `lib/text/aliases.ts` | **译为 TS 常量**（`export const BOOK_NAME_ALIASES = { ... }`） | — |
| `origin/app/services/file_parser.py` | `lib/parsers/*.ts` | **全新重写**（mammoth + unpdf + epubjs） | MS-L-03 从"已有"退为"全新" |
| `origin/app/services/text_retriever.py` | `lib/corpus/user-uploaded.ts` | **全新重写**（n-gram 算法用 TS 重实现） | MS-L-04 从"改造"退为"全新" |
| `origin/app/services/proofreader.py:_call_api` | `lib/ai/client.ts` | **全新**（Vercel AI SDK） | MS-L-06 从"已有"退为"全新" |
| `origin/app/services/proofreader.py:_make_error_result` | `lib/ai/moderation.ts` + `lib/errors.ts` | **全新**（拆分解决 notes #1 语义混淆） | MS-D-02 从"全新"保持 |
| `origin/app/api/routes.py` | `app/api/**/*.ts` | **全新重写**（Next.js Route Handlers） | 所有 API MS 从"已有/改造"退为"全新" |
| `origin/templates/index.html` + `origin/static/` | `app/(main)/**/*.tsx` + `components/*` | **全新重写**（React + Tailwind + shadcn） | 所有 UI MS 从"已有/改造"退为"全新" |
| `origin/app/config.py` | `next.config.ts` + env vars | **全新** | — |

**核心判断**：
- 全 TS 重写工作量大，但有产品规约 + 用户故事 + 本架构规约 + 三份冻结 prompt 作"知识沉淀"，重写不是"从零开始"
- v1.0 总估工仍为 ~9 周（与用户故事规约 §5.2 一致），因为原 MS 估工基于"改造难度"已经偏保守

---

## 附录 E：术语表（补充）

| 术语 | 定义 |
|------|-----|
| **App Router** | Next.js 13+ 引入的新路由系统；基于 `app/` 目录；原生支持 RSC |
| **RSC** | React Server Components；服务端渲染不带客户端 JS 的组件 |
| **Route Handler** | Next.js App Router 的 API 端点实现形式；`app/api/**/route.ts` |
| **Server Action** | Next.js 的服务端动作；客户端表单直接调用，无需手写 fetch |
| **Inngest Function** | 事件驱动的后台函数；自动步骤化 + 幂等 + 重试 |
| **Inngest Step** | Function 内部的原子单元；失败时仅重试该 step |
| **Inngest Realtime** | Inngest 提供的实时事件广播能力；用于 SSE 桥接 |
| **Vercel Blob** | Vercel 官方对象存储；带签名 URL + TTL |
| **Neon Branch** | Neon Postgres 的分支数据库；用于 dev/main 隔离 |
| **PARTIAL_MATCH** | 多参考文献任务中，引文部分命中的状态标签 |
| **版本戳三元组** | modelId + promptVersions + sourceRefsHash——冻结报告身份证 |

---

**本规约撰写期**：2026-04-18
**规约版本**：v1.0-draft
**方法论来源**：`.42plugin/42edu/dev-system-architecture/SKILL.md`
**作者**：yubo（通过 Claude Code）
**栈**：TypeScript + Next.js 15 + Vercel + Inngest + Neon + Drizzle + Better Auth + Vercel AI SDK
