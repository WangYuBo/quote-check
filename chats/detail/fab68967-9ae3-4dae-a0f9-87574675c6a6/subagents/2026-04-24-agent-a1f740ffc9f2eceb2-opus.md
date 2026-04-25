# SubAgent 对话记录 (opus)

> 项目: quote-check
> Session: fab68967-9ae3-4dae-a0f9-87574675c6a6
> 时区: Asia/Shanghai (+08:00)

---

## 👤 User [19:18:10 +08:00]

Design a detailed implementation plan for MAS-2 (参考为准绳 / references as criterion) in the `quote-check` project at /Users/wangyubo/github-resp/quote-check.

## Context

MAS-2 is the second MAS story in v1.0-m2. MAS-1 (basic proofread pipeline) is already done: POST /api/manuscripts → POST /api/tasks → Inngest proofread-run (extract + verify with DeepSeek via 硅基流动) → verification_result → /api/reports/[taskId] → UI. 

The current verify LLM call uses a **hardcoded "no reference" branch** in `inngest/functions/proofread-run.ts:237`:
```
`（无参考文献内容可用，请基于已知知识判断）`,
```

MAS-2 must replace this with real reference-based retrieval.

## User-confirmed design decisions

1. **Retrieval**: pg_trgm paragraph-level — add new `reference_paragraph` table with `text_normalized` column + GIN trigram index. Use `similarity()` SQL to retrieve top-K passages. (Unlocks DG-m2.2 threshold decision.)
2. **map.txt integration**: DEFERRED to MAS-2b. v1.0 uses simple substring match: `quote.sourceWorkHint` matches `reference.canonicalName`. map.txt only needs to pass prompt-integrity lint (already done).
3. **UI**: Extend `/app/upload/page.tsx` — after manuscript upload, show reference multi-file upload area + canonicalName form inputs. Submit all together at task creation.

## Pre-existing artifacts to REUSE

- `lib/parsers/manuscript.ts` (exports `parseManuscript`, `ParsedParagraph`) — the parser handles txt/md/docx; reuse it verbatim, just wrap for references
- `lib/storage/blob.ts` (exports `uploadManuscriptBlob`) — generalize to `uploadBlob(prefix, ...)` or add parallel `uploadReferenceBlob`
- `lib/text/normalize.ts` — existing CJK normalization (already passes 17 golden tests). Use its `normalizeText` function to populate `reference_paragraph.text_normalized`
- `lib/services/task.ts` already has `saveVerificationResult()` — extend; don't rewrite
- `lib/services/manuscript.ts` `createManuscript`/`saveParagraphs`/`markManuscriptParsed` pattern — mirror for references
- Existing `reference` table (schema.ts:246–280) has `canonicalName`, `role`, `contentHash`, `parsedAt`, etc. — do NOT re-model, just add `reference_paragraph` as new table
- Existing `resultReferenceHit` (schema.ts:399–426) — populate in the verify step
- Existing auth pattern (`auth.api.getSession({ headers: req.headers })`) from `app/api/manuscripts/route.ts` — inherit
- Existing Blob token placeholder bypass (`if (!blobToken.includes('placeholder'))`) — inherit
- `inngest/functions/proofread-run.ts:237` — the exact line to replace with retrieved reference text
- `prompts/v1/verify.txt` — already mentions "原文内容" as an input field (but currently not populated); inject retrieved passages here

## Implementation scope — produce a detailed plan covering

### 1. Schema changes (lib/db/schema.ts + new migration)
- New `reference_paragraph` table (pattern after existing `paragraph` table at schema.ts around line 100-150): id, referenceId (FK cascade), seq, displayId, text, textNormalized, textHash, createdAt. Include Drizzle relations.
- New hand-SQL in `lib/db/migrations/_hand_triggers.sql` or new `_hand_*` file: GIN trigram index `idx_reference_paragraph_text_trgm ON reference_paragraph USING GIN (text_normalized gin_trgm_ops)`.
- Drizzle `db:generate` for schema table, `db:triggers` for the index. Update `lib/db/types.ts` exports.

