---
name: spec-coding
description: 文史类引用校对软件 v1.0 编码规范规约——Next.js 15 + Drizzle + Inngest + Vercel AI SDK 栈下的项目定制编码约束，含 real.md 7 条硬约束 + notes 7 条工程/伦理约束在代码层的强制落地（禁 AI 自评 / 日志脱敏 / 文史字符 / 幂等键 / 版本锁定 / 禁总分 / 禁"自动"话术）
version: v1.0.0-draft
generated_by: dev-coding skill
depends_on:
  - .42cog/meta/meta.md
  - .42cog/cog/cog.md
  - .42cog/real/real.md
  - .42cog/spec/spec-product-requirements.md
  - .42cog/spec/spec-user-story.md
  - .42cog/spec/spec-system-architecture.md
  - .42cog/spec/spec-database-design.md
  - .42cog/spec/spec-ui-design.md
  - notes/260417-engineering-and-ethics-notes.md
stack_lock:
  language: TypeScript 5.4+ (strict: true, noUncheckedIndexedAccess: true)
  runtime: Node 20 LTS (Vercel) / Bun 1.1+ (local dev)
  framework: Next.js 15 (App Router) + React 19
  orm: Drizzle 0.30+ (查询层) / drizzle-kit 0.22+ (迁移)
  db_driver: "@neondatabase/serverless"
  ai_sdk: Vercel AI SDK 3.x + "@ai-sdk/openai" (baseURL override → siliconflow)
  long_task: Inngest 3.x (functions + step.run + Realtime)
  auth: Better Auth 0.7+
  validation: Zod 3.23+
  logger: Pino 9.x + pino-pretty (dev)
  testing: Vitest (unit/integration) + Playwright (E2E)
  lint: ESLint 9 (flat config) + typescript-eslint + 自定义规则
  formatter: Prettier 3.x (statement-level)
  package_mgr: Bun (lockfile = bun.lockb)
created: 2026-04-19
---

# 编码规范规约（Coding Standards）

## 0. 读法

- **上游**：real.md（4 必选 + 3 可选）、notes（7 条工程伦理）、系统架构（16 ADR）、数据库（Drizzle schema + 6 PG 触发器）、UI（12 核心组件 + OKLCH 皮肤）、产品/用户故事（12 affordance + 25 MS）
- **本规约**：把编码标准**项目化**——通用 TS/React 最佳实践放附录 A 简述，正文全部是"因为项目硬约束所以必须/禁止"的条目
- **下游**：`dev-coding` 的"产出"是**脚手架 + 骨架代码**；`dev-quality-assurance` 据 §19 测试基线 + §21 CI 清单写 E2E / 合规检测；本规约之后不再追加新 spec

---

## 1. Context：与 SKILL.md 默认模板的三处偏离

### 1.1 偏离 A：产出 spec-coding.md 而非直接写代码

SKILL.md 默认路径："understand spec → apply coding standards → write code"。**本次不写代码**，理由：

1. 项目既定约定"先规约后代码"——`origin/` 之外无活码，脚手架未起
2. 编码规范需前置固化为 `.42cog/spec/spec-coding.md`，方便 `dev-coding` 执行时和 `dev-quality-assurance` 审查时对照同一准绳
3. 项目硬约束密度高（real 7 + notes 7 + ADR 16 + UI 禁忌 + DB 触发器），不前置成文 → 脚手架代码必然遗漏

### 1.2 偏离 B：Next.js 15 + RSC 优先，不走传统 Pages Router

SKILL.md 示例（Phase 5）展示 `app/api/.../route.ts` 的 `NextRequest/NextResponse` 写法，属 Route Handler。**本项目额外强制**：

- **默认服务器组件**（RSC），只有明确需要客户端交互的组件才加 `"use client"`
- **Server Actions 优先于 Route Handler**——表单提交、Mutation 首选 `'use server'` 函数；Route Handler 保留给 SSE、签名 URL、第三方 webhook
- 不使用 `getServerSideProps` / `getStaticProps` / Pages Router 任何 API

### 1.3 偏离 C：密码由 Better Auth 托管，不直接调 bcrypt

SKILL.md Phase 6 示例 `hashPassword() = bcrypt.hash(password, 12)`。**本项目禁止**在应用代码里直接调 bcrypt/argon2：

- Better Auth 内置 argon2id + session 管理 + 邮箱验证
- 应用代码只能调 `auth.api.signUpEmail()` / `auth.api.signInEmail()`，不得触碰原始密码字段
- 例外：仅 `lib/auth.ts` 配置文件可 override Better Auth 的 hasher 参数

---

## 2. 技术栈锁定

### 2.1 版本锁定表

| 层 | 选型 | 版本下限 | 锁定理由 |
|---|------|---------|---------|
| TypeScript | strict + noUncheckedIndexedAccess | 5.4 | 类型安全底线（ADR-001） |
| Next.js | App Router + RSC | 15.0 | React 19 + Server Actions 稳定（ADR-001） |
| Drizzle | 查询层 + drizzle-kit 迁移 | 0.30 | pgEnum + neon-http 驱动支持（ADR-003） |
| Neon driver | @neondatabase/serverless | 0.9 | HTTP driver 免长连接（ADR-003） |
| Inngest | functions + Realtime | 3.16 | `publish`/`subscribe` API（ADR-002/009） |
| Vercel AI SDK | core + @ai-sdk/openai | 3.4 | `generateObject` + baseURL override（ADR-005） |
| Better Auth | core + admin plugin | 0.7 | B/C role + session 时长配置（ADR-004） |
| Zod | schema + 宽松 LLM 变体 | 3.23 | `.passthrough().catch()` 支持（ADR-012） |
| Pino | + pino-redact | 9.0 | redaction paths 语法（ADR-015） |
| OpenCC | opencc-js | 1.0.5 | 繁简转换权威实现（ADR-014） |

**升级策略**：所有依赖 **pin 到精确版本**（`package.json` 不用 `^` 或 `~`），升级走 PR + 回归测试；不允许 `bun update` 全量跳版本。

### 2.2 禁用清单（永久）

| 禁用 | 原因 | 替代 |
|---|---|---|
| `any` 类型 | ADR-001 类型安全 | `unknown` + 类型守卫 |
| `@ts-ignore` | 掩盖问题 | `@ts-expect-error` + 注释根因（仅允许 `lib/text/*` 处理 CJK Ext B-G 时的 Unicode 兼容，且需 TODO 关联 issue） |
| `console.log` 生产代码 | 无脱敏 | `logger.info()`（Pino 配 redact） |
| `process.env.X` 直接读 | 无校验 | `lib/env.ts` 统一 Zod 校验 |
| `fetch` 直连 LLM API | 绕过 AI SDK | `lib/ai/client.ts` 封装 |
| `.execute(sql)` 应用代码 | 绕过 ORM | Drizzle query builder；迁移除外 |
| Pages Router API | ADR-001 | Route Handler / Server Action |
| `bcrypt.hash` 应用代码 | §1.3 | Better Auth |
| `crypto.randomUUID()` 业务主键 | `cog.md` 要求业务 ID（`{task_id}-quote-{n}`） | `lib/id.ts` 业务 ID 生成器；UUID 仅作内部 surrogate key |
| `Math.random()` | 不可复现 | `crypto.getRandomValues()`；测试用 seedrandom |
| `new Date()` 业务逻辑 | 测试不稳 | `lib/clock.ts` 提供可注入的 `now()` |
| `JSON.parse` LLM 输出 | schema 不可信 | `generateObject` + Zod；或 `jsonRepair()` 兜底 |
| `innerHTML` / `dangerouslySetInnerHTML` | XSS | React 默认转义；必要时走 `sanitizeHtml` |

---

## 3. 目录结构强制约定

（与系统架构规约 §6 对齐，本节列**硬约束**）

