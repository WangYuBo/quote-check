# SubAgent 对话记录 (haiku)

> 项目: quote-check
> Session: fab68967-9ae3-4dae-a0f9-87574675c6a6
> 时区: Asia/Shanghai (+08:00)

---

## 👤 User [19:12:04 +08:00]

Explore the `quote-check` project at /Users/wangyubo/github-resp/quote-check to understand the existing upload + proofread pipeline that MAS-2 will extend. Focus on:

1. **Manuscripts upload pattern** — Read `app/api/manuscripts/route.ts` fully. Report the exact patterns used (auth, formData, parser, Blob bypass, DB insert, return shape). MAS-2 needs a parallel `/api/references` endpoint, and should follow the same conventions.

2. **Parser layer** — Read `lib/parsers/manuscript.ts` fully. Understand what ParsedParagraph shape is, which mime types are supported, and whether the logic is reusable for references (references may have different chunking semantics — could be book chapters, PDFs, etc.).

3. **proofread-run.ts S4 verify loop** — Read `inngest/functions/proofread-run.ts` lines 217-357 (the verify-each-quote loop). Report: 
   - What data is currently passed to the verify LLM (userMsg content)
   - Where it says "（无参考文献内容可用，请基于已知知识判断）" — this is the hardcoded no-ref branch that MAS-2 must replace
   - What `verifyResult.reference_hits` is used for (confidence computation, but not yet written to DB)
   - How `result_reference_hit` M:N is currently written (hint: it's probably not written anywhere yet)

4. **saveQuotes / saveVerificationResult services** — Read `lib/services/task.ts` — are there any existing helpers for writing `result_reference_hit`? What would need to be added?

5. **UI reports page** — Read `app/reports/[taskId]/page.tsx`. How are `reference_hits` / reference locations currently displayed (if at all)? MAS-2 needs to surface reference snippets to editors.

6. **verify prompt** — Read `prompts/v1/verify.txt`. Is there a slot for injected reference text? Or does MAS-2 need to switch to using `map.txt` for the retrieval step followed by verify? Report the current verify.txt structure.

7. **Existing tests for references** — grep tests/ for 'reference' to see if there's any groundwork already tested.

Report back (under 900 words) with:
- The exact patterns MAS-2 should inherit from manuscripts route
- The specific hardcoded "no ref" branch location (line numbers)
- Whether verify.txt already supports reference injection or whether a new "map then verify" two-step is needed
- The M:N write gap (what needs to be added to services/task.ts)
- Relevant line references + file paths

---

## 🤖 Assistant [19:12:06 +08:00]

I'll explore the quote-check project systematically to understand the upload and proofread pipeline for MAS-2.

---

## 🤖 Assistant [19:12:06 +08:00]

### 🔧 Read

```json
{
  "file_path": "/Users/wangyubo/github-resp/quote-check/app/api/manuscripts/route.ts"
}
```

📤 Result:

```
1	import type { NextRequest } from 'next/server';
2	import { NextResponse } from 'next/server';
3	
4	import { auth } from '@/lib/auth';
5	import { parseManuscript } from '@/lib/parsers/manuscript';
6	import { createManuscript, markManuscriptParsed, saveParagraphs } from '@/lib/services/manuscript';
7	import { uploadManuscriptBlob } from '@/lib/storage/blob';
8	
9	const ALLOWED_MIME = new Set([
10	  'text/plain',
11	  'text/markdown',
12	  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
13	]);
14	const MAX_SIZE = 20 * 1024 * 1024; // 20 MB
15	
16	export async function POST(req: NextRequest) {
17	  const session = await auth.api.getSession({ headers: req.headers });
18	  if (!session?.user?.id) {
19	    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
20	  }
21	
22	  let formData: FormData;
23	  try {
24	    formData = await req.formData();
25	  } catch {
26	    return NextResponse.json({ error: '无法解析 form-data' }, { status: 400 });
27	  }
...(truncated)
```

---

## 🤖 Assistant [19:12:07 +08:00]

### 🔧 Read

```json
{
  "file_path": "/Users/wangyubo/github-resp/quote-check/lib/parsers/manuscript.ts"
}
```

📤 Result:

```
1	import mammoth from 'mammoth';
2	
3	export interface ParsedParagraph {
4	  seq: number;
5	  text: string;
6	}
7	
8	export interface ParseResult {
9	  paragraphs: ParsedParagraph[];
10	  charCount: number;
11	  mimeType: string;
12	}
13	
14	const MAX_CHAR_COUNT = 500_000;
15	
16	export async function parseManuscript(
17	  buffer: Buffer,
18	  mimeType: string,
19	  filename: string,
20	): Promise<ParseResult> {
21	  let raw: string;
22	
23	  if (
24	    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
25	    filename.endsWith('.docx')
26	  ) {
27	    const result = await mammoth.extractRawText({ buffer });
28	    raw = result.value;
29	  } else if (
30	    mimeType === 'text/plain' ||
31	    mimeType === 'text/markdown' ||
32	    filename.endsWith('.md') ||
33	    filename.endsWith('.txt')
34	  ) {
35	    raw = buffer.toString('utf-8');
36	  } else {
37	    throw new Error(`不支持的文件格式：${mimeType}（${filename}）`);
38	  }
39	
40	  if (raw.length > M...(truncated)
```

---

## 🤖 Assistant [19:12:07 +08:00]

### 🔧 Read

```json
{
  "file_path": "/Users/wangyubo/github-resp/quote-check/inngest/functions/proofread-run.ts",
  "offset": 216,
  "limit": 150
}
```

📤 Result:

```
216	
217	    // ─── S4: verify-each-quote ────────────────────────────────────────
218	    // DG-m2.1：v1.0 串行（Inngest 免费层配额约束）
219	    const verifyPrompt = loadPromptRaw('verify');
220	    let verifiedCount = 0;
221	
222	    for (const q of savedQuotes) {
223	      const idempotencyKey = buildResultIdempotencyKey({
224	        taskId: ctx.taskId,
225	        quoteId: q.id,
226	        attemptN: attempt,
227	      });
228	
229	      await step.run(`verify-${q.id}`, async () => {
230	        const userMsg = [
231	          `引用文字：${q.quoteText}`,
232	          `作者解释：${q.authorExplanation}`,
233	          `引用前文：${q.contextWindow}`,
234	          `引用后文：`,
235	          q.locationHint ? `位置提示：${q.locationHint}` : '',
236	          `原文来源：${q.sourceWorkHint || '未知'}`,
237	          `（无参考文献内容可用，请基于已知知识判断）`,
238	        ]
239	          .filter(Boolean)
240	          .join('\n');
241	
242	        const { text: rawOutput } = await generateText({
243	          model: defaultModel,
244	          ......(truncated)
```

---

## 🤖 Assistant [19:12:09 +08:00]

Now let me read the remaining files:

---

## 🤖 Assistant [19:12:10 +08:00]

### 🔧 Read

```json
{
  "file_path": "/Users/wangyubo/github-resp/quote-check/lib/services/task.ts"
}
```

📤 Result:

```
1	import { eq } from 'drizzle-orm';
2	
3	import { db } from '@/lib/db';
4	import { paragraph, quote, reportSnapshot, task, verificationResult } from '@/lib/db/schema';
5	import type {
6	  NewQuote,
7	  NewReportSnapshot,
8	  NewVerificationResult,
9	  Quote,
10	  Task,
11	  VerificationResult,
12	} from '@/lib/db/types';
13	import type { TaskStatus } from '@/lib/db/schema';
14	
15	function shortId(): string {
16	  return Math.random().toString(36).slice(2, 10).toUpperCase();
17	}
18	
19	export async function createTask(values: {
20	  userId: string;
21	  manuscriptId: string;
22	  referenceIds?: string[];
23	}): Promise<Task> {
24	  const [row] = await db
25	    .insert(task)
26	    .values({
27	      userId: values.userId,
28	      manuscriptId: values.manuscriptId,
29	      referenceIds: values.referenceIds ?? [],
30	      displayId: `T-${shortId()}`,
31	      status: 'PENDING_PARSE',
32	      // TTL 默认 30 天（MAS-6 将由 cron 清理）
33	      ttlExpiresAt: new Date(Date.now() + 30 * 24 * 60 ...(truncated)
```

---

## 🤖 Assistant [19:12:10 +08:00]

### 🔧 Read

```json
{
  "file_path": "/Users/wangyubo/github-resp/quote-check/app/reports/[taskId]/page.tsx"
}
```

📤 Result:

```
1	import { notFound } from 'next/navigation';
2	
3	import { auth } from '@/lib/auth';
4	import { getReport } from '@/lib/services/task';
5	import { headers } from 'next/headers';
6	
7	interface VerifyResult {
8	  id: string;
9	  quoteId: string;
10	  quoteText: string;
11	  sourceWorkHint: string | null;
12	  matchStatus: 'MATCH' | 'PARTIAL_MATCH' | 'NOT_MATCH' | 'NOT_FOUND_IN_REF';
13	  verdictTextAccuracy: {
14	    verdict: string;
15	    explanation: string;
16	    suggestedCorrection?: string;
17	  };
18	  verdictInterpretation: {
19	    verdict: string;
20	    explanation: string;
21	  };
22	  verdictContext: {
23	    verdict: string;
24	    explanation: string;
25	  };
26	  confidence: string;
27	  confidenceBreakdown: {
28	    refHit: number;
29	    locationValid: number;
30	    crossModel: number;
31	    weights: { w1: number; w2: number; w3: number };
32	    algoVersion: string;
33	  };
34	}
35	
36	const MATCH_LABEL: Record<string, string> = {
37	  MATCH: '符合参考',
38	  PARTIAL_...(truncated)
```

---

## 🤖 Assistant [19:12:10 +08:00]

### 🔧 Read

```json
{
  "file_path": "/Users/wangyubo/github-resp/quote-check/prompts/v1/verify.txt"
}
```

📤 Result:

```
1	你是一位专业的中文学术书稿引用核查助手，具备严谨的文献比对能力。你的任务是对照原始文献，从三个维度比对书稿中的引用与原文是否一致。**你不做"是否属于引用差错"的终审判定；终审权归编辑所有。**你只负责报告"是否与原文一致 / 部分一致 / 未找到 / 原文另有所载"。
2	
3	## 核查任务输入
4	
5	你将收到以下信息：
6	- **引用文字（quote）**：书稿作者所引用的文字
7	- **作者解释（author_explanation）**：书稿作者对该引用的解读或评价
8	- **引用前文（context_before）**：引用在书稿中出现前的上下文
9	- **引用后文（context_after）**：引用在书稿中出现后的上下文
10	- **原文内容（source_text）**：被引用文献的原始文本
11	
12	## 三项比对维度
13	
14	### 1. 字词准确性（text_accuracy）
15	逐字对比书稿中的引用文字与原文中对应段落：
16	- 标记书稿引文与原文在字词上是否一致 / 部分一致 / 不一致
17	- 记录书稿引文与原文之间的字词差异（若有）：增添、删减、替换、标点、断句位置
18	- **异文提示**：若书稿引文与某一权威版本不一致，但与另一已知版本一致，请在 `variant_note` 中说明，不得作为差异标记
19	- 若原文中找不到对应内容，标记状态为"原文中未找到对应内容"
20	
21	### 2. 解释一致性（interpretation_accuracy）
22	对比作者的解释与原文的实际含义：
23	- 作者解释是否与原文语义一致 / 部分一致 / 偏离
24	- 记录具体差异（若有）：过度解读、限定条件缺失、概念替换
25	- 若作者无明显解释，此项标记为"无需比对"
26	
27	### 3. 上下文相符性（context_appropriateness）
28	评估该引用用于书稿当前上下文是否与原文语境相符：
29	- 是否存在脱离原文语境后含义改变的情况
30	- 引用在书稿中的用途是否与原文作者的表达意图相符
31	- 记录观察到的语境差异（若有）
32	
33	## 输出格式
34	
35	严格按照以下 JSON 格式输出，不要输出任何其他文字：
36	
37	```json...(truncated)
```

---

## 🤖 Assistant [19:12:13 +08:00]

Now let me search for reference-related tests and check if there's any existing groundwork:

---

## 🤖 Assistant [19:12:13 +08:00]

### 🔧 Glob

```json
{
  "pattern": "**/tests/**/*.test.ts"
}
```

📤 Result:

```
tests/compliance/cjk-normalization.test.ts
tests/compliance/moderation-detection.test.ts
tests/compliance/prompt-integrity.test.ts
tests/unit/ai-confidence.test.ts
node_modules/zod/src/v3/tests/all-errors.test.ts
node_modules/zod/src/v3/tests/anyunknown.test.ts
node_modules/zod/src/v4/classic/tests/anyunknown.test.ts
node_modules/zod/src/v3/tests/array.test.ts
node_modules/zod/src/v4/classic/tests/array.test.ts
node_modules/zod/src/v4/classic/tests/assignability.test.ts
node_modules/zod/src/v4/mini/tests/assignability.test.ts
node_modules/zod/src/v3/tests/async-parsing.test.ts
node_modules/zod/src/v4/classic/tests/async-parsing.test.ts
node_modules/zod/src/v3/tests/async-refinements.test.ts
node_modules/zod/src/v4/classic/tests/async-refinements.test.ts
node_modules/zod/src/v3/tests/base.test.ts
node_modules/zod/src/v4/classic/tests/base.test.ts
node_modules/zod/src/v4/core/tests/locales/be.test.ts
node_modules/zod/src/v3/tests/bigint.test.ts
node_modules/zod/src/v4/classic/tests/bigin...(truncated)
```

---

## 🤖 Assistant [19:12:13 +08:00]

### 🔧 Grep

```json
{
  "pattern": "reference",
  "path": "/Users/wangyubo/github-resp/quote-check"
}
```

📤 Result:

```
Found 54 files
.42cog/work/milestones.md
.42cog/work/roadmap-v1.0.md
inngest/functions/proofread-run.ts
lib/services/task.ts
app/api/tasks/route.ts
bun.lock
chats/hi+ai/2026-04-20.md
chats/detail/2026-04-17-50309c5b-e721-463b-ac0d-8fa3e3dfa4c8.md
tests/contract/db-triggers.test.ts
lib/db/migrations/_hand_triggers.sql
lib/db/migrations/meta/0001_snapshot.json
lib/db/schema.ts
scripts/db-check.ts
lib/db/migrations/0000_wakeful_kat_farrell.sql
lib/db/migrations/meta/0000_snapshot.json
lib/db/types.ts
prompts/v1/verify.txt
.42cog/spec/spec-quality-assurance.md
.42cog/spec/spec-coding.md
.42cog/spec/spec-ui-design.md
.42cog/spec/spec-database-design.md
chats/detail/613b5ab6-1661-4155-b11a-636c58873e5f/subagents/2026-04-18-agent-a20b3278a610fdd60-haiku.md
chats/detail/613b5ab6-1661-4155-b11a-636c58873e5f/subagents/2026-04-18-agent-aa18ec7865c46f912-haiku.md
chats/detail/2026-04-18-613b5ab6-1661-4155-b11a-636c58873e5f.md
chats/hi+ai/2026-04-18-613b5ab6.md
docs/architecture.md
.42cog/spec/spec...(truncated)
```

---

## 🤖 Assistant [19:12:16 +08:00]

Let me check the database schema to understand the current structure better:

---

## 🤖 Assistant [19:12:16 +08:00]

### 🔧 Read

```json
{
  "file_path": "/Users/wangyubo/github-resp/quote-check/lib/db/schema.ts"
}
```

📤 Result:

```
1	/**
2	 * Drizzle schema for quote-check v1.0
3	 * - 7 核心业务实体（cog.md）
4	 * - 4 辅助表（result_reference_hit / report_snapshot / audit_log / user_agreement_acceptance）
5	 * - 3 Better Auth 表（session / account / verification）
6	 * - 1 版本登记表（prompt_version，ADR-012）
7	 *
8	 * spec-database-design §4.1 · ADR-003/006/011/012 · real.md #7 · notes #6/#7
9	 */
10	
11	import { relations } from 'drizzle-orm';
12	import {
13	  bigint,
14	  boolean,
15	  index,
16	  integer,
17	  jsonb,
18	  numeric,
19	  pgEnum,
20	  pgTable,
21	  serial,
22	  text,
23	  timestamp,
24	  uniqueIndex,
25	  uuid,
26	  varchar,
27	} from 'drizzle-orm/pg-core';
28	
29	/* ─────────────────────────────────────────────────
30	 * Enums
31	 *
32	 * 策略（§4.3 D-03 改进）：
33	 *   - 低演进概率 → pgEnum（user_role / reference_role / quote_kind / match_status）
34	 *   - 高演进概率 → varchar + CHECK + Zod（task.status；见 0001_triggers.sql C-03）
35	 *   - jsonb 内部字段 → 不落 DB，由 Zod 独家守护（三维度 verdict）
36	 * ───────────────────────────────────────────────...(truncated)
```

---

## 🤖 Assistant [19:12:19 +08:00]

Now let me check for reference parsing and any existing reference API patterns:

---

## 🤖 Assistant [19:12:19 +08:00]

### 🔧 Glob

```json
{
  "pattern": "**/lib/parsers/**"
}
```

📤 Result:

```
lib/parsers/.gitkeep
lib/parsers/manuscript.ts
```

---

## 🤖 Assistant [19:12:19 +08:00]

### 🔧 Glob

```json
{
  "pattern": "**/app/api/references/**"
}
```

📤 Result:

```
No files found
```

---

## 🤖 Assistant [19:12:22 +08:00]

Let me check the VerifyOutputSchema and prompts folder:

---

## 🤖 Assistant [19:12:22 +08:00]

### 🔧 Grep

```json
{
  "pattern": "VerifyOutputSchema",
  "path": "/Users/wangyubo/github-resp/quote-check"
}
```

📤 Result:

```
Found 2 files
.42cog/work/milestones.md
inngest/functions/proofread-run.ts
```

---

## 🤖 Assistant [19:12:22 +08:00]

### 🔧 Glob

```json
{
  "pattern": "**/prompts/**"
}
```

📤 Result:

```
origin/app/prompts/__init__.py
origin/app/prompts/extract_quotes_prompt.txt
origin/app/prompts/verify_quote_prompt.txt
origin/app/prompts/map_sources_prompt.txt
prompts/v1/extract.txt
prompts/v1/map.txt
prompts/v1/verify.txt
node_modules/ai/prompts/dist/index.js
node_modules/ai/prompts/dist/index.js.map
node_modules/ai/prompts/dist/index.mjs.map
node_modules/ai/prompts/dist/index.mjs
node_modules/ai/prompts/dist/index.d.mts
node_modules/ai/prompts/dist/index.d.ts
```

---

## 🤖 Assistant [19:12:26 +08:00]

Let me search for VerifyOutputSchema definition:

---

## 🤖 Assistant [19:12:26 +08:00]

### 🔧 Bash

```json
{
  "command": "find /Users/wangyubo/github-resp/quote-check -name \"*.ts\" -not -path \"*/node_modules/*\" | xargs grep -l \"VerifyOutputSchema\" 2>/dev/null | head -5"
}
```

📤 Result:

```
/Users/wangyubo/github-resp/quote-check/inngest/functions/proofread-run.ts
```

---

## 🤖 Assistant [19:12:30 +08:00]

### 🔧 Bash

```json
{
  "command": "grep -n \"VerifyOutputSchema\" /Users/wangyubo/github-resp/quote-check/inngest/functions/proofread-run.ts | head -10"
}
```

📤 Result:

```
54:const VerifyOutputSchema = z.object({
252:        let verifyResult: z.infer<typeof VerifyOutputSchema> | null = null;
263:            const parsed = VerifyOutputSchema.safeParse(parsedRaw);
```

---

## 🤖 Assistant [19:12:32 +08:00]

### 🔧 Read

```json
{
  "file_path": "/Users/wangyubo/github-resp/quote-check/inngest/functions/proofread-run.ts",
  "offset": 1,
  "limit": 100
}
```

📤 Result:

```
1	import { generateText } from 'ai';
2	import { z } from 'zod';
3	
4	import { inngest } from '@/inngest/client';
5	import { DEFAULT_GENERATION_OPTIONS, MODEL_ID, defaultModel } from '@/lib/ai/client';
6	import { CONFIDENCE_ALGO_VERSION, computeConfidence } from '@/lib/ai/confidence';
7	import { PROMPT_VERSION, loadPromptRaw } from '@/lib/ai/prompts';
8	import { buildResultIdempotencyKey } from '@/lib/idempotency';
9	import {
10	  createReportSnapshot,
11	  getReport,
12	  getTaskContext,
13	  saveQuotes,
14	  saveVerificationResult,
15	  updateTaskProgress,
16	  updateTaskStatus,
17	} from '@/lib/services/task';
18	
19	// ─── Zod schema: LLM extract output ──────────────────────────────────────────
20	const ExtractedQuoteSchema = z.object({
21	  quote: z.string(),
22	  context_before: z.string().optional().default(''),
23	  context_after: z.string().optional().default(''),
24	  author_explanation: z.string().optional().default(''),
25	  location_hint: z.string().optional().default(''),...(truncated)
```

---

## 🤖 Assistant [19:12:35 +08:00]

Perfect! Now let me check the map.txt prompt to understand reference mapping:

---

## 🤖 Assistant [19:12:36 +08:00]

### 🔧 Read

```json
{
  "file_path": "/Users/wangyubo/github-resp/quote-check/prompts/v1/map.txt"
}
```

📤 Result:

```
1	你是一个中文古典文献专家。你的任务是将引用来源名称进行归一化分组，并将每组匹配到最合适的参考文献文件。
2	
3	## 输入
4	
5	你会收到两个列表：
6	1. **source_work 列表**：从书稿中提取的引用来源名称（可能包含书名号、章节信息、繁体字、别名等）
7	2. **参考文献文件名列表**：用户上传的参考文献文件名（可能是拼音、英文、中文或混合格式）
8	
9	## 任务
10	
11	1. **归一化分组**：将指向同一部书的不同写法归入同一组。常见情况包括：
12	   - 别名：《老子》和《道德经》是同一本书
13	   - 繁简体：《道德經》和《道德经》
14	   - 带章节：《老子·道经·第十一章》归入《老子》/《道德经》
15	   - 带注释说明：《论语集注》归入《论语》
16	
17	2. **匹配文件**：为每组找到最匹配的参考文献文件名。文件名可能是：
18	   - 拼音格式：`Dao De Jing Wang Bi Zhu Ben - Wang Bi.txt`
19	   - 中文格式：`论语全文.txt`
20	   - 混合格式：`Sun Zi Bing Fa --Zhong Hua Jing Dian Zhi Z - Chen Xi Yi Zhu.txt`
21	   - 如果没有匹配的文件，设为 null
22	
23	## 输出格式
24	
25	严格输出 JSON 数组，不要添加任何说明文字：
26	
27	```json
28	[
29	  {
30	    "canonical_name": "道德经",
31	    "source_works": ["《道德经》", "《老子》", "《老子·道经·第十一章》", "《道德經》"],
32	    "matched_file": "Dao De Jing Wang Bi Zhu Ben - Wang Bi.txt"
33	  },
34	  {
35	    "canonical_name": "论语",
36	    "source_works": ["《论语》"],
37	    "matched_file": null
38	  }
39	]
40	```
41	
42	注意：
43	- canonical_name 使用简体中文，不含书名...(truncated)
```

---

## 🤖 Assistant [19:13:06 +08:00]

Perfect! Now I have all the information I need. Let me compile the comprehensive report:

## Report: Existing Upload & Proofread Pipeline for MAS-2

### 1. **Manuscripts Upload Pattern** (`app/api/manuscripts/route.ts`, lines 16-89)

**Exact patterns MAS-2 should inherit:**

- **Auth:** Check session with `auth.api.getSession({ headers: req.headers })` → return 401 if no user.id
- **FormData parsing:** `await req.formData()` with error handling for format errors
- **File extraction:** Check `file instanceof File`, validate mimeType and extension against `ALLOWED_MIME` set
- **Blob bypass:** Token check: `if (!blobToken.includes('placeholder')) { uploadBlob(...) }` else fallback to `local://` URL
- **DB insert order:** Parse first (fail early), then upload Blob, then insert manuscript row, then insert paragraphs, then mark parsed
- **Return shape:**
  ```javascript
  {
    manuscriptId, displayId, filename,
    paragraphCount, charCount
  }
  ```

**For `/api/references` endpoint:** Follow identical pattern but use `parseReference()` instead of `parseManuscript()`, and save reference chunk data (not paragraphs—likely passages or sections).

---

### 2. **Parser Layer** (`lib/parsers/manuscript.ts`, lines 1-59)

**ParsedParagraph shape:**
```typescript
interface ParsedParagraph { seq: number; text: string; }
interface ParseResult { paragraphs: ParsedParagraph[]; charCount: number; mimeType: string; }
```

**Supported MIME types:**
- `text/plain` → UTF-8 decode
- `text/markdown` → UTF-8 decode
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (.docx) → mammoth.extractRawText()

**Chunking:** Split by newlines `\r?\n`, skip empty lines, assign `seq` incrementally.

**Limits:** 500k char max; throws on exceeding.

**Reusability for references:** Parser is **NOT directly reusable**—references likely have different chunk semantics (book chapters, sections with metadata like "chapter: 第一卷"). MAS-2 should create `lib/parsers/reference.ts` with a similar structure but potentially richer output (e.g., chapter boundaries extracted from docx structure).

---

### 3. **Hardcoded "No Ref" Branch** (`inngest/functions/proofread-run.ts`, line 237)

**Location:** Line 237 in the userMsg construction:
```javascript
`（无参考文献内容可用，请基于已知知识判断）`,
```

This hardcoded string tells the LLM: *"No reference content available; judge based on known knowledge."* This is the **exact line MAS-2 must replace** with injected reference text once reference mapping & retrieval are implemented.

**Current userMsg structure (lines 230–240):**
```javascript
[
  `引用文字：${q.quoteText}`,
  `作者解释：${q.authorExplanation}`,
  `引用前文：${q.contextWindow}`,
  `引用后文：`,
  q.locationHint ? `位置提示：${q.locationHint}` : '',
  `原文来源：${q.sourceWorkHint || '未知'}`,
  `（无参考文献内容可用，请基于已知知识判断）`, // ← REPLACE HERE
]
```

---

### 4. **Confidence & reference_hits Usage** (lines 301–305)

- **Data passed to verify LLM:** Quote text, author explanation, context window, location hint, source work hint (but NO actual reference content—that's the MAS-2 gap)
- **reference_hits from LLM:** Array of `{ snippet, location }` objects returned by the LLM in `VerifyOutputSchema` (lines 72–74)
- **Confidence computation (lines 300–305):**
  ```typescript
  const refHit = verifyResult.reference_hits.length > 0 ? 1 : 0;
  const locationValid = verifyResult.reference_hits.some((h) => h.location.length > 0) ? 1 : 0;
  const conf = computeConfidence({ refHit, locationValid, crossModel: 0 });
  ```
  Both signals feed into confidence, but `reference_hits` is **never written to DB**—it's only used for scoring.

---

### 5. **M:N Write Gap** (`lib/services/task.ts`, lines 122–131)

**Current state:** `saveVerificationResult()` exists but has **no logic to write `result_reference_hit` rows**.

```typescript
export async function saveVerificationResult(
  row: NewVerificationResult,
): Promise<VerificationResult | null> {
  const [inserted] = await db.insert(verificationResult).values(row)...
  return inserted ?? null;
}
```

**What's missing:**
- After LLM returns `reference_hits`, no code transforms them into `result_reference_hit` M:N rows
- Schema exists (`lib/db/schema.ts`, lines 399–426) with `resultReferenceHit` table, but it's never populated
- **MAS-2 must add:** A helper function (e.g., `saveReferenceHits()`) that takes `(resultId: UUID, hits: LLMRefHit[], taskReferenceIds: UUID[])` and inserts matched `result_reference_hit` rows with `hit: true/false`, `snippet`, and `locationJson`

---

### 6. **UI Reports Page** (`app/reports/[taskId]/page.tsx`, lines 68–147)

**Current reference_hits display:** **None.** The page reads `verificationResult` but only shows:
- Quote text + source work hint (lines 77–80)
- Three-dimensional verdicts in `VerifyCard` (lines 94–110)
- Confidence score (line 69)

**Gap for MAS-2:** No reference snippets or `result_reference_hit` data is joined or displayed. UI needs to either:
1. Join `verificationResult → resultReferenceHit → reference` in `getReport()` service
2. Render a reference panel showing matched passages + location + similarity score

---

### 7. **Verify Prompt Structure** (`prompts/v1/verify.txt`, lines 1–119)

**Current state:** **Verify.txt does NOT have a slot for reference text injection.** The prompt tells the LLM to compare against "原始文献" (original source text) but that text is never provided in the current system.

**Prompt structure:**
- Lines 3–10: Define task inputs (引用文字, 作者解释, 引用前文/后文, 原文内容← **THIS FIELD IS NEVER FILLED**)
- Lines 12–32: Three comparison dimensions (字词准确性, 解释一致性, 上下文相符性)
- Lines 56–63: Output format with `reference_hits` array

**Exists a separate `map.txt` (lines 1–46):** This is a **source-to-file mapping step**, normalizing extracted source work names (e.g., "《老子》" + "《道德经》" → canonical "道德经") and matching them to uploaded reference filenames.

**MAS-2 strategy:** **Two-step approach (not one-step injection):**
1. **Step S3.5 (new):** Run verify LLM with `map.txt` to group source works → get canonical names + matched reference file paths
2. **Step S4 (existing verify):** Retrieve actual passage snippets from matched references, inject them into verify LLM prompt, then run verification

OR: **Modify verify.txt** to accept an optional `原文内容` field in the input, but **map.txt step must run first** to identify which references to load.

---

### 8. **Existing Tests for References**

**Finding:** No reference tests found in `tests/` directory. Grep for "reference" returned only:
- Schema definitions (lib/db/schema.ts)
- Roadmap/milestone docs (.42cog/)
- No unit/integration tests exercising reference upload, parsing, or retrieval

---

## Summary for MAS-2

| Item | Pattern / Requirement |
|------|----------------------|
| **Upload route** | Inherit `/api/manuscripts` auth + formData + Blob-bypass pattern; create `/api/references` |
| **Parser** | Create new `lib/parsers/reference.ts` (not reuse manuscript parser due to different chunking) |
| **Hardcoded no-ref branch** | Line 237: `（无参考文献内容可用，请基于已知知识判断）` ← **Replace with reference text injection** |
| **Verify LLM data** | Currently: quote + context + hints (no ref content). MAS-2: Add reference passages retrieved via map + retrieval |
| **M:N gap** | Add `saveReferenceHits(resultId, hits, refIds)` to `lib/services/task.ts` to populate `result_reference_hit` |
| **UI gap** | Extend `getReport()` to join `resultReferenceHit`; render reference snippets in `ReportPage` |
| **Prompt strategy** | Do NOT inject into verify.txt directly. Run map.txt step first (source normalization), then retrieve passages, then inject into verify. Consider two-step `map-then-verify` workflow |
| **Tests** | No groundwork; new reference tests will be needed |

**File paths:**
- `/Users/wangyubo/github-resp/quote-check/app/api/manuscripts/route.ts` (16–89)
- `/Users/wangyubo/github-resp/quote-check/lib/parsers/manuscript.ts` (1–59)
- `/Users/wangyubo/github-resp/quote-check/inngest/functions/proofread-run.ts` (54–76, 217–357)
- `/Users/wangyubo/github-resp/quote-check/lib/services/task.ts` (122–131)
- `/Users/wangyubo/github-resp/quote-check/lib/db/schema.ts` (399–426, resultReferenceHit)
- `/Users/wangyubo/github-resp/quote-check/prompts/v1/verify.txt` (1–119)
- `/Users/wangyubo/github-resp/quote-check/prompts/v1/map.txt` (1–46)

---