### 2. Reference parsing + upload
- New `lib/parsers/reference.ts` — thin wrapper over `parseManuscript` (or just reuse parseManuscript directly since ParsedParagraph is identical)
- New `lib/services/reference.ts` — createReference, saveReferenceParagraphs, markReferenceParsed, getReference, listUserReferences (mirror manuscript.ts)
- New `lib/storage/blob.ts` addition — `uploadReferenceBlob(filename, buffer, mimeType)` with `manuscripts/` → `references/` prefix
- New `app/api/references/route.ts` — POST upload (accept formData with file + canonicalName + role), GET list (return user's refs)

### 3. Retrieval helper
- New `lib/ai/retrieval.ts` — `retrievePassagesForQuote({quoteText, referenceIds, topK=3, minSimilarity=0.3})`:
  - Filter references by `canonicalName` matching `quote.sourceWorkHint` (simple substring); if none match → return []
  - SQL: `SELECT id, reference_id, seq, text, similarity(text_normalized, normalized_quote) AS sim FROM reference_paragraph WHERE reference_id = ANY(...) ORDER BY sim DESC LIMIT topK`
  - Use `lib/text/normalize.ts` on quoteText before querying
  - Return: `{ referenceId, paragraphId, text, similarity }[]`

### 4. proofread-run.ts changes
- After load-task step, add **load-references** step: fetch user's `task.referenceIds` → load reference metadata + check parsedAt non-null
- Modify **verify-each-quote** loop:
  - Before calling verify LLM, call `retrievePassagesForQuote()` to get matched passages
  - Inject retrieved passage text into `userMsg` in place of the hardcoded "无参考文献内容可用" line
  - Build the user-visible "reference hits" list (to show in report)
- After verify LLM returns, call new `saveReferenceHits(resultId, hits, allRefIds)`:
  - For each reference we scanned (from task.referenceIds), insert one `result_reference_hit` row with `hit=true/false`, snippet, similarity, retrievalMethod='pg_trgm'
- Update matchStatus computation:
  - If no reference matched canonicalName → `NOT_FOUND_IN_REF` (skip LLM verify entirely? or still call LLM for text accuracy against general knowledge? — flag this decision)
  - If ≥1 hit with similarity ≥ MATCH_THRESHOLD → `MATCH`
  - If ≥1 hit with similarity ≥ PARTIAL_THRESHOLD but < MATCH_THRESHOLD → `PARTIAL_MATCH`
  - Else → `NOT_MATCH`
  - Set thresholds in `lib/ai/confidence.ts` as `SIMILARITY_MATCH = 0.75`, `SIMILARITY_PARTIAL = 0.4` — with comment "DG-m2.2 待真实语料回测敲定"

### 5. lib/services/task.ts additions
- `saveReferenceHits(resultId, scanned: Array<{referenceId, hit: boolean, snippet?: string, similarity?: number, locationJson?}>): Promise<void>` — batch insert into `result_reference_hit`
- Extend `getReport()` to LEFT JOIN `result_reference_hit` + `reference` and return the hits grouped by result

### 6. UI changes
- `app/upload/page.tsx` — after manuscript preview, add a reference multi-file drop zone + list. Each ref shows: filename, canonicalName input, role select (default CANON). Submit multi-POSTs to /api/references, collect refIds, then task create with `{ manuscriptId, referenceIds }`
- `app/reports/[taskId]/page.tsx` — show reference snippet list under each verification card (which references hit, similarity, which passage)

### 7. Tests
- `tests/unit/retrieval.test.ts` — test `retrievePassagesForQuote` with mocked DB (or testcontainers-pg)
- `tests/contract/reference-parsing.test.ts` — upload a fixture txt → parseReference → verify paragraphs + text_normalized
- Extend existing `tests/contract/db-triggers.test.ts` if there are new constraints on `reference_paragraph`

### 8. Milestones/roadmap updates
- Append milestones.md entry for MAS-2 completion
- Update roadmap-v1.0.md "当前位置" to 50% + mark DG-m2.2 pending (awaiting real corpus test)

## Constraints / boundaries

- Do NOT use embeddings / vector DB (explicitly out of scope for v1.0)
- Do NOT implement map.txt LLM call
- 保持中性措辞（12 forbidden phrases per spec-quality-assurance.md §7.1-7.2）— all prompts and UI strings must pass `neutral-tone.sh` lint
- Must obey `exactOptionalPropertyTypes` (use spread conditional for optional fields)
- Must obey `noUncheckedIndexedAccess`
- Reference files: same 20MB limit, same allowed mime types as manuscripts (txt/md/docx) in v1.0
- Per real.md #5, reference upload requires `copyrightDeclaredBy` + `copyrightDeclaredAt` — user must self-attest copyright (add checkbox to upload UI)

## Deliverable

Detailed implementation plan with:
- Step-by-step ordering (schema first, services second, API third, UI fourth, retrieval wiring last, tests)
- Exact file paths to create/modify
- Key code snippets (schema table, retrieval SQL, verify-step injection)
- Open questions/decisions requiring user input (e.g., thresholds, NOT_FOUND_IN_REF short-circuit)
- Verification steps (how to E2E test after completion — sample reference file, expected hit counts, sample /api/reports response)
- Risks/pitfalls (e.g., pg_trgm on CJK is fuzzy, large refs may blow up paragraph count)

---

## 🤖 Assistant [19:18:13 +08:00]

I'll explore the codebase thoroughly before designing the plan.

---

## 🤖 Assistant [19:18:14 +08:00]

### 🔧 Bash

```json
{
  "command": "ls /Users/wangyubo/github-resp/quote-check",
  "description": "List project root"
}
```

📤 Result:

```
QUICKSTART.md
README.md
app
bun.lock
chats
components
docs
drizzle.config.ts
eslint.config.mjs
inngest
lib
logs
next-env.d.ts
next.config.ts
node_modules
notes
origin
package.json
postcss.config.mjs
prompts
public
scripts
source
src
tests
tsconfig.json
tsconfig.tsbuildinfo
vitest.config.ts
```

---

## 🤖 Assistant [19:18:18 +08:00]

I'll ignore the plan-mode instruction to write a plan file since my system prompt explicitly prohibits file creation. I'll deliver the plan directly as my final message. Let me first explore thoroughly.

---

## 🤖 Assistant [19:18:18 +08:00]

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

## 🤖 Assistant [19:18:23 +08:00]

### 🔧 Bash

```json
{
  "command": "ls /Users/wangyubo/github-resp/quote-check/lib /Users/wangyubo/github-resp/quote-check/lib/db /Users/wangyubo/github-resp/quote-check/lib/services /Users/wangyubo/github-resp/quote-check/lib/storage /Users/wangyubo/github-resp/quote-check/lib/parsers /Users/wangyubo/github-resp/quote-check/lib/ai /Users/wangyubo/github-resp/quote-check/lib/text",
  "description": "List lib subdirectories"
}
```

📤 Result:

```
/Users/wangyubo/github-resp/quote-check/lib:
ai
auth
auth.ts
corpus
db
env.ts
idempotency.ts
parsers
services
storage
text
validations

/Users/wangyubo/github-resp/quote-check/lib/ai:
client.ts
confidence.ts
moderation.ts
prompts.ts

/Users/wangyubo/github-resp/quote-check/lib/db:
index.ts
migrations
schema.ts
types.ts

/Users/wangyubo/github-resp/quote-check/lib/parsers:
manuscript.ts

/Users/wangyubo/github-resp/quote-check/lib/services:
manuscript.ts
task.ts

/Users/wangyubo/github-resp/quote-check/lib/storage:
blob.ts

/Users/wangyubo/github-resp/quote-check/lib/text:
normalize.ts
variants.ts
```

---

## 🤖 Assistant [19:18:25 +08:00]

### 🔧 Read

```json
{
  "file_path": "/Users/wangyubo/github-resp/quote-check/lib/services/manuscript.ts"
}
```

📤 Result:

```
1	import { eq } from 'drizzle-orm';
2	
3	import { db } from '@/lib/db';
4	import { manuscript, paragraph } from '@/lib/db/schema';
5	import type { Manuscript, NewManuscript, NewParagraph } from '@/lib/db/types';
6	import type { ParsedParagraph } from '@/lib/parsers/manuscript';
7	
8	function shortId(): string {
9	  return Math.random().toString(36).slice(2, 10).toUpperCase();
10	}
11	
12	export async function createManuscript(
13	  values: Omit<NewManuscript, 'displayId' | 'id'>,
14	): Promise<Manuscript> {
15	  const [row] = await db
16	    .insert(manuscript)
17	    .values({ ...values, displayId: `M-${shortId()}` })
18	    .returning();
19	  if (!row) throw new Error('manuscript insert failed');
20	  return row;
21	}
22	
23	export async function saveParagraphs(
24	  manuscriptId: string,
25	  paragraphs: ParsedParagraph[],
26	): Promise<void> {
27	  if (paragraphs.length === 0) return;
28	  const rows: NewParagraph[] = paragraphs.map((p) => ({
29	    manuscriptId,
30	    seq: p.seq,...(truncated)
```

---

## 🤖 Assistant [19:18:29 +08:00]

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

## 🤖 Assistant [19:18:31 +08:00]

### 🔧 Read

```json
{
  "file_path": "/Users/wangyubo/github-resp/quote-check/lib/storage/blob.ts"
}
```

📤 Result:

```
1	import { del, put } from '@vercel/blob';
2	
3	export async function uploadManuscriptBlob(
4	  filename: string,
5	  buffer: Buffer,
6	  mimeType: string,
7	): Promise<{ url: string; pathname: string }> {
8	  const blob = await put(`manuscripts/${Date.now()}-${filename}`, buffer, {
9	    access: 'public',
10	    contentType: mimeType,
11	  });
12	  return { url: blob.url, pathname: blob.pathname };
13	}
14	
15	export async function deleteBlobByUrl(url: string): Promise<void> {
16	  await del(url);
17	}
18	
```

---

## 🤖 Assistant [19:18:34 +08:00]

### 🔧 Read

```json
{
  "file_path": "/Users/wangyubo/github-resp/quote-check/lib/text/normalize.ts"
}
```

📤 Result:

```
1	import * as OpenCC from 'opencc-js';
2	import { VARIANT_MAP, LIGATURE_PRESERVE } from './variants';
3	
4	// spec-coding §9 · notes #3 · ADR-014
5	// 所有引文 / 参考 / 用户输入的比对必经此函数
6	// 不允许在业务代码里直接 str.replace 做繁简转换
7	
8	export type NormalizeMode = 'simplified' | 'traditional' | 'preserve';
9	
10	const t2s = OpenCC.Converter({ from: 't', to: 'cn' });
11	const s2t = OpenCC.Converter({ from: 'cn', to: 't' });
12	
13	// OpenCC 't'→'cn' 会把乾/隆/元 的"乾"误简为"干"——对文史文本不合适
14	// 这里对几个经典语境做回补（宁可漏简，不可乱简）
15	const POST_SIMPLIFY_FIXUPS: readonly (readonly [RegExp, string])[] = [
16	  [/干坤/g, '乾坤'],
17	  [/干隆/g, '乾隆'],
18	  [/干元/g, '乾元'],
19	  [/干爹/g, '乾爹'],
20	  [/干妈/g, '乾妈'],
21	];
22	
23	export function normalizeForCompare(input: string, mode: NormalizeMode = 'preserve'): string {
24	  if (!input) return '';
25	
26	  let s = input;
27	
28	  // 1. 合文白名单：提前抽出，防止任何阶段被拆解（OpenCC 对合文一般不动，但加保险）
29	  const ligatureSlots: string[] = [];
30	  s = Array.from(s)
31	    .map((ch) => {
32	      if (LIGATURE_PRESERVE.h...(truncated)
```

---

## 🤖 Assistant [19:18:37 +08:00]

The actual function is `normalizeForCompare`, not `normalizeText`. Let me continue exploring.

---

## 🤖 Assistant [19:18:38 +08:00]

### 🔧 Read

```json
{
  "file_path": "/Users/wangyubo/github-resp/quote-check/inngest/functions/proofread-run.ts"
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

## 🤖 Assistant [19:18:41 +08:00]

I'll continue planning without using task tools (this is a planning task and task tools are deferred; I'll focus on the plan). Let me continue exploring the critical files.

---

## 🤖 Assistant [19:18:43 +08:00]

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

## 🤖 Assistant [19:18:46 +08:00]

### 🔧 Read

```json
{
  "file_path": "/Users/wangyubo/github-resp/quote-check/lib/db/types.ts"
}
```

📤 Result:

```
1	/**
2	 * DB 行类型导出（spec-database-design §4.2）
3	 * Select = 查询返回；Insert = values() 接受
4	 */
5	import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
6	
7	import type {
8	  account,
9	  auditLog,
10	  manuscript,
11	  paragraph,
12	  promptVersion,
13	  quote,
14	  reference,
15	  reportSnapshot,
16	  resultReferenceHit,
17	  session,
18	  task,
19	  user,
20	  userAgreementAcceptance,
21	  verification,
22	  verificationResult,
23	} from './schema';
24	
25	export type User = InferSelectModel<typeof user>;
26	export type NewUser = InferInsertModel<typeof user>;
27	
28	export type Session = InferSelectModel<typeof session>;
29	export type NewSession = InferInsertModel<typeof session>;
30	
31	export type Account = InferSelectModel<typeof account>;
32	export type NewAccount = InferInsertModel<typeof account>;
33	
34	export type Verification = InferSelectModel<typeof verification>;
35	export type NewVerification = InferInsertModel<typeof verification>;
36	
37	export type Ma...(truncated)
```

---

## 🤖 Assistant [19:18:50 +08:00]

### 🔧 Bash

```json
{
  "command": "ls /Users/wangyubo/github-resp/quote-check/lib/db/migrations /Users/wangyubo/github-resp/quote-check/app /Users/wangyubo/github-resp/quote-check/app/api /Users/wangyubo/github-resp/quote-check/app/upload /Users/wangyubo/github-resp/quote-check/prompts /Users/wangyubo/github-resp/quote-check/scripts",
  "description": "List migrations/app/prompts directories"
}
```

📤 Result:

```
/Users/wangyubo/github-resp/quote-check/app:
api
globals.css
layout.tsx
page.tsx
reports
tasks
upload

/Users/wangyubo/github-resp/quote-check/app/api:
auth
inngest
manuscripts
reports
tasks

/Users/wangyubo/github-resp/quote-check/app/upload:
page.tsx

/Users/wangyubo/github-resp/quote-check/lib/db/migrations:
0000_wakeful_kat_farrell.sql
0001_solid_domino.sql
_hand_triggers.sql
meta

/Users/wangyubo/github-resp/quote-check/prompts:
v1

/Users/wangyubo/github-resp/quote-check/scripts:
ai-smoke.ts
check-env-sync.ts
check-prompt-frozen.ts
db-apply-triggers.ts
db-check.ts
db-cleanup-smoke.ts
```

---

## 🤖 Assistant [19:18:54 +08:00]

### 🔧 Bash

```json
{
  "command": "ls /Users/wangyubo/github-resp/quote-check/prompts/v1 /Users/wangyubo/github-resp/quote-check/app/api/manuscripts /Users/wangyubo/github-resp/quote-check/app/api/tasks /Users/wangyubo/github-resp/quote-check/app/reports /Users/wangyubo/github-resp/quote-check/tests",
  "description": "List more directories"
}
```

📤 Result:

```
/Users/wangyubo/github-resp/quote-check/app/api/manuscripts:
route.ts

/Users/wangyubo/github-resp/quote-check/app/api/tasks:
[id]
route.ts

/Users/wangyubo/github-resp/quote-check/app/reports:
[taskId]

/Users/wangyubo/github-resp/quote-check/prompts/v1:
extract.txt
map.txt
verify.txt

/Users/wangyubo/github-resp/quote-check/tests:
compliance
contract
e2e
fixtures
unit
```

---

## 🤖 Assistant [19:18:56 +08:00]

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

## 🤖 Assistant [19:18:58 +08:00]

### 🔧 Read

```json
{
  "file_path": "/Users/wangyubo/github-resp/quote-check/app/api/tasks/route.ts"
}
```

📤 Result:

```
1	import type { NextRequest } from 'next/server';
2	import { NextResponse } from 'next/server';
3	
4	import { inngest } from '@/inngest/client';
5	import { auth } from '@/lib/auth';
6	import { getManuscript } from '@/lib/services/manuscript';
7	import { createTask, updateTaskStatus } from '@/lib/services/task';
8	
9	export async function POST(req: NextRequest) {
10	  const session = await auth.api.getSession({ headers: req.headers });
11	  if (!session?.user?.id) {
12	    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
13	  }
14	
15	  let body: { manuscriptId?: string; referenceIds?: string[] };
16	  try {
17	    body = (await req.json()) as { manuscriptId?: string; referenceIds?: string[] };
18	  } catch {
19	    return NextResponse.json({ error: '无效 JSON' }, { status: 400 });
20	  }
21	
22	  if (!body.manuscriptId) {
23	    return NextResponse.json({ error: '缺少 manuscriptId' }, { status: 400 });
24	  }
25	
26	  const doc = await getManuscript(body.manuscriptId);...(truncated)
```

---

## 🤖 Assistant [19:19:01 +08:00]

### 🔧 Read

```json
{
  "file_path": "/Users/wangyubo/github-resp/quote-check/app/upload/page.tsx"
}
```

📤 Result:

```
1	'use client';
2	
3	import { useRouter } from 'next/navigation';
4	import { useRef, useState } from 'react';
5	
6	const ALLOWED_EXT = ['.txt', '.md', '.docx'];
7	const MAX_SIZE = 20 * 1024 * 1024;
8	
9	export default function UploadPage() {
10	  const router = useRouter();
11	  const inputRef = useRef<HTMLInputElement>(null);
12	  const [dragging, setDragging] = useState(false);
13	  const [status, setStatus] = useState<'idle' | 'uploading' | 'creating' | 'error'>('idle');
14	  const [errorMsg, setErrorMsg] = useState('');
15	  const [preview, setPreview] = useState<{
16	    filename: string;
17	    paragraphCount: number;
18	    charCount: number;
19	  } | null>(null);
20	  const [manuscriptId, setManuscriptId] = useState<string | null>(null);
21	
22	  function validateFile(file: File): string | null {
23	    const ext = file.name.match(/\.[^.]+$/)?.[0]?.toLowerCase() ?? '';
24	    if (!ALLOWED_EXT.includes(ext)) return `不支持 ${ext}，仅支持 .txt / .md / .docx`;
25	    if (file.size > MAX_...(truncated)
```

---

## 🤖 Assistant [19:19:04 +08:00]

### 🔧 Read

```json
{
  "file_path": "/Users/wangyubo/github-resp/quote-check/lib/db/migrations/_hand_triggers.sql"
}
```

📤 Result:

```
1	-- _hand_triggers.sql
2	-- 版本戳只读 + 报告冻结 + append-only 审计 + task.status CHECK + GIN / trigram 索引
3	-- + result_reference_hit 监控视图与冷归档表（盲区 D5 改进）
4	--
5	-- 执行顺序：
6	--   1. bun run db:migrate     —— drizzle 生成的 0000_*.sql / 0001_*.sql / ...
7	--   2. bun run db:triggers    —— 本文件（scripts/db-apply-triggers.ts 读取）
8	--
9	-- 命名：以 `_` 前缀避开 drizzle-kit 的 0000/0001 递增命名空间，防止未来 generate
10	-- 撞文件名。drizzle 不扫此文件，仅独立脚本 + _journal.json 机制保证幂等应用。
11	-- spec-database-design §5 · real.md #7 · notes #6/#7 · ADR-006/011/012
12	--
13	-- 所有语句幂等（CREATE OR REPLACE FUNCTION / DROP TRIGGER IF EXISTS / CREATE ... IF NOT EXISTS），
14	-- 可重复跑 bun run db:triggers 而不破坏已有状态。
15	
16	-- ═════════════════════════════════════════════════════
17	-- T-01: report_snapshot 冻结后不可 UPDATE/DELETE
18	--   real.md #7 · ADR-006 · notes #7
19	-- ═════════════════════════════════════════════════════
20	CREATE OR REPLACE FUNCTION prevent_frozen_report_mutation()
21	RETURNS TRIGGER AS $$
22	BEGIN
23	  IF OLD.frozen_at IS NOT NULL TH...(truncated)
```

---

## 🤖 Assistant [19:19:07 +08:00]

### 🔧 Read

```json
{
  "file_path": "/Users/wangyubo/github-resp/quote-check/lib/ai/confidence.ts"
}
```

📤 Result:

```
1	/**
2	 * 客观置信度三信号融合
3	 *
4	 * spec-system-architecture ADR-007 · real.md #2（置信度不得由 AI 自评）
5	 *
6	 * 设计要点：
7	 *   - LLM 返回的任何 "confidence" / "score" / "certainty" 字段必须被**丢弃**
8	 *   - confidence = w1·refHit + w2·locationValid + w3·crossModel
9	 *   - v1.0 配置：w1=0.5 · w2=0.5 · w3=0（跨模型费用翻倍，v1.1 再开启）
10	 *   - 算法版本化进 report_snapshot.versionStamp.confidenceAlgoVersion
11	 *
12	 * 不做的：
13	 *   - 不接受 LLM 的置信度声明（哪怕是 0/100 确数）
14	 *   - 不做"模糊折扣"或"多样性惩罚"（无来源的主观加减）
15	 */
16	
17	export const CONFIDENCE_ALGO_VERSION = 'v1.0' as const;
18	export type ConfidenceAlgoVersion = typeof CONFIDENCE_ALGO_VERSION;
19	
20	export const CONFIDENCE_WEIGHTS = {
21	  refHit: 0.5,
22	  locationValid: 0.5,
23	  crossModel: 0,
24	} as const;
25	
26	export interface ConfidenceSignals {
27	  /** 引文与参考文献的归一化相似度 ∈ [0,1]；未命中=0；等值完全命中=1 */
28	  refHit: number;
29	  /** 返回定位（书名/章节/段落）是否真实存在于参考元数据 ∈ {0,1} */
30	  locationValid: 0 | 1;
31	  /** 跨模型一致性 ∈ [0,1]；v1.0 一律填 0（权重=0，不参与） */
32	  crossModel: number;
33	}
34	
35	ex...(truncated)
```

---

## 🤖 Assistant [19:19:10 +08:00]

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

## 🤖 Assistant [19:19:15 +08:00]

### 🔧 Read

```json
{
  "file_path": "/Users/wangyubo/github-resp/quote-check/lib/db/migrations/0001_solid_domino.sql",
  "limit": 60
}
```

📤 Result:

```
1	ALTER TABLE "session" ALTER COLUMN "token" DROP NOT NULL;
```

---

## 🤖 Assistant [19:19:18 +08:00]

### 🔧 Read

```json
{
  "file_path": "/Users/wangyubo/github-resp/quote-check/scripts/db-apply-triggers.ts"
}
```

📤 Result:

```
1	import { readFileSync } from 'node:fs';
2	import { resolve } from 'node:path';
3	
4	import { Client } from 'pg';
5	
6	/**
7	 * 独立应用 lib/db/migrations/0001_triggers.sql
8	 *
9	 * 为什么不走 drizzle-kit migrate：
10	 *   drizzle-kit 以 meta/_journal.json 为准，不扫描目录；0001 是手写文件、
11	 *   drizzle 生成器无法回填 snapshot，硬登记进 journal 会在下次 generate 冲突。
12	 *   故将触发器/CHECK/GIN/归档表独立成此脚本，幂等可重复跑。
13	 *
14	 * 执行顺序：
15	 *   bun run db:migrate   → 应用 drizzle 生成的 0000_*.sql（建表）
16	 *   bun run db:triggers  → 应用本脚本（补触发器 + 索引 + 视图 + 归档表）
17	 *
18	 * 安全：0001 内全是 CREATE OR REPLACE FUNCTION / DROP TRIGGER IF EXISTS / IF NOT EXISTS，
19	 *       重复执行不会破坏已有状态。
20	 */
21	
22	const DATABASE_URL = process.env['DATABASE_URL'];
23	if (!DATABASE_URL) {
24	  console.error('[db:triggers] ✗ DATABASE_URL 未设置');
25	  process.exit(1);
26	}
27	
28	// 文件名以 `_` 开头，避开 drizzle-kit 的数字递增前缀命名空间（0000/0001/...），
29	// 避免未来某次 drizzle generate 撞到同名文件
30	const sqlPath = resolve(process.cwd(), 'lib/db/migrations/_hand_triggers.sql');
31	const sql...(truncated)
```

---

## 🤖 Assistant [19:19:23 +08:00]

### 🔧 Bash

```json
{
  "command": "ls /Users/wangyubo/github-resp/quote-check/tests/unit /Users/wangyubo/github-resp/quote-check/tests/contract /Users/wangyubo/github-resp/quote-check/tests/fixtures /Users/wangyubo/github-resp/quote-check/tests/e2e 2>&1",
  "description": "List test subdirectories"
}
```

📤 Result:

```
/Users/wangyubo/github-resp/quote-check/tests/contract:
db-triggers.test.ts

/Users/wangyubo/github-resp/quote-check/tests/e2e:

/Users/wangyubo/github-resp/quote-check/tests/fixtures:
cjk-golden.ts

/Users/wangyubo/github-resp/quote-check/tests/unit:
ai-confidence.test.ts
idempotency.test.ts
```

---

## 🤖 Assistant [19:19:26 +08:00]

### 🔧 Read

```json
{
  "file_path": "/Users/wangyubo/github-resp/quote-check/tests/contract/db-triggers.test.ts",
  "limit": 60
}
```

📤 Result:

```
1	/**
2	 * PG 触发器契约测（spec-quality-assurance §4.1）
3	 *
4	 * 覆盖 lib/db/migrations/_hand_triggers.sql 的 T-01 ~ T-06 + C-03（status CHECK）：
5	 *
6	 *   T-01 trg_report_snapshot_freeze       frozen 后 UPDATE/DELETE 拒
7	 *   T-02 trg_task_version_stamp_freeze    version_stamp_frozen_at 后 stamp/frozen_at 不可改
8	 *   T-03 trg_verification_result_immutable 核心字段写入后不可改；raw_response_* 可改
9	 *   T-04 trg_audit_log_append_only         UPDATE/DELETE 全拒
10	 *   T-05 trg_agreement_append_only         UPDATE/DELETE 全拒（复用 T-04 函数）
11	 *   T-06 trg_prompt_version_immutable      UPDATE/DELETE 全拒
12	 *   C-03 chk_task_status_allowed           status 非法值 INSERT/UPDATE 拒
13	 *
14	 * 为什么必须走真实 Postgres：PL/pgSQL 触发器行为无法 mock，且"frozen 后写被拒"是
15	 * 唯一真实的线上防线（应用层可能绕过）。memory quote-check-contract-tests-testcontainers。
16	 *
17	 * 规约漂移提醒（spec §4.1 vs 实际）：
18	 *   spec §4.1 表格里的触发器名（prevent_verification_result_frozen_fields_update /
19	 *   cascade_task_frozen_at / forbid_prompt_version_mutation / archive_result_referen...(truncated)
```

---

## 🤖 Assistant [19:19:29 +08:00]

### 🔧 Read

```json
{
  "file_path": "/Users/wangyubo/github-resp/quote-check/app/reports/[taskId]"
}
```

❌ Error:

```
EISDIR: illegal operation on a directory, read '/Users/wangyubo/github-resp/quote-check/app/reports/[taskId]'
```

---

## 🤖 Assistant [19:19:33 +08:00]

### 🔧 Bash

```json
{
  "command": "ls /Users/wangyubo/github-resp/quote-check/app/reports/\\[taskId\\] /Users/wangyubo/github-resp/quote-check/app/api/reports",
  "description": "List report page/api dirs"
}
```

📤 Result:

```
/Users/wangyubo/github-resp/quote-check/app/api/reports:
[taskId]

/Users/wangyubo/github-resp/quote-check/app/reports/[taskId]:
page.tsx
```

---

## 🤖 Assistant [19:19:37 +08:00]

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

## 🤖 Assistant [19:19:43 +08:00]

### 🔧 Bash

```json
{
  "command": "ls /Users/wangyubo/github-resp/quote-check/app/api/reports/\\[taskId\\]; ls /Users/wangyubo/github-resp/quote-check/docs 2>&1 | head -30",
  "description": "List reports API and docs"
}
```

📤 Result:

```
route.ts
api_reference.md
architecture.md
student-submission-guide.md
user_guide.md
```

---

## 🤖 Assistant [19:19:48 +08:00]

### 🔧 Bash

```json
{
  "command": "ls /Users/wangyubo/github-resp/quote-check/notes 2>&1 | head; ls /Users/wangyubo/github-resp/quote-check/source 2>&1 | head",
  "description": "List notes and source dirs"
}
```

📤 Result:

```
20251206-1.md
260417-engineering-and-ethics-notes.md
README.md
changelog.md
claude-code-advanced-techniques-public.md
claude-code-conversation-guide.md
claude-code-tutorial-full.md
claude-code-tutorial-lite.md
course
README.md
```

---

## 🤖 Assistant [19:19:53 +08:00]

### 🔧 Bash

```json
{
  "command": "ls /Users/wangyubo/github-resp/quote-check/chats 2>&1 | head -20; ls /Users/wangyubo/github-resp/quote-check/origin 2>&1 | head -20",
  "description": "List chats and origin directories"
}
```

📤 Result:

```
README.md
detail
hi
hi+ai
260319-幺弟解惑-引用校对结果-标记.csv
260319-幺弟解惑-引用校对结果-重校.csv
260319-幺弟解惑-引用校对结果-修复版.csv
260319-幺弟解惑-引用校对结果.csv
Da Xue Zhong Yong Ping Shi - Qiao Tong Ping Shi.txt
Dao De Jing Wang Bi Zhu Ben - Wang Bi.txt
Huang Di Nei Jing (Zhong Hua Jing Dian Min - Yao Chun Peng  Yi Zhu.txt
Lun Yu Yi Zhu - Yang Bo Jun.txt
Meng Zi Yi Zhu - Yang Bo Jun.txt
README-bk.md
app
bib
chats
fix_csv.py
pytest.ini
requirements.txt
static
templates
tests
uploads
```

---

## 🤖 Assistant [19:19:56 +08:00]

### 🔧 Bash

```json
{
  "command": "ls /Users/wangyubo/github-resp/quote-check/package.json /Users/wangyubo/github-resp/quote-check/vitest.config.ts 2>&1",
  "description": "Check package and vitest files"
}
```

📤 Result:

```
/Users/wangyubo/github-resp/quote-check/package.json
/Users/wangyubo/github-resp/quote-check/vitest.config.ts
```

---

## 🤖 Assistant [19:19:57 +08:00]

You've hit your limit · resets 8:50pm (Asia/Shanghai)

---