```
quote-check/
├── app/                   # Next.js 路由（App Router）
├── components/            # UI 组件（PascalCase 目录 + kebab-case 文件）
├── lib/                   # 纯函数 + 基础设施（camelCase 文件）
│   ├── ai/                # AI SDK 封装（ADR-005/008）
│   ├── auth.ts            # Better Auth 配置
│   ├── clock.ts           # 时间注入
│   ├── corpus/            # SourceCorpusProvider 接口（ADR-011）
│   ├── db/                # Drizzle schema + client
│   ├── env.ts             # 环境变量 Zod 校验
│   ├── errors.ts          # ErrorCode 枚举 + typed errors
│   ├── id.ts              # 业务 ID 生成
│   ├── idempotency.ts     # 幂等 key 构造（notes #4）
│   ├── logger.ts          # Pino + redaction（notes #2）
│   ├── parsers/           # docx / pdf / epub 解析
│   ├── prompts/           # prompt 加载 + SHA256（ADR-012）
│   ├── storage/           # Vercel Blob 封装
│   ├── text/              # OpenCC + CJK 工程（notes #3）
│   ├── version-stamp.ts   # 冻结三元组
│   └── utils.ts           # 通用小工具
├── inngest/               # 所有后台工作流
├── prompts/v1/            # 冻结 prompt（只读资产）
├── tests/
└── origin/                # Python MVP 只读归档
```

### 3.1 禁止跨层调用

- `app/` 不可 import `inngest/*`（除 `app/api/inngest/route.ts` 挂载 handler）
- `components/` 不可 import `lib/db/*`（禁客户端打 DB 驱动到 bundle）
- `lib/*` 不可 import `app/*`（循环依赖）
- `inngest/*` 不可 import `components/*`（后台任务无 UI）

**落地**：ESLint `import/no-restricted-paths` 配置强制。

### 3.2 文件命名

| 种类 | 位置 | 命名 | 例 |
|---|---|---|---|
| 路由页 | `app/**/page.tsx` | lowercase 路径段 | `app/tasks/[id]/page.tsx` |
| Layout | `app/**/layout.tsx` | 固定 | `app/(main)/layout.tsx` |
| 路由处理器 | `app/api/**/route.ts` | 固定 | `app/api/manuscripts/route.ts` |
| Server Action 文件 | `app/**/actions.ts` | 固定 | `app/references/actions.ts` |
| UI 组件（集合） | `components/<feature>/` | kebab-case | `components/quote-card/index.tsx` |
| UI 组件（单文件） | `components/<Name>.tsx` | PascalCase | `components/VersionStampBadge.tsx` |
| Hook | `hooks/use*.ts` | camelCase | `hooks/useTaskStream.ts` |
| Lib 模块 | `lib/**/*.ts` | camelCase | `lib/ai/moderation.ts` |
| Inngest function | `inngest/functions/*.ts` | kebab-case | `inngest/functions/proofread-run.ts` |
| 类型定义 | `lib/db/types.ts` / `types/*.ts` | camelCase | `lib/db/types.ts` |
| 测试 | 同目录 `*.test.ts` 或 `tests/` | 对应源文件 | `lib/ai/moderation.test.ts` |

---

## 4. TypeScript 强制项

### 4.1 tsconfig 必开

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,   // arr[i] 是 T | undefined
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,  // foo?: T 不等同 foo: T | undefined
    "noPropertyAccessFromIndexSignature": true,
    "verbatimModuleSyntax": true,        // import type 强制显式
    "isolatedModules": true
  }
}
```

### 4.2 类型来源唯一

- 数据库类型：**仅**从 `lib/db/types.ts` re-export 自 `InferSelectModel<typeof tableName>`（Drizzle 推导）
- API 输入/输出类型：**仅**从 Zod schema `z.infer<typeof schema>` 导出
- 组件 Props：**仅**从组件同文件 `interface XxxProps`；不得在其他地方定义同名 Props
- **禁**手写与表/schema 同义的 `interface User { ... }` 副本；若发现即 lint error

### 4.3 命名

- 变量/函数：camelCase
- 常量集合：UPPER_SNAKE_CASE（`const MAX_QUOTE_PER_TASK = 5000`）
- 类型/接口：PascalCase
- 枚举：PascalCase + 值 UPPER_SNAKE_CASE（`enum MatchStatus { MATCH = 'MATCH', PARTIAL_MATCH = 'PARTIAL_MATCH' }`），优先用 Zod enum 或字面量联合，慎用 TS enum
- React 组件：PascalCase
- 布尔字段：`is` / `has` / `can` / `should` 前缀（`isAccurate` / `hasModerationRejection`）
- 时间字段：`At` 后缀（`createdAt` / `frozenAt`）
- 计数字段：`Count` 后缀（`quoteCount`）

### 4.4 导入顺序

```typescript
// 1. Node 内置（crypto, fs）
import { createHash } from 'node:crypto';

// 2. 外部依赖
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

// 3. 项目内部（绝对路径 @/）
import { db } from '@/lib/db';
import { task } from '@/lib/db/schema';

// 4. 类型（type-only 单独一组）
import type { Task, VerificationResult } from '@/lib/db/types';

// 5. 样式
import './styles.css';
```

ESLint `import/order` + `import/consistent-type-specifier-style: type-imports` 强制。

---

## 5. Drizzle 查询模式（数据库硬约束）

### 5.1 三条硬规则

**R1**：所有查询**必经 `db` 客户端**（`lib/db/index.ts` 导出的唯一实例）。禁止在应用代码 `new Pool()` / `drizzle(pool)`。

**R2**：所有读写**必带 userId 过滤**（除系统内部任务如 Inngest cron）。模式：
```typescript
// BAD
const t = await db.query.task.findFirst({ where: eq(task.id, taskId) });

// GOOD
const t = await db.query.task.findFirst({
  where: and(eq(task.id, taskId), eq(task.userId, session.userId))
});
```

**R3**：禁止原生 SQL（`db.execute(sql\`...\`)`）在应用代码中使用。例外：
- `lib/db/migrations/*.sql`（drizzle-kit 生成或手写 DDL）
- 必须走原生 SQL 的只读统计视图查询（如 `v_result_reference_hit_stats` 监控）——须放在 `lib/db/views.ts` 单一出口，且不写回

### 5.2 冻结字段写保护

**对应**：real.md #7 + DB §5 触发器 T-01/T-02/T-05

以下字段由 PG 触发器阻止更新，**应用层也不得尝试 UPDATE**：
- `report_snapshot.*`（整表冻结 after `frozen_at` 被设置）
- `verification_result.model_id / model_version / prompt_version / frozen_at`
- `task.frozen_at`（单向字段）
- `prompt_version.*`（整表 UPDATE/DELETE 拒绝）

ESLint 自定义规则 `no-frozen-field-update`：扫描 `.set({ ... })` 中出现的上述字段名直接报错。

### 5.3 M:N 查询契约（性能红线）

**对应**：DB §14 D5 改进

`result_reference_hit` 行数爆炸，查询**必须**满足：
- WHERE 条件包含 `result_id IN (...)` 或 `task_id = ?`（通过 JOIN verification_result）
- 明确 `LIMIT`（列表默认 3，详情默认 20）
- 主命中优先：`ORDER BY hit DESC, score DESC`

**落地**：`lib/db/queries/reference-hit.ts` 导出唯一三个函数（`listTopHits` / `listFullHits` / `getHitById`），其他文件禁止直接写联接表查询。

### 5.4 事务边界

- Server Action / Route Handler 内的多表 mutation：**必须**包在 `db.transaction(async (tx) => { ... })`
- Inngest `step.run` 内部不可跨越外层事务（每个 step 独立事务）
- 禁嵌套事务（Postgres savepoint 对 Neon serverless driver 不稳定）

### 5.5 迁移工作流（Neon 分支）

**对应**：DB §10

1. 本地 dev：`DATABASE_URL = Neon dev branch`，`bun run db:push`（原型快速迭代）
2. 迁移固化：`bun run db:generate` → review `.sql` → commit
3. PR CI：创建 Neon preview branch → `bun run db:migrate` → 测试
4. Merge main：main branch 迁移自动应用（Vercel integration）
5. **禁**在 main branch 直连跑 `db:push`（会绕过迁移审计）

---

## 6. API 层骨架

### 6.1 Route Handler 统一骨架

```typescript
// app/api/tasks/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/guard';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createTaskSchema } from '@/lib/validations/task';
import { taskService } from '@/lib/services/task';

export async function POST(req: NextRequest) {
  try {
    // 1. 鉴权（必为首行，见 §13）
    const user = await requireUser(req);

    // 2. 输入校验（Zod + safeParse，禁 parse 抛原始 ZodError）
    const parsed = createTaskSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { errorCode: 'VALIDATION_ERROR', detail: parsed.error.issues },
        { status: 400 }
      );
    }

    // 3. 业务逻辑（仅调 service / repository）
    const task = await taskService.create(user.id, parsed.data);

    return NextResponse.json({ data: task }, { status: 201 });
  } catch (err) {
    return handleError(err, 'POST /api/tasks');
  }
}

function handleError(err: unknown, ctx: string): NextResponse {
  if (err instanceof AppError) {
    logger.warn({ errorCode: err.code, ctx }, err.message);
    return NextResponse.json(
      { errorCode: err.code, detail: err.detail },
      { status: err.statusCode }
    );
  }
  logger.error({ err, ctx }, 'Unexpected error');
  return NextResponse.json(
    { errorCode: 'INTERNAL_ERROR' },
    { status: 500 }
  );
}
```

**强制**：每个 Route Handler 首行 `requireUser`；错误收敛到 `handleError`；不得 `console.*`。

### 6.2 Server Action 骨架

```typescript
// app/references/actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth/guard';
import { uploadReferenceSchema } from '@/lib/validations/reference';
import { referenceService } from '@/lib/services/reference';

export async function uploadReferenceAction(formData: FormData) {
  const user = await requireUser();
  const parsed = uploadReferenceSchema.safeParse({
    file: formData.get('file'),
    role: formData.get('role'),
  });
  if (!parsed.success) {
    return { ok: false as const, errorCode: 'VALIDATION_ERROR' as const };
  }
  const ref = await referenceService.upload(user.id, parsed.data);
  revalidatePath('/references');
  return { ok: true as const, data: { id: ref.id } };
}
```

**强制**：
- 返回值**必须**是 `{ ok: true; data } | { ok: false; errorCode }` 的判别联合
- 首行 `requireUser()`
- Mutation 后 `revalidatePath` / `revalidateTag`
- 不直接抛错（客户端无法优雅展示）

### 6.3 错误码枚举（单一出口）

```typescript
// lib/errors.ts
export const ErrorCode = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
  REJECTED_BY_MODERATION: 'REJECTED_BY_MODERATION',  // notes #1
  FROZEN_MUTATION: 'FROZEN_MUTATION',                // real.md #7
  LLM_TIMEOUT: 'LLM_TIMEOUT',
  LLM_MALFORMED: 'LLM_MALFORMED',
  PARSER_FAILED: 'PARSER_FAILED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    public statusCode: number,
    message: string,
    public detail?: unknown,
  ) { super(message); this.name = 'AppError'; }
}
```

所有客户端用 `errorCode` 字段分支，不解析 `message` 做业务判断。

---

## 7. Inngest 工作流（ADR-002）

### 7.1 工作流骨架

```typescript
// inngest/functions/proofread-run.ts
import { inngest } from '@/inngest/client';
import { idempotencyKey } from '@/lib/idempotency';

export const proofreadRun = inngest.createFunction(
  {
    id: 'proofread-run',
    concurrency: { key: 'event.data.taskId', limit: 1 },  // 每任务串行
    retries: 3,
  },
  { event: 'task/proofread.requested' },
  async ({ event, step }) => {
    const { taskId, userId } = event.data;

    // 解析阶段（一次性 step，失败重试整步）
    const parsed = await step.run('parse-manuscript', async () => {
      return parserService.parse(taskId, userId);
    });

    // 引文抽取
    const quotes = await step.run('extract-quotes', async () => {
      return quoteService.extract(taskId, parsed.text);
    });

    // 逐条校对（可并发 + 幂等）
    const results = await Promise.all(
      quotes.map((q, i) =>
        step.run(`verify-${q.id}-${i}`, async () => {
          return verifyService.verifyOne({
            quote: q,
            taskId,
            attemptN: 1,
            idempotencyKey: idempotencyKey(taskId, q.id, 1),
          });
        })
      )
    );

    // 报告冻结
    await step.run('freeze-report', async () => {
      return reportService.freeze(taskId, results);
    });
  }
);
```

### 7.2 硬约束

**R1**：每个外部副作用（DB 写入 / LLM 调用 / Blob 上传）**必须**在 `step.run` 内——Inngest 保证幂等重放；`step.run` 外面调副作用会在重试时重复执行（对应 notes #4）。

**R2**：幂等 key 构造唯一出口 `lib/idempotency.ts`：
```typescript
export function idempotencyKey(taskId: string, quoteId: string, attemptN: number): string {
  return `${taskId}_${quoteId}_${attemptN}`;
}
```
传入 Vercel AI SDK 调用时作为 `headers['x-idempotency-key']`（硅基流动支持此头；若无，则作为请求 body 的显式字段交给业务去重）。

**R3**：Inngest 事件 schema 单一定义在 `inngest/events.ts`，强 typed：
```typescript
export type Events = {
  'task/proofread.requested': { data: { taskId: string; userId: string } };
  'task/ttl.destroy': { data: { taskId: string } };
};
```

**R4**：长任务**不得**在 Route Handler 内同步等待。模式：Route Handler 发事件 → 立即 return 202 → 客户端订阅 SSE。

**R5**：免费层限额（ADR blind spot #2）：单任务引文数 > 100 时，按 50 条一批合并进一个 `step.run`（`verify-batch-N`），避免事件数爆炸。

---

## 8. Vercel AI SDK 封装（ADR-005）

### 8.1 唯一出口

```typescript
// lib/ai/client.ts
import { createOpenAI } from '@ai-sdk/openai';
import { env } from '@/lib/env';

export const llm = createOpenAI({
  baseURL: 'https://api.siliconflow.cn/v1',
  apiKey: env.SILICONFLOW_API_KEY,
  compatibility: 'compatible',
});

export const MODEL_ID = 'deepseek-ai/DeepSeek-V3.2';  // 版本锁定（real.md #7）
```

**禁**其他文件 import `@ai-sdk/openai` / `createOpenAI`。

### 8.2 结构化输出

```typescript
// lib/ai/verify.ts
import { generateObject } from 'ai';
import { llm, MODEL_ID } from './client';
import { verifyResultSchema } from './schemas';
import { loadPrompt } from './prompts';
import { isModerationRejection } from './moderation';
import { AppError, ErrorCode } from '@/lib/errors';

export async function verifyOne(input: VerifyInput): Promise<VerifyOutput> {
  const prompt = loadPrompt('verify', input);
  try {
    const { object } = await generateObject({
      model: llm(MODEL_ID),
      schema: verifyResultSchema,              // 宽松 + passthrough + catch
      system: prompt.system,
      prompt: prompt.user,
      headers: { 'x-idempotency-key': input.idempotencyKey },
      temperature: 0,  // 稳定性 > 创造力
      maxRetries: 0,   // 重试由 Inngest 统管
    });
    return object;
  } catch (err) {
    if (isModerationRejection(err)) {
      throw new AppError(ErrorCode.REJECTED_BY_MODERATION, 200, '审核拒绝', {
        rawError: String(err),
      });
    }
    throw new AppError(ErrorCode.LLM_MALFORMED, 502, 'LLM 输出无法解析', { rawError: String(err) });
  }
}
```

### 8.3 宽松 Zod schema（ADR blind spot #10）

```typescript
// lib/ai/schemas.ts
import { z } from 'zod';

// LLM 输出可能多/少字段：用 passthrough + catch 兜底
export const verifyResultSchema = z.object({
  text_accuracy: z.enum(['通过', '有异文', '有错误']).catch('通过'),
  interpretation: z.enum(['一致', '部分一致', '偏离']).catch('一致'),
  context_fit: z.enum(['恰当', '存疑', '断章取义']).catch('恰当'),
  reasoning: z.string().min(1).catch(''),
  reference_hits: z
    .array(z.object({
      reference_id: z.string(),
      snippet: z.string(),
      location: z.string().optional(),
    }))
    .catch([]),
}).passthrough();
```

落地：所有 LLM schema **必须**用 `.passthrough()` + 字段级 `.catch()`；严格校验放在业务层把 LLM 输出**映射**到 DB schema 时。

### 8.4 审核拒绝检测（notes #1）

```typescript
// lib/ai/moderation.ts
const MODERATION_MARKERS = [
  '无法回答', '不便回应', '内容政策', '敏感话题',
  'content_policy', 'content_filter', 'safety',
] as const;

export function isModerationRejection(err: unknown): boolean {
  const s = String(err).toLowerCase();
  // 签名 1：HTTP 非 2xx + body 含敏感关键词
  // 签名 2：模型返回 2xx 但 content 是典型拒答模板
  return MODERATION_MARKERS.some((m) => s.toLowerCase().includes(m.toLowerCase()));
}
```

**硬约束**：
- 审核拒绝 **必须**生成独立的 `VerificationResult` 行（`moderationStatus = 'REJECTED_BY_MODERATION'`，三维度字段为 null）
- 不得伪造成"通过"（notes #1 事故源）
- UI 必须以独立视觉皮肤呈现（UI 规约 ModerationRejectedSkin）

---

### 8.5 计费模块（SS-9 · 双轨制）

用户结算与内部成本监控分离，详见架构规约 SS-9 + ADR-018。

#### 8.5.1 文件结构

```
lib/billing/
├── pricing.ts          # 费率常量 + 内部 token 成本计算
├── user-pricing.ts     # 用户字数结算（computeUserCostFen）
├── recorder.ts         # api_call 内部记录（仅成本监控，非用户结算）
├── aggregator.ts       # 计费聚合（读 task.cost_actual_fen）
└── types.ts            # Fen brand type

lib/ai/
└── cost.ts             # 后向兼容 re-export（v1.1 移除）
```

#### 8.5.2 双轨公式

| 用途 | 公式 | 数据源 | 文件 |
|------|------|--------|------|
| **用户结算（A23）** | `ceil(charCount / 1000) × 300 fen` | `manuscript.char_count` | `user-pricing.ts` |
| **内部成本监控** | token 费率公式（¥0.002/¥0.003 per 1K tokens） | `api_call` 表 | `pricing.ts` → `recorder.ts` |

#### 8.5.3 用户结算（`lib/billing/user-pricing.ts`）

```typescript
import { USER_PRICE_FEN_PER_K_CHAR } from '@/lib/billing/pricing';

export function computeUserCostFen(charCount: number): number {
  return Math.ceil(charCount / 1000) * USER_PRICE_FEN_PER_K_CHAR;
}
```

费用精确固定（errorMarginPct = 0），运行中不追加。

#### 8.5.4 内部成本监控（`lib/billing/pricing.ts` + `recorder.ts`）

- `computeInternalCostFen(modelId, promptTokens, completionTokens)` — token 费率公式
- `recordApiCall(opts)` — 记录单次 LLM 调用，原子写入 `api_call` + 累加 `task.cost_actual_fen`
- 写入 `api_call.pricingVersion` = `INTERNAL_PRICING_VERSION`
- 费用仅用于运营方成本参考，**不作用户结算数据源**

#### 8.5.5 费用预估（`lib/billing/pricing.ts`）

```typescript
export function estimateCostFen(charCount: number): {
  quoteCountEstimate: number;
  estimatedFen: number;
  errorMarginPct: number;
} {
  const estimatedFen = Math.ceil(charCount / 1000) * USER_PRICE_FEN_PER_K_CHAR;
  return { quoteCountEstimate: Math.ceil(charCount / 1000), estimatedFen, errorMarginPct: 0 };
}
```

#### 8.5.6 硬约束

- **R1**：用户结算**必须**走字数公式，不得引用 `api_call` 聚合（见 A23）
- **R2**：`api_call` 写入保留但仅限内部成本监控，`cost_fen` 注释标注"非用户结算"
- **R3**：费率版本化 — `USER_PRICING_VERSION` 和 `INTERNAL_PRICING_VERSION` 独立管理
- **R4**：无 cost-guard — 用户费用固定，运行中不暂停（MS-D-04 已关闭）
- **R5**：版本戳记录 `userPricingVersion`（报告快照 `versionStampJson` 字段）

---

## 9. 文本规范化管线（notes #3）

### 9.1 唯一出口

```typescript
// lib/text/normalize.ts
import { Converter } from 'opencc-js';
import { VARIANT_MAP } from './variants';

const t2s = Converter({ from: 'tw', to: 'cn' });
const s2t = Converter({ from: 'cn', to: 'tw' });

export type NormalizeMode = 'simplified' | 'traditional' | 'preserve';

export function normalizeForCompare(input: string, mode: NormalizeMode = 'preserve'): string {
  let s = input;
  // 1. 异体字映射（为/爲/為 等）
  s = s.replace(/[為爲]/g, '为');  // 示例；实际走 VARIANT_MAP 表
  // 2. 合文保留（卅/廿/囍 不转）——正则扫描白名单
  // 3. 繁简按模式走（default preserve，不动）
  if (mode === 'simplified') s = t2s(s);
  if (mode === 'traditional') s = s2t(s);
  return s;
}
```

### 9.2 硬约束

- 所有引文 / 参考文献 / 用户输入的字符串比对**必经** `normalizeForCompare`
- **禁**在业务代码里直接用 `str.replace` 做繁简转换
- `VARIANT_MAP` 放 `lib/text/variants.ts`，初始从文史工具书硬编码（预留 DB 迁移接口）
- CJK Unified Ideographs Extension B-G（U+20000~U+3FFFF）字符比对时须用 `Array.from(str)` 而非 `str.split('')`（代理对问题）

### 9.3 排版方向检测（PDF 竖排）

```typescript
// lib/parsers/pdf.ts
async function detectOrientation(text: string[]): Promise<'horizontal' | 'vertical'> {
  // 启发式：每行字符数显著小于列数 + 多数字符为 CJK → 竖排
  // 落地细节见 dev-coding 实装时
  return 'horizontal';
}
```

若检测为竖排，**必须**标记 `manuscript.parseWarning = 'vertical_layout_detected'`，UI 弹对话框让用户确认 / 手动重排。

---

## 10. Prompt 加载与版本冻结（ADR-012 / real.md #7）

### 10.1 加载器

```typescript
// lib/ai/prompts.ts
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

type PromptKey = 'extract' | 'verify' | 'map';
const PROMPT_VERSION = 'v1';

const cache = new Map<PromptKey, { text: string; sha256: string }>();

export function loadPromptRaw(key: PromptKey): { text: string; sha256: string; version: string } {
  const cached = cache.get(key);
  if (cached) return { ...cached, version: PROMPT_VERSION };

  // Next.js 服务端：从项目根 prompts/v1/ 读（static asset，但不 bundle）
  const p = path.join(process.cwd(), 'prompts', PROMPT_VERSION, `${key}.txt`);
  const text = readFileSync(p, 'utf-8');
  const sha256 = createHash('sha256').update(text).digest('hex');
  cache.set(key, { text, sha256 });
  return { text, sha256, version: PROMPT_VERSION };
}
```

### 10.2 硬约束

- `prompts/v1/` 目录**只读**（CI 检查 PR 不得修改其中文件；只能新增 `prompts/v2/`）
- 启动时（`instrumentation.ts`）必须调 `verifyPromptIntegrity()`，校验 `prompt_version` 表中记录的 sha256 与当前文件一致，不一致即启动失败
- `generateObject` 每次调用**必须**把 `modelId / modelVersion / promptVersion / promptSha256` 记录到 `verification_result`（ADR-012）

### 10.3 措辞迁移硬禁忌

```typescript
// lib/ai/prompts.test.ts 的 CI 检查
const FORBIDDEN_IN_PROMPT = ['错误', '有误', '错引', '误引', '判错'];

test('verify.txt 无侵占编辑终审权的措辞', () => {
  const { text } = loadPromptRaw('verify');
  for (const word of FORBIDDEN_IN_PROMPT) {
    expect(text).not.toContain(word);
  }
});
```

**对应**：MAS-2 prompt 措辞迁移 + real.md #1（AI 不判错，只报"符合/不符合"）

---

## 11. 认证与授权（ADR-004）

### 11.1 Better Auth 配置单一出口

```typescript
// lib/auth.ts
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin } from 'better-auth/plugins';
import { db } from './db';
import { env } from './env';

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),
  emailAndPassword: { enabled: true, requireEmailVerification: true },
  session: {
    cookieCache: { enabled: true, maxAge: 60 },
    expiresIn: 60 * 60 * 24 * 7,  // 默认 C 端 7d；B 端走独立 session 策略
  },
  user: {
    additionalFields: {
      role: { type: 'string', required: true, defaultValue: 'C' },
      orgId: { type: 'string', required: false },
    },
  },
  plugins: [admin()],
});
```

### 11.2 guard 函数（首行调用）

```typescript
// lib/auth/guard.ts
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { AppError, ErrorCode } from '@/lib/errors';

export async function requireUser(req?: Request) {
  const session = await auth.api.getSession({
    headers: req?.headers ?? (await headers()),
  });
  if (!session?.user) {
    throw new AppError(ErrorCode.UNAUTHORIZED, 401, 'Not authenticated');
  }
  return session.user;
}

export async function requireRole(
  role: 'B' | 'C' | 'admin',
  req?: Request,
) {
  const user = await requireUser(req);
  if (user.role !== role && user.role !== 'admin') {
    throw new AppError(ErrorCode.FORBIDDEN, 403, `Requires role ${role}`);
  }
  return user;
}
```

### 11.3 硬约束

- 每个 Route Handler / Server Action **首行**必调 `requireUser()`（§6 骨架已强制）
- 每个 DB 查询**必带** `userId` 过滤（§5.1 R2）
- 客户端不得通过 `session.user.id` 发到 API 后端信任——后端**只信**从 session 重新读取的 userId
- B/C role 注册时落库即锁定；改 role 仅 admin 可操作（`auth/admin` plugin）

---

## 12. 错误处理

### 12.1 分层

| 层 | 抛错方式 | 捕获方式 |
|---|---|---|
| Service / Repository | `throw new AppError(code, status, message)` | 由 Route/Action 统一 |
| Route Handler | `handleError(err, ctx)` 返回 JSON | 客户端 TanStack Query `onError` |
| Server Action | `return { ok: false, errorCode }` | React 组件读 `action.state.errorCode` |
| Inngest function | `throw NonRetriableError` / 普通 throw | Inngest dashboard 重试视图 |

### 12.2 禁忌

- **禁**在 Service 层 `console.error` 后 `return null`——调用方无法判断失败
- **禁**用 `try { ... } catch { /* ignore */ }` 吞错
- **禁**在错误 `detail` 里放书稿 / 引文 / 参考片段原文（notes #2；日志脱敏同此约束）

---

## 13. 日志脱敏（notes #2 + ADR-015）

### 13.1 Pino 配置

```typescript
// lib/logger.ts
import pino from 'pino';
import { env } from './env';

export const logger = pino({
  level: env.LOG_LEVEL ?? 'info',
  redact: {
    paths: [
      // 请求/响应 body 中可能出现的原文字段
      'req.body.manuscriptText',
      'req.body.quoteText',
      'req.body.referenceSnippet',
      'req.body.paragraphText',
      // 通用字段
      '*.manuscriptText',
      '*.quoteText',
      '*.referenceSnippet',
      '*.paragraphText',
      '*.prompt',           // prompt 模板 + 填充后的用户内容
      '*.llmResponse',
      // 认证
      '*.password',
      '*.apiKey',
      '*.accessToken',
      'headers.authorization',
      'headers.cookie',
    ],
    censor: '[REDACTED]',
    remove: false,
  },
  transport: env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
});
```

### 13.2 ESLint 守卫

自定义规则 `no-raw-text-log`：扫描 `logger.{info,warn,error}(...)` 的第一个参数（对象字面量），出现以下键名直接报错：
- `manuscriptText` / `quoteText` / `referenceSnippet` / `paragraphText` / `prompt`

**原因**：即便 Pino redact 配了路径，非顶层字段命中可能漏网；静态检查是第二层防线。

### 13.3 结构化日志规范

```typescript
// GOOD
logger.info({ taskId, quoteId, attemptN, elapsed: Date.now() - t0 }, 'verify.done');

// BAD（原文入日志）
logger.info(`verified quote: ${quote.quoteText}`);

// BAD（无结构）
logger.info('task done');
```

所有关键节点（parse / extract / verify / freeze / destroy）**必须**记结构化日志，字段命名：`{taskId, userId, quoteId?, attemptN?, durationMs?, errorCode?}`。

---

## 14. 证据链与客观置信度（real.md #2 + ADR-007）

### 14.1 置信度计算单一出口

```typescript
// lib/ai/confidence.ts
import { env } from '@/lib/env';

type ConfidenceSignals = {
  refHit: number;         // 参考命中度，[0,1]：hit=true 的 reference_hit 占比 × snippet 重合度
  locationValid: number;  // 定位有效性，[0,1]：LLM 返回的 location 能映射回 reference 文本则 1，否则 0
  crossModel?: number;    // 跨模型一致性，[0,1]；v1.0 = undefined，w3 = 0
};

const W1 = 0.6;
const W2 = 0.4;
const W3 = 0.0;  // v1.0 锁 0；v2.0 引入双模型时调高

export function computeConfidence(sig: ConfidenceSignals): {
  confidence: number;
  breakdown: ConfidenceSignals & { w1: number; w2: number; w3: number };
} {
  const confidence = W1 * sig.refHit + W2 * sig.locationValid + W3 * (sig.crossModel ?? 0);
  return {
    confidence: Math.max(0, Math.min(1, confidence)),
    breakdown: { ...sig, w1: W1, w2: W2, w3: W3 },
  };
}
```

### 14.2 硬禁忌

- **禁**读取 LLM 输出中的 "confidence" / "score" / "certainty" 字段并直接落库（real.md #2）
- **禁**把三维度 verdict 做加权平均作为"综合评分"（notes #6）
- **禁**在 DB schema 或 API 响应中出现 `totalScore` / `overallRating` / `综合分` 字段名

ESLint 自定义规则 `no-confidence-selfeval`：扫描对象字面量键包含 `confidence` 且同一文件 import 了 `lib/ai/client` → 报错（即"从 LLM 读 confidence"的典型模式）。

### 14.3 证据链契约

每条 `VerificationResult` **必须**至少有一条 `ResultReferenceHit`（即使 `matchStatus = NOT_FOUND_IN_REF`，也要记录"扫过哪些 reference 都未命中"——即 `hit=false` 的空命中记录）。

---

## 15. React / RSC 组件模式

### 15.1 服务器 vs 客户端边界

**默认 RSC**，加 `"use client"` 的场景：
- 使用 `useState` / `useEffect` / `useRef` / React Hooks
- 使用浏览器 API（`localStorage` / `window` / `navigator`）
- 订阅 SSE / WebSocket
- 使用 TanStack Query 或 Zustand
- 事件处理（onClick 等）

**Server Component only**：
- 含 `await db.query....` 的组件
- 含 `await loadPrompt(...)` 的组件
- 含 `await requireUser()` 的组件

### 15.2 组件文件骨架

```typescript
// components/quote-card/index.tsx
'use client';

import { memo } from 'react';
import type { Quote, VerificationResult, ResultReferenceHit } from '@/lib/db/types';
import { VerdictChip } from '@/components/verdict-chip';
import { MatchStatusChip } from '@/components/match-status-chip';
import { ReferenceHitPanel } from '@/components/reference-hit-panel';
import { ConfidenceBar } from '@/components/confidence-bar';
import { VersionStampBadge } from '@/components/version-stamp-badge';
import { ModerationRejectedSkin } from '@/components/moderation-rejected-skin';

interface QuoteCardProps {
  quote: Pick<Quote, 'id' | 'displayId' | 'quoteText' | 'canonicalName' | 'locationHint' | 'kind'>;
  result: Pick<
    VerificationResult,
    'id' | 'matchStatus' | 'verdictTextAccuracy' | 'verdictInterpretation'
    | 'verdictContext' | 'confidence' | 'confidenceBreakdown' | 'moderationStatus'
  >;
  hits?: ResultReferenceHit[];
  versionStamp?: { modelId: string; frozenAt: string };
  onOpenHitPanel?: (resultId: string) => void;
}

export const QuoteCard = memo(function QuoteCard({
  quote, result, hits, versionStamp, onOpenHitPanel,
}: QuoteCardProps) {
  if (!versionStamp) {
    // real.md #7：无冻结戳禁渲染
    return null;
  }
  if (result.moderationStatus === 'REJECTED_BY_MODERATION') {
    return <ModerationRejectedSkin quote={quote} />;
  }
  return (
    // ...三维度 + 匹配状态 + 参考命中 + 置信度 + 版本戳
    null
  );
});
```

### 15.3 硬约束

- 组件 props **禁**接 `totalScore` / `overallRating` / `综合分`（notes #6；对应 UI 规约 §7.1）
- 用户文本展示**禁**出现 "错误" / "有误" / "错引"（notes 措辞；对应 UI §16 neutralTone CI）
- 长列表**必须**用虚拟化（`@tanstack/react-virtual`），阈值 >200 条
- 版本戳必现（`versionStamp` 为空则组件禁渲染）

---

## 16. 禁忌模式清单（ESLint 自定义规则）

放 `eslint-rules/` 目录，flat config 注册。每条规则对应一个 `.md` 说明文件。

| 规则 ID | 触发条件 | 对应约束 |
|---|---|---|
| `no-accusatory-language` | JSX 文本 / 字符串字面量含 "错误" / "有误" / "错引" / "误引" / "判错" | notes #5 + MAS-2 |
| `no-total-score` | 标识符含 `totalScore` / `overallRating` / `综合分` / `综合评分` | notes #6 |
| `no-confidence-selfeval` | 对象字面量 `.confidence` 赋值且同文件 import `@/lib/ai/client` | real.md #2 |
| `no-frozen-field-update` | `.set({...})` 包含 `modelId`/`modelVersion`/`promptVersion`/`frozenAt` | real.md #7 |
| `no-raw-text-log` | `logger.*()` 第一参数对象含 `manuscriptText`/`quoteText`/`referenceSnippet` | notes #2 |
| `no-missing-user-filter` | Drizzle query 未含 `userId` 条件（通过 AST 扫 `where:` ） | ADR-004 |
| `no-marketing-automation` | JSX 文本含 "自动校对" / "取代人工" / "解放编辑" / "AI 校对机器人" | notes #5 |
| `no-direct-llm-fetch` | `fetch()` URL 含 `deepseek` / `siliconflow` / `openai.com` | ADR-005 |
| `no-direct-db-instance` | `new Pool(` / `drizzle(` 在非 `lib/db/index.ts` 文件中 | §5.1 R1 |
| `no-pages-router` | import `next/router` / 定义 `getServerSideProps` 等 | ADR-001 |
| `no-random-id-for-business` | `crypto.randomUUID()` 用于业务主键（通过 variable 名启发判断） | `cog.md` 结构化 ID |
| `no-time-in-logic` | `new Date()` 出现在 `services/*` / `inngest/*` | 测试可复现性 |

**CI 强制**：上述规则级别 `error`，PR 即阻断。

---

## 17. 测试基线

### 17.1 分层

| 层 | 工具 | 覆盖范围 | 覆盖率目标 |
|---|---|---|---|
| 单元测试 | Vitest | `lib/*` 纯函数、`services/*` mock DB | 核心 lib 90%+ |
| 契约测试 | Vitest + testcontainers-pg | Drizzle query + 触发器（T-01~T-06） | 6 触发器全覆盖 |
| Schema 测试 | Vitest | Zod schema 对 fixture 的 parse/safeParse | 100% schema |
| Inngest 测试 | Vitest + `@inngest/test` | 工作流幂等、重试、失败分支 | proofread-run 全路径 |
| E2E | Playwright | UI 规约 §11 交互清单 + CS-01 主流 | CS-01~CS-05 全覆盖 |
| 视觉回归 | Playwright screenshot + 基线 | QuoteCard 8 边缘态 + B/C 皮肤切换 | 12 核心组件 |

### 17.2 硬约束

- **禁**在测试里真调 LLM API（走 `msw` mock + fixture）
- **禁**在测试里真写 prod DB（用 testcontainers 或 Neon preview branch）
- **契约测试必测**：`result_reference_hit` M:N 查询的 LIMIT 强制（§5.3）
- **合规测试必测**：
  - `isModerationRejection` 对 5 种典型拒答文本的识别
  - `prompts/v1/*.txt` 不含禁忌词（§10.3）
  - `lib/text/normalize.ts` 对"乾坤" / "發髮" / "囍" / CJK Ext B 字符的正确处理
  - `ttl-destroy.ts` 7 天后真能删 Blob + 清解析缓存 + 保留 report_snapshot

### 17.3 Fixture 单一出口

```typescript
// tests/fixtures/quotes.ts
export const FIXTURES = {
  match: { /* MATCH 正常态 */ },
  partial: { /* PARTIAL_MATCH + 3 hits */ },
  notMatch: { /* NOT_MATCH */ },
  notFound: { /* NOT_FOUND_IN_REF */ },
  variant: { /* 版本异文，matchStatus=MATCH + variantFlag */ },
  rejected: { /* REJECTED_BY_MODERATION */ },
  lowConfidence: { /* confidence < 0.3 */ },
  cjkExtB: { /* 含 U+20000+ 字符 */ },
} as const;
```

UI 规约 §8 已定义 8 种边缘态；此处为测试/Storybook 共享来源。

---

## 18. Git 与 Commit

### 18.1 分支

- `main`：生产
- `preview/*`：对应 Neon preview branch 的 PR 环境
- `feat/*` / `fix/*` / `chore/*`：功能分支

### 18.2 Commit message（Conventional Commits + 项目扩展）

```
<type>(<scope>): <subject>

<body>

<footer>
```

- `type`：feat / fix / refactor / chore / docs / test / perf / sec
- `scope`：`ingestion` / `verify` / `report` / `auth` / `privacy` / `db` / `ui-<comp>` / `inngest-<fn>` / `spec`
- `subject`：中文 / 英文不限，但单条 commit 内保持一致
- **禁**出现"错误"字样描述引用（`fix: 修正误引`→ 应为 `fix: 修正 extract prompt 的异文提取漏洞`）
- Footer：对应 MAS / ADR / Issue 号

### 18.3 代码评审清单（PR 模板）

- [ ] 对应哪个 MS / affordance / ADR？
- [ ] 是否修改 `prompts/v1/`？（若是：必须新 `prompts/v2/` 而非 in-place）
- [ ] 是否新增 LLM 调用？（若是：是否接了 `moderation` + `idempotency`）
- [ ] 是否新增 DB 字段？（若是：是否更新 Zod schema + 迁移 SQL）
- [ ] 是否新增 Inngest function？（若是：是否有 concurrency + retries 配置）
- [ ] 是否所有 Route/Action 首行 `requireUser()`？
- [ ] 日志字段是否经 redact 覆盖？
- [ ] E2E 是否加了对应场景？

---

## 19. 环境变量（`lib/env.ts` 单一校验）

```typescript
// lib/env.ts
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  DATABASE_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  SILICONFLOW_API_KEY: z.string().min(20),
  BLOB_READ_WRITE_TOKEN: z.string().min(20),
  INNGEST_EVENT_KEY: z.string().min(10),
  INNGEST_SIGNING_KEY: z.string().min(10),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
  COST_CAP_CNY: z.coerce.number().default(50),  // real.md #6
  TTL_DAYS: z.coerce.number().default(7),       // real.md #3
  DEMO_MODE: z.coerce.boolean().default(false),
});

export const env = envSchema.parse(process.env);
```

**硬约束**：
- 应用代码**禁**直接 `process.env.X`
- Vercel 环境变量必设敏感值（`SILICONFLOW_API_KEY` 等）Secret 类型
- `.env.example` 与 `envSchema` 一一对应（CI 检查同步）

---

## 20. CI / CD 检查清单（与 UI 规约合并）

PR 合入 `main` 前必过：

| # | 检查 | 工具 | 失败处理 |
|---|---|---|---|
| 1 | TypeScript strict | `bun run typecheck` | 阻断 |
| 2 | ESLint（含 12 自定义规则） | `bun run lint` | 阻断 |
| 3 | Prettier 格式 | `bun run format:check` | 阻断 |
| 4 | 单元测试 | `vitest run` | 阻断 |
| 5 | 契约测试（PG 触发器） | `vitest run tests/contract` | 阻断 |
| 6 | E2E（Playwright） | `playwright test` | 阻断（main/preview） |
| 7 | Prompt 禁忌词扫描 | `bun run test:prompts` | 阻断 |
| 8 | Neutral tone scan（UI 规约 §16） | `bun run test:neutral` | 阻断 |
| 9 | `.env.example` 与 `envSchema` 同步 | `bun run test:env-sync` | 阻断 |
| 10 | `prompts/v1/` 未被改动（git diff） | `bun run test:prompt-frozen` | 阻断 |
| 11 | Drizzle schema 变更必带 migration | `drizzle-kit check` | 阻断 |
| 12 | 依赖无已知高危漏洞 | `bun audit` / `snyk` | 阻断 critical+high |
| 13 | Bundle size 回归 | `bundlesize` | 警告（+10% 以上阻断） |
| 14 | 视觉回归 | `playwright --update-snapshots` review | 阻断未审查差异 |
| 15 | Neon preview branch 迁移 | Neon GitHub integration | 阻断 |

---

## 21. 非范围

- **不做**通用 TS/React 入门教程——附录 A 只列项目相关最佳实践链接
- **不做**性能优化深度——Next.js 15 默认 RSC streaming + Turbopack 已覆盖；深度优化推到 v1.1 后
- **不做**离线模式 / PWA——meta.md 不支持；SaaS 在线是硬假设
- **不做**国际化 i18n——仅中文（UI §14.9 已说明）
- **不做** monorepo 分包（turborepo/nx）——v1.0 单包足矣；v2.0 评估

---

## 22. 盲区清单（中度披露）

### C1 `noUncheckedIndexedAccess` 的"治疗反应"

**现象**：开启后所有 `arr[i]` 变成 `T | undefined`，数百处代码会红；团队首次使用可能退化到处用 `!` 非空断言，反而不安全。

**缓解**：
- 提供 `lib/utils/safeArray.ts` 的 `at()` / `firstOrThrow()` 工具函数
- Code review 禁止 `arr[i]!` 模式（自定义 ESLint 规则可加）
- 真盲区：没有此规则的第三方（如 Better Auth 传回的 array）会绕过检查

### C2 Server Action 的错误边界心智成本

**现象**：Server Action 返回判别联合 `{ ok, data | errorCode }` 而非 throw，与 React 19 的 `useFormStatus` / `useActionState` 心智匹配，但与 TanStack Query 的 `onError` 心智不匹配。客户端混用两套会发散。

**缓解**：约定"Mutation 必用 Server Action"/"GET/SSE 必用 Route Handler + TanStack Query"；不混用。

### C3 Inngest `step.run` 幂等边界靠 id 字符串

**现象**：`step.run('verify-' + quoteId, ...)` 的 step id 变了会重跑。quoteId 命名规则一旦调整（`cog.md` 的 `{task_id}-quote-{n}` → UUID），历史任务重放会产生重复副作用。

**缓解**：
- quoteId 命名规则锁定在 `lib/id.ts`，任何调整走 DB 迁移
- Inngest step id 前缀 `verify-${quoteId}-v1`，日后命名规则变更显式 v2

### C4 Pino redact 对 JSX 字符串不生效

**现象**：`logger.error(\`rendered: ${html}\`)` 模板字符串已经拼好字符串，redact paths 无效。

**缓解**：ESLint 规则禁止 `logger.*` 第一参数为字符串模板；只允许对象字面量 + 字符串消息。

### C5 Better Auth session 读取与 Inngest 工作流

**现象**：Inngest 工作流里没有"请求"，无法调 `requireUser()`——只能信任事件 data 里的 userId。若事件伪造（Inngest 签名保护之外的通道），权限会绕过。

**缓解**：
- 事件签名：`INNGEST_SIGNING_KEY` 环境变量 + Inngest 官方 SDK 自动验证
- 事件 data 带 userId 的同时，工作流首步用 DB 校验"该 taskId 是否真归 userId 所有"；不匹配立即 NonRetriableError

### C6 `generateObject` 的流式降级边界

**现象**：三维度校对若要流式（一条一条推给 UI），无法用 `generateObject`；改用 `generateText` + 手解析的话，Zod 校验搬到外层，重试策略也要重写。

**缓解**：v1.0 接受"批量返回"（step.run 输出到 DB，SSE 只推"第 N 条已完成"事件，不推 LLM 原始流）；v1.1 评估流式必要性。

### C7 Drizzle `with` 子句预加载的 N+1 陷阱

**现象**：Drizzle 的关系查询 `.findMany({ with: { hits: true } })` 会单独起 query，分页时易 N+1。

**缓解**：
- 列表查询**必须**走 SQL join（不用 `with`）
- 详情查询可用 `with`
- 单元测试 + slow query log 监控

### C8 Next.js 15 的 `cache` / `revalidate` 与 SSE 的混用

**现象**：`fetch(url, { next: { revalidate: 60 } })` 会把响应缓存 60s；SSE 端点若被意外加 `revalidate` 会一直返回初值。

**缓解**：
- `app/api/**/stream/route.ts` 明确标 `export const dynamic = 'force-dynamic'` + `export const revalidate = 0`
- ESLint 规则检测 `route.ts` 含 `ReadableStream` 且无 `dynamic = 'force-dynamic'` 报警

### C9 Vercel Edge runtime 与 Node API 混用

**现象**：`app/api/**/route.ts` 默认可能跑 Edge（`export const runtime = 'edge'`），但 `pino` / `opencc-js` / `mammoth` 用 Node API。

**缓解**：所有涉及 DB/LLM/解析的 Route Handler 显式 `export const runtime = 'nodejs'`；ESLint 检测未显式声明即警告。

### C10 Bun 与 Node 的语义差异

**现象**：开发用 Bun、生产 Node，`bun:sqlite` / `Bun.file` 等 Bun 专有 API 会在 Vercel 构建时失败，但本地测试通过。

**缓解**：
- 禁用 Bun 专有 API（ESLint `no-restricted-imports` 配置）
- CI 必跑 `node --test` 额外一轮确认 Node 兼容

---

## 23. 交付与触发下游

### 23.1 本次交付物

- 主文件：`.42cog/spec/spec-coding.md`（本文件）
- **不产出**任何脚手架代码或 schema 文件——那些属于 `dev-coding` 执行阶段

### 23.2 关联更新（待 §24 本条目写入 milestones 后）

- `.42cog/work/milestones.md`：追加 D 级"v1.0 编码规范规约完成"条目，并在 🟡 区把 `v1.0 产品规约 v1.0-draft 已生成，进入 Review 期` 迁为 🟢（由于仓库既有只追加原则，按订正记录补，不改原条目）
- 无需修改其他 spec：本规约的所有条目都**引用**自上游规约，不反向重写

### 23.3 触发下游

| 下游 | 可启动的工作 | 触发点 |
|---|---|---|
| **dev-coding（执行阶段，非规约）** | `bun create next-app` → 按 §3 目录结构 + §4.1 tsconfig + §20 CI 流水线一次性搭骨架 | 本规约 + 架构规约 + 数据库规约 + UI 规约同时就位 |
| **dev-quality-assurance** | 按 §17 分层 + §20 CI 清单 + UI §11 E2E 清单写测试套件；视觉回归基线建立 | 脚手架骨架完成后 |

### 23.4 规约链是否闭合

| # | 规约 | 状态 |
|---|---|---|
| 0 | meta.md | ✅ |
| 1 | cog.md | ✅ |
| 2 | real.md | ✅ |
| 3 | spec-product-requirements | ✅ |
| 4 | spec-user-story | ✅ |
| 5 | spec-system-architecture | ✅ |
| 6 | spec-database-design | ✅ |
| 7 | spec-ui-design | ✅ |
| 8 | **spec-coding（本规约）** | ✅ |
| 9 | spec-quality-assurance | ⚪ 待触发 |

规约层剩 `dev-quality-assurance` 一项；之后即可启动实际编码。

---

## 24. 附录

### 附录 A：非项目相关的通用最佳实践（外部参考，不再展开）

- TypeScript: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-4.html（strict 族）
- React 19: https://react.dev/blog/2024/04/25/react-19（Server Components + Actions）
- Next.js 15: https://nextjs.org/docs（App Router / RSC）
- Drizzle: https://orm.drizzle.team/docs（query builder / migrations）
- Inngest: https://www.inngest.com/docs（step.run / Realtime）
- Vercel AI SDK: https://sdk.vercel.ai/docs（generateObject）
- Better Auth: https://www.better-auth.com/docs
- Zod: https://zod.dev

本规约只在以上 lib 之外**定义项目特有的约束**，不复述官方最佳实践。

### 附录 B：硬约束 → 本规约条目映射

| 上游约束 | 本规约落地章节 | 执行机制 |
|---|---|---|
| real.md #1（AI 只给建议） | §10.3 措辞禁忌 + §14 证据链 + UI 组件层禁 totalScore | prompt CI + ESLint |
| real.md #2（证据链 + 置信度客观） | §14.1-14.3 confidence 单一出口 + no-confidence-selfeval | ESLint + 单测 |
| real.md #3（保密 + TTL） | §13 日志脱敏 + §7 Inngest ttl-destroy + §19 env.TTL_DAYS | Pino redact + 定时任务 |
| real.md #4（异文 ≠ 错误） | §15.3 VARIANT 视觉独立 + UI §7.12 VariantHighlight | 组件约束 + E2E |
| real.md #6（字数固定计费 + 二次确认） | §7.5 字数公式 + §19 env.COST_CAP_CNY | 业务 Service |
| real.md #7（版本锁定） | §5.2 冻结字段 + §10 prompt SHA256 + no-frozen-field-update | PG 触发器 + ESLint |
| notes #1（审核拒绝） | §8.4 isModerationRejection + ErrorCode.REJECTED_BY_MODERATION | AI SDK 封装 |
| notes #2（日志脱敏） | §13 Pino redact + no-raw-text-log | ESLint + Pino 配置 |
| notes #3（文史字符） | §9 normalizeForCompare + OpenCC + VARIANT_MAP | lib 单一出口 |
| notes #4（幂等键） | §7.2 idempotencyKey + Inngest step.run | Inngest 基础设施 |
| notes #5（禁"自动"话术） | §16 no-marketing-automation | ESLint |
| notes #6（禁总分） | §16 no-total-score + §14.2 confidence 硬禁忌 | ESLint + 单测 |
| notes #7（快照不可变） | §5.2 frozen_at 字段 + PG T-01 触发器 | DB + ESLint |

### 附录 C：ADR → 本规约条目映射

| ADR | 决策 | 本规约落地 |
|---|---|---|
| ADR-001 | Next.js 15 App Router | §1.2 + §3 + no-pages-router |
| ADR-002 | Inngest 长任务 | §7 |
| ADR-003 | Neon + Drizzle | §5 |
| ADR-004 | Better Auth B/C | §11 |
| ADR-005 | Vercel AI SDK + DeepSeek | §8 + no-direct-llm-fetch |
| ADR-006 | 版本戳只读 | §5.2 + no-frozen-field-update |
| ADR-007 | 客观置信度三信号 | §14 |
| ADR-008 | 审核拒绝检测 | §8.4 |
| ADR-009 | SSE via Inngest Realtime | §6.1 + C8 盲区 |
| ADR-010 | Vercel Blob | `lib/storage/blob.ts`（本规约只点名，不展开） |
| ADR-011 | PARTIAL_MATCH M:N | §5.3 查询契约 |
| ADR-012 | Prompt 版本化 | §10 |
| ADR-013 | TTL 销毁 Cron | §7 + §19.TTL_DAYS |
| ADR-014 | 文史字符工程 | §9 |
| ADR-015 | 日志脱敏 | §13 |
| ADR-016 | 宣传话术非 affordance | §16 no-marketing-automation |

### 附录 D：每日开发工作流（参考）

```bash
# 启动本地 dev（Neon dev branch + Inngest dev server + Next.js dev）
bun run dev                  # 并行启 next + inngest-dev

# 新增 schema
# 1. 编辑 lib/db/schema.ts
bun run db:generate          # 生成 migration SQL
# 2. review migrations/*.sql
bun run db:migrate           # 应用到 Neon dev branch

# 新增 Inngest function
# 编辑 inngest/functions/*.ts；dev server 自动 reload

# 跑测试
bun run test                 # unit + contract
bun run test:e2e             # Playwright
bun run lint                 # ESLint 含 12 自定义规则
bun run typecheck            # tsc --noEmit

# 提交
git commit -m "feat(verify): 添加异文检测分支（MAS-2）"
```

---

**版本说明**：v1.0.0-draft，标记 draft 期间可在不破坏约束语义的前提下追加例子或收紧规则；任何**放松**现有约束（如移除某条 ESLint 规则、降低 CI 门槛）需走架构评审 + ADR 增补，并在本文件尾追加"订正记录"指向原章节。
