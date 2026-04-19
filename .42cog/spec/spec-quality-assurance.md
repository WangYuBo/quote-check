---
name: spec-quality-assurance
description: 文史类引用校对软件 v1.0 测试策略与质量规约——金字塔偏离 50/30/20（E2E 权重抬高以承载 UI 合规回归）、PG 触发器契约测试、合规测试独立分层（prompt 禁忌 + 措辞 CI + 审核拒绝 fixture + 文史字符黄金样本 + 版本戳不可变 + 日志脱敏 + TTL 销毁真删）、Inngest 幂等与重试、视觉回归（8 边缘态 × B/C 皮肤）、发布门禁 16 项 CI
version: v1.0.0-draft
generated_by: dev-quality-assurance skill
depends_on:
  - .42cog/meta/meta.md
  - .42cog/cog/cog.md
  - .42cog/real/real.md
  - .42cog/spec/spec-product-requirements.md
  - .42cog/spec/spec-user-story.md
  - .42cog/spec/spec-system-architecture.md
  - .42cog/spec/spec-database-design.md
  - .42cog/spec/spec-ui-design.md
  - .42cog/spec/spec-coding.md
  - notes/260417-engineering-and-ethics-notes.md
stack_lock:
  unit_integration: Vitest 2.x + @testing-library/react
  e2e: Playwright 1.45+
  visual_regression: Playwright screenshot + 基线快照（per 组件 × per 皮肤）
  contract_db: testcontainers-node (Postgres 16) + drizzle-orm
  inngest_test: "@inngest/test" 0.1+
  http_mock: msw 2.x
  coverage: Vitest v8 coverage + @codecov/node
  a11y: axe-playwright + eslint-plugin-jsx-a11y
  performance: Lighthouse CI + next-bundle-analyzer
  security_scan: bun audit + snyk + semgrep (custom rules)
  ci: GitHub Actions + Neon preview branch integration + Vercel preview
created: 2026-04-19
---

# 质量保障规约（Quality Assurance）

## 0. 读法

- **上游**：所有 8 份 spec 的"约束"与"硬禁忌"在本规约汇为**可验证的测试用例**
- **本规约**：定义测试金字塔、合规测试分层、CI 发布门禁
- **下游**：`dev-coding` 执行阶段按本规约同步写测试；发布流水线按 §15 门禁；本规约是规约链第 9 环，之后不再有 spec

---

## 1. Context：与 SKILL.md 默认流程的四处偏离

### 1.1 偏离 A：金字塔调整为 50 / 30 / 20，而非 60 / 30 / 10

SKILL Phase 1 默认 Unit:Integration:E2E = 60:30:10。**本项目调整为 50:30:20**，理由：

- UI 硬约束密集（中性措辞 / 三维度独立 / 版本戳必现 / 禁总分 / B/C 皮肤差异 / REJECTED_BY_MODERATION 独立皮肤）——这些**只有在完整渲染栈**才能验证，单元/集成层覆盖不到
- 文史校对流程长（上传 → 解析 → 抽取 → 校对 → 冻结 → 导出），存在多处"看似成功但合规错误"的路径（如 LLM 返回"有误"字样被 UI 原样展示）——需要 E2E 做整链验证
- 通用工程测试（auth / CRUD）并非本项目核心风险；硬约束才是

### 1.2 偏离 B：新增"合规测试"作为独立分层（§7）

SKILL 默认五层（单元 / 集成 / E2E / 安全 / CI）。**本项目新增合规测试层**（Compliance Tests），与单元/集成并列，贯穿全金字塔；原因：硬约束来自 real.md 7 条 + notes 7 条，性质既非"业务"也非"安全"，应独立为一类（见 §7）。

### 1.3 偏离 C：禁真调 LLM API，走 fixture + msw

SKILL 示例默认测试对真实后端发 `fetch('http://localhost:3000/api/...')`。**本项目**：

- 所有 LLM 调用（硅基流动 / DeepSeek）**一律 mock**——成本（real.md #6）+ 输出漂移（测试不稳）
- Blob / Inngest 走官方 test 工具
- 真实后端只在 E2E 层访问，且走 **Neon preview branch + seed data**

### 1.4 偏离 D：覆盖率目标对"合规代码"显著抬高

SKILL 默认单元测试 70% / 目标 85%。**本项目**：

- 通用代码：70% / 85%
- **合规代码（`lib/ai/*` / `lib/text/*` / `lib/prompts/*` / 触发器 / 置信度）：100% 行覆盖 + 100% 关键分支**
- 理由：这些代码一旦退化不会被业务测试发现，但事故代价为永久信任损失（real.md #3 / #7 都是一次性击穿型红线）

---

## 2. 测试金字塔（本项目定制）

```
               ┌──────────┐
              / E2E  20%   \      关键用户旅程 + UI 合规回归 + 视觉回归
             /──────────────\
            /                \
           / Integration 30%  \   API contract + DB 触发器 + Inngest 工作流
          /────────────────────\
         /                      \
        /      Unit  50%         \   纯函数 + 组件 + Zod schema + 置信度
       /──────────────────────────\

       ╔════════════════════════════╗
       ║  Compliance  贯穿所有层      ║   real.md × notes 的硬约束专项
       ╚════════════════════════════╝
```

### 2.1 分层职责

| 层 | 工具 | 典型对象 | 运行时机 | 时长上限 |
|---|---|---|---|---|
| Unit | Vitest | 纯函数 / React 组件 / Zod schema | pre-commit + CI | <60s（全量） |
| Contract | Vitest + testcontainers-pg | Drizzle schema × DB、PG 触发器、Zod ↔ DB 一致性 | CI | <5 min |
| Integration | Vitest + msw | Route Handler / Server Action / Inngest function | CI | <3 min |
| E2E | Playwright | CS-01~CS-05 关键旅程 + UI 合规回归 | CI + nightly | <15 min |
| Visual Regression | Playwright screenshot | 12 核心组件 × B/C × 8 边缘态 | CI（仅变更影响的组件） | <5 min |
| Compliance | Vitest + custom grep | Prompt 禁忌 / 措辞扫描 / fixture 回归 | CI 必跑 | <30s |
| Security | bun audit + semgrep | 依赖漏洞 + OWASP Top 10 + 自定义规则 | CI + weekly | <2 min |
| Performance | Lighthouse CI + slow query | Bundle size / TTI / DB p95 | CI（preview） + prod 监控 | — |
| A11y | axe-playwright | WCAG AA | E2E 套内嵌 | 并入 E2E |

---

## 3. 单元测试

### 3.1 `lib/ai/confidence.ts`（real.md #2 + ADR-007）

```typescript
import { describe, it, expect } from 'vitest';
import { computeConfidence } from '@/lib/ai/confidence';

describe('computeConfidence', () => {
  it('v1.0 权重为 w1=0.6, w2=0.4, w3=0', () => {
    const { confidence, breakdown } = computeConfidence({ refHit: 1, locationValid: 1 });
    expect(confidence).toBeCloseTo(1.0);
    expect(breakdown.w3).toBe(0);
  });

  it('全零信号应得 0，不得出现 NaN / Infinity', () => {
    const { confidence } = computeConfidence({ refHit: 0, locationValid: 0 });
    expect(confidence).toBe(0);
  });

  it('输入越界应被 clamp 到 [0,1]', () => {
    const { confidence } = computeConfidence({ refHit: 2, locationValid: -1 });
    expect(confidence).toBeGreaterThanOrEqual(0);
    expect(confidence).toBeLessThanOrEqual(1);
  });

  it('v2.0 引入 crossModel 时不得默认读非 undefined 值', () => {
    const { breakdown } = computeConfidence({ refHit: 1, locationValid: 1 });
    expect(breakdown.crossModel).toBeUndefined();
  });
});
```

### 3.2 `lib/text/normalize.ts`（notes #3）

**黄金样本集**（固定在 `tests/fixtures/cjk-golden.ts`）：

| 输入 | mode | 期望输出 | 测试意图 |
|---|---|---|---|
| `乾坤` | `simplified` | `乾坤`（不得转 `干坤`） | OpenCC 方言表回归 |
| `發` | `simplified` | `发` | 繁简正确 |
| `髮` | `simplified` | `发`（但保留上下文区分） | 双字同形简体的陷阱 |
| `囍` | 任意 | `囍`（合文保留） | 合文白名单 |
| `卅` | 任意 | `卅`（不作"三十"展开） | 数字合文不展开 |
| `為` / `爲` / `为` | 比对 | 同一字符等价 | VARIANT_MAP |
| `𠀀`（U+20000 CJK Ext B） | 任意 | 原字保留，不丢失 | 代理对支持 |
| `𰻞𰻞面`（U+30EDE）| 任意 | 3 字符（`Array.from.length === 3`） | Ext G 字符边界 |

```typescript
describe('normalizeForCompare — 文史字符黄金样本', () => {
  it.each(GOLDEN_SAMPLES)('%s mode=%s', ({ input, mode, expected }) => {
    expect(normalizeForCompare(input, mode)).toBe(expected);
  });

  it('CJK Extension B-G 字符不得被 split(\'\') 截断', () => {
    const s = '𠀀𰻞'; // 2 个代理对字符
    expect(Array.from(s).length).toBe(2);
    expect(s.split('').length).toBe(4); // 反例：JS 默认行为
  });
});
```

### 3.3 Zod schema 单元测

- 所有 `lib/validations/*` / `lib/db/validations.ts` / `lib/ai/schemas.ts` 必有对应 `.test.ts`
- 覆盖：合法 fixture 通过、非法 fixture 拒绝、**LLM 宽松 schema 对 `{}` / 缺字段 / 多字段 的兜底**

```typescript
describe('verifyResultSchema — LLM 宽松变体', () => {
  it('缺失 text_accuracy 应 catch 回 "通过"', () => {
    const result = verifyResultSchema.parse({ interpretation: '一致', context_fit: '恰当' });
    expect(result.text_accuracy).toBe('通过');
  });

  it('多余字段应被 passthrough 保留（供审计）', () => {
    const result = verifyResultSchema.parse({
      text_accuracy: '通过', interpretation: '一致', context_fit: '恰当',
      extra_llm_field: 'whatever',
    });
    expect((result as any).extra_llm_field).toBe('whatever');
  });
});
```

### 3.4 React 组件测试

- `QuoteCard` / `VerdictChip` / `ConfidenceBar` / `ReferenceHitPanel` / `ModerationRejectedSkin` 每个至少覆盖：
  - 8 边缘态 fixture 渲染不抛错
  - 禁忌文本扫描（组件输出 HTML 中禁出现 `错误` / `有误` / `总分` 字面量）
  - 版本戳缺失时 `QuoteCard` 返回 `null`
  - B/C 皮肤切换 data-attribute 正确（不测视觉，只测 DOM）

```typescript
it('QuoteCard 无 versionStamp 必返回 null（real.md #7）', () => {
  const { container } = render(<QuoteCard {...baseProps} versionStamp={undefined as any} />);
  expect(container.firstChild).toBeNull();
});

it('QuoteCard 渲染后 DOM 内不得出现禁忌词', () => {
  const { container } = render(<QuoteCard {...fixtureNotMatch} />);
  const text = container.textContent ?? '';
  for (const w of ['错误', '有误', '错引', '误引']) {
    expect(text).not.toContain(w);
  }
});
```

---

## 4. 契约测试（Contract Tests）

启动 testcontainers-pg（Postgres 16）→ 跑全量迁移 → 逐表测 Drizzle schema × PG 行为。

### 4.1 PG 触发器契约测（6 个，来自 DB §5）

| 触发器 | 场景 | 预期 |
|---|---|---|
| T-01 `prevent_frozen_report_mutation` | UPDATE 已 `frozen_at` 的 `report_snapshot` | SQL error code `check_violation` |
| T-02 `prevent_verification_result_frozen_fields_update` | UPDATE `model_id` / `frozen_at` 字段 | error |
| T-03 `cascade_task_frozen_at` | task 转入 COMPLETED 时自动填 frozen_at | 触发后字段非空 |
| T-04 `forbid_prompt_version_mutation` | 对 prompt_version 执行 UPDATE / DELETE | error |
| T-05 `enforce_task_status_check` | task.status 赋非法值 | error（DB §4.1 D3 改进后由 CHECK 承接） |
| T-06 `archive_result_reference_hit` | Inngest cron 调归档函数 | 旧行移入 `result_reference_hit_archive` |

```typescript
it('T-01: report_snapshot 冻结后 UPDATE 应被 PG 触发器拒绝', async () => {
  const [snap] = await db.insert(reportSnapshot).values({ /* ... */ frozenAt: new Date() }).returning();
  await expect(
    db.update(reportSnapshot).set({ title: 'NEW' }).where(eq(reportSnapshot.id, snap.id))
  ).rejects.toThrow(/frozen.*cannot be modified/);
});
```

### 4.2 Drizzle schema ↔ DB 一致性

- `drizzle-kit check` CI 检查 schema 与最新迁移一致
- 契约测：对每张表插入 fixture，读出后字段类型与 TS 推导一致（`InferSelectModel` 无偏差）

### 4.3 M:N 查询 LIMIT 红线（DB §14 D5）

```typescript
it('listTopHits 必带 LIMIT，不得拉回全表', async () => {
  // 注入 1000 条 hits
  await seed.manyHits(1000);
  const hits = await listTopHits({ taskId: 't1' });
  expect(hits.length).toBeLessThanOrEqual(3);  // 列表层默认上限
});

it('全量 scan 查询必须被 lint / runtime 禁止', async () => {
  // 直接对联接表做 findMany() 无 WHERE 的 API 不存在（ESLint no-missing-user-filter）
  // 此测试是 meta-level：导出的函数列表不得包含全量扫描入口
  expect(Object.keys(referenceHitQueries)).toEqual(['listTopHits', 'listFullHits', 'getHitById']);
});
```

### 4.4 Zod ↔ DB schema 同步

自动脚本：遍历 Drizzle 表 × Zod schema，校验字段名与可空性一致。不一致 → CI 失败。

---

## 5. 集成测试

### 5.1 Route Handler

```typescript
describe('POST /api/tasks', () => {
  beforeEach(() => seedUser('c-user'));

  it('未登录应返回 401 + errorCode=UNAUTHORIZED', async () => {
    const r = await fetch('/api/tasks', { method: 'POST' });
    expect(r.status).toBe(401);
    expect(await r.json()).toMatchObject({ errorCode: 'UNAUTHORIZED' });
  });

  it('成功创建后发出 Inngest 事件 task/proofread.requested', async () => {
    const r = await authedFetch('/api/tasks', { method: 'POST', body: JSON.stringify(validPayload) });
    expect(r.status).toBe(201);
    expect(inngestMock.events).toContainEqual(
      expect.objectContaining({ name: 'task/proofread.requested' })
    );
  });
});
```

### 5.2 Server Action

- 返回值是判别联合的类型正确性（`expect.objectContaining({ ok: false, errorCode })`）
- 未登录调用必抛 `UNAUTHORIZED`
- Mutation 后 `revalidatePath` 已调用（通过 mock next/cache 断言）

### 5.3 Inngest 工作流（`@inngest/test`）

```typescript
describe('proofreadRun 工作流', () => {
  it('幂等：同一事件重放不产生重复 verification_result', async () => {
    const event = { name: 'task/proofread.requested', data: { taskId: 't1', userId: 'u1' } };
    await inngestTest.send(event);
    await inngestTest.send(event); // 重放
    const results = await db.query.verificationResult.findMany({ where: eq(vr.taskId, 't1') });
    expect(results.length).toBe(FIXTURES_QUOTE_COUNT);  // 只有 1 套
  });

  it('LLM 调用携带 idempotency key（notes #4）', async () => {
    await inngestTest.send(proofreadEvent);
    const llmCalls = msw.getAllCalls('/v1/chat/completions');
    for (const call of llmCalls) {
      expect(call.headers.get('x-idempotency-key')).toMatch(/^.+_.+_\d+$/);
    }
  });

  it('审核拒绝应生成独立 verification_result，不得漏行（notes #1）', async () => {
    msw.mockOnce('/v1/chat/completions', () => ({ body: { error: 'content_filter' }, status: 400 }));
    await inngestTest.send(proofreadEvent);
    const rej = await db.query.verificationResult.findMany({
      where: eq(vr.moderationStatus, 'REJECTED_BY_MODERATION')
    });
    expect(rej.length).toBeGreaterThan(0);
  });

  it('step.run 失败 3 次后标记 FAILED，不死循环重试', async () => { /* ... */ });
});
```

---

## 6. E2E（Playwright）

### 6.1 关键用户旅程

| Journey | 覆盖 CS / MS | 描述 | 关键断言 |
|---|---|---|---|
| J-1 注册登录 | CS-02 / MS-L-01/02 | 注册 → 邮箱验证 → 登录 → 看到工作台 | B/C 落 role 正确；session cookie HTTP-only |
| J-2 主价值流（核心） | CS-01 / MS-L-03~L-07 | 上传书稿 + 参考 → 费用确认 → 进度 SSE → 三维度报告 | 报告页出现 3 维度独立 chip；禁忌词扫；版本戳可见 |
| J-3 协议与隐私 | CS-04 / MS-L-11 / MS-D-06 / MS-G-05 | 首次使用弹协议 → 勾同意 → 任务完成 → 7 天后 Blob 真删 | `/api/privacy/agreement` 200；TTL 到期后 Blob `del` 被调用 |
| J-4 导出 | CS-05 / MS-L-08/09 | 报告页导出 Word / CSV | Word 含版本戳页；CSV 三维度独立列 |
| J-5 历史 & 对比 | CS-03 / MS-L-10 / MS-G-03/04 | 历史列表 → 两份对比 | 两份各自显示自己的模型/prompt 版本（real.md #7） |
| J-6 成本二确 | MS-D-04 | 预估 > ¥50 时必弹二确 | 未确认任务不应启动；确认后正常启动 |
| J-7 审核拒绝 | MS-D-02 / notes #1 | 触发敏感话题 → 单条引文 `REJECTED_BY_MODERATION` | 独立皮肤呈现；不混入"通过"列表 |
| J-8 异文高亮 | real.md #4 | 参考中有"異體字"的书稿 → VARIANT 视觉 | 蓝虚线 `variant-highlight`；不得为红色 |
| J-9 B/C 皮肤切换 | UI §13 | B 端账号 vs C 端账号各一次 | data-skin 属性正确切换；accent 颜色 DOM 可断言 |

### 6.2 骨架

```typescript
test('J-2 主价值流：上传 → 确认 → 进度 → 报告三维度', async ({ page }) => {
  await signIn(page, 'c-user');

  await page.goto('/manuscripts/new');
  await page.setInputFiles('input[name=manuscript]', 'fixtures/sample.docx');
  await page.setInputFiles('input[name=reference]', 'fixtures/lunyu.docx');
  await page.click('button[type=submit]');

  // 费用确认
  await expect(page.getByTestId('cost-estimate')).toBeVisible();
  await page.click('[data-testid="confirm-cost"]');

  // SSE 进度
  await expect(page.getByTestId('progress-bar')).toBeVisible();
  await page.waitForSelector('[data-testid="task-completed"]', { timeout: 60_000 });

  // 报告页三维度独立 chip
  const card = page.getByTestId('quote-card').first();
  await expect(card.getByTestId('chip-text-accuracy')).toBeVisible();
  await expect(card.getByTestId('chip-interpretation')).toBeVisible();
  await expect(card.getByTestId('chip-context')).toBeVisible();
  await expect(card.getByText(/总分|综合评分/)).not.toBeVisible();

  // 版本戳（real.md #7）
  await expect(page.getByTestId('version-stamp')).toBeVisible();
  await expect(page.getByTestId('version-stamp')).toContainText('DeepSeek-V3.2');
});
```

### 6.3 合规回归（E2E 专项套件 `e2e/compliance/`）

- 扫所有 E2E 页面的 `page.content()`，出现禁忌词即失败（兜底 UI 层 CI）
- 扫所有 E2E 页面的外观：`data-verdict="NOT_MATCH"` 的元素 computed color 不是红色族（OKLCH hue ∉ [15, 35]）
- 所有 mutation 操作的响应体不得含 `totalScore` / `overallRating` 字段
- 未登录访问 `/manuscripts/new` 被重定向到 `/login`

### 6.4 A11y（axe-playwright）

每个关键页面跑 `await injectAxe(page)` + `checkA11y(page, null, { axeOptions })`：
- 仅接受 `critical` / `serious` 级违规数 = 0
- 颜色对比度（WCAG AA 4.5:1）由 axe 自动验
- 焦点可见性 + 键盘可达性必过

---

## 7. 合规测试层（本项目独立分层）

> 这一层是本项目的特色——约束密度太高，若散落在单元/E2E 中易失去可见性。集中成套件，每条对应 real.md 或 notes 的原约束行号。

### 7.1 Prompt 禁忌词 + SHA256 冻结（real.md #7 + MAS-2）

```typescript
// tests/compliance/prompt-integrity.test.ts
describe('Prompt 合规', () => {
  it('prompts/v1/verify.txt 不得含侵占编辑终审权的措辞', () => {
    const { text } = loadPromptRaw('verify');
    for (const w of ['错误', '有误', '错引', '误引', '判错']) {
      expect(text).not.toContain(w);
    }
  });

  it('prompts/v1/* 的 SHA256 与 prompt_version 表记录一致', async () => {
    for (const key of ['extract', 'verify', 'map'] as const) {
      const { sha256 } = loadPromptRaw(key);
      const record = await db.query.promptVersion.findFirst({
        where: and(eq(pv.key, key), eq(pv.version, 'v1'))
      });
      expect(record?.sha256).toBe(sha256);
    }
  });
});
```

### 7.2 全代码库措辞扫描（notes #5 / MAS-2）

```bash
# tests/compliance/neutral-tone.sh
# CI 跑：全仓（除 origin/ + tests/fixtures/）grep 禁忌词
# 命中即 exit 1

FORBIDDEN="错误|有误|错引|误引|判错|自动校对|取代人工|解放编辑|AI 校对机器人"
if git grep -nE "$FORBIDDEN" -- \
    ':!origin/**' ':!tests/fixtures/**' ':!**/spec-*.md' ':!CHANGELOG.md'; then
  echo "Forbidden tone detected. See spec-coding.md §16."
  exit 1
fi
exit 0
```

**规约排除**：`spec-*.md` 因教学性原因允许出现（本文件就含）；但**运行时代码、prompt 文件、UI 文本**一律禁。

### 7.3 审核拒绝检测器 fixture（notes #1）

```typescript
// tests/compliance/moderation-detection.test.ts
const REJECTION_FIXTURES = [
  { body: { error: 'content_filter' }, status: 400, expect: true },
  { body: { choices: [{ message: { content: '很抱歉，我无法回答这个问题' } }] }, status: 200, expect: true },
  { body: { choices: [{ message: { content: '涉及敏感内容，我不便回应' } }] }, status: 200, expect: true },
  { body: { choices: [{ message: { content: 'REDACTED due to content policy' } }] }, status: 200, expect: true },
  { body: { choices: [{ message: { content: '答：孔子说的这句话...' } }] }, status: 200, expect: false },  // 负样本
];

it.each(REJECTION_FIXTURES)('isModerationRejection 识别：%j', (fx) => {
  expect(isModerationRejection(fx)).toBe(fx.expect);
});
```

新增国产模型新拒答模板时，必须**先加 fixture 再改检测逻辑**（TDD 硬约束）。

### 7.4 文史字符黄金样本（notes #3）

§3.2 的黄金样本集纳入合规套件，任何对 `lib/text/*` 的修改必过这一套。

### 7.5 置信度禁 AI 自评（real.md #2）

- 静态检查：`no-confidence-selfeval` ESLint 规则 CI 必过
- 动态检查：集成测抓 LLM 响应，若响应体含 `confidence` / `certainty` / `score` 字段，**必须被丢弃**（不得进入 DB）

```typescript
it('LLM 返回 confidence 字段时不得落库', async () => {
  msw.mockOnce('/v1/chat/completions', () => ({
    body: { /* ... */ confidence: 0.99 /* AI 自评，我们不信 */ },
    status: 200,
  }));
  await inngestTest.send(proofreadEvent);
  const [vr] = await db.query.verificationResult.findMany();
  // confidence 必由 lib/ai/confidence.ts 计算，不可能恰为 0.99
  expect(vr.confidence).not.toBe(0.99);
});
```

### 7.6 禁总分（notes #6）

- 静态：`no-total-score` ESLint 规则
- 动态：集成测扫 `/api/reports/:id` 响应 JSON，出现 `totalScore` / `overallRating` / `综合评分` → 失败
- E2E：页面 `page.content()` 不得含"总分"/"综合评分"字面量

### 7.7 日志脱敏回归（notes #2）

```typescript
it('logger.info 调用不得把 manuscriptText 原文写进 stdout', async () => {
  const stdout = captureStdout(() => {
    logger.info({ taskId: 't1', manuscriptText: '孔子登东山而小鲁' }, 'parse.done');
  });
  expect(stdout).toContain('[REDACTED]');
  expect(stdout).not.toContain('孔子登东山');
});

it('错误堆栈中包含原文时必须被 Pino redact', () => { /* ... */ });
```

### 7.8 版本戳不可变（real.md #7）

- §4.1 T-01/T-02 触发器契约测已覆盖
- E2E 额外断言：历史报告页的版本戳文本与生成时刻一致（不得显示"当前模型"）

### 7.9 TTL 销毁真删（real.md #3 + MS-G-05）

```typescript
it('Inngest ttl-destroy cron 在 7 天后真正调用 Blob del', async () => {
  // 用可注入 clock 把"现在"推到 8 天后
  clock.advance({ days: 8 });
  await inngestTest.trigger('task/ttl.destroy');
  expect(blobMock.del).toHaveBeenCalledWith(expect.stringMatching(/manuscripts\/t-expired/));
  // report_snapshot 保留（不删报告，只删原文）
  const snap = await db.query.reportSnapshot.findFirst({ where: eq(rs.taskId, 't-expired') });
  expect(snap).not.toBeNull();
});
```

---

## 8. 视觉回归测试

### 8.1 基线矩阵

| 组件 | 边缘态 | B 皮肤 | C 皮肤 | 小计 |
|---|---|---|---|---|
| QuoteCard | 8（MATCH/PARTIAL/NOT/NOT_FOUND/VARIANT/REJECTED/低置信/CJK Ext B） | 8 | 8 | 16 |
| VerdictChip | 12 组合（3 维度 × 4 verdict） | 12 | 12 | 24 |
| MatchStatusChip | 4 | 4 | 4 | 8 |
| ReferenceHitPanel | 3（单命中 / 多命中 / 无命中） | 3 | 3 | 6 |
| ProgressStream | 4 阶段 | 4 | 4 | 8 |
| AgreementDialog | 2 | 2 | 2 | 4 |
| CostEstimateCard | 3 | 3 | 3 | 6 |
| VersionStampBadge | 1 | 1 | 1 | 2 |
| ConfidenceBar | 5 区间 | 5 | 5 | 10 |
| VariantHighlight | 2 | 2 | 2 | 4 |
| ModerationRejectedSkin | 1 | 1 | 1 | 2 |
| TaskStatusBadge | 10 状态（DB §4.1 D3 改进后的 10 个） | 10 | 10 | 20 |
| **基线总数** | — | — | — | **110** |

### 8.2 规则

- 新 PR 修改组件代码 → 只跑该组件及其依赖者的基线
- 像素差异阈值：`threshold: 0.1` + `maxDiffPixels: 100`
- 基线更新需 PR 内显式 `--update-snapshots` 提交 + 一名 reviewer 明确 Approve "视觉差异"

### 8.3 字体与渲染稳定性

- 视觉测试运行容器锁定字体（Noto Sans CJK 仓库内自带 `tests/fonts/`）
- Playwright 启动参数禁用 GPU subpixel rendering（跨平台一致）

---

## 9. 性能基线

### 9.1 指标与阈值

| 指标 | 工具 | 初版目标 | 降级阈值 |
|---|---|---|---|
| Bundle size（主 route） | next-bundle-analyzer | <250 KB gzip | >300 KB 阻断 |
| Lighthouse Performance（工作台） | Lighthouse CI | ≥85 | <80 阻断 |
| LCP（报告页） | Lighthouse | <2.5s | >3s 阻断 |
| DB p95（列表查询） | Neon slow query log | <200ms | >500ms 告警 |
| Inngest step p95 | Inngest dashboard | <10s（单 verify 步） | >30s 告警 |
| LLM 单次调用 p95 | Vercel AI SDK 自带 metrics | <15s | >45s 标黄 |

### 9.2 慢查询回归

`result_reference_hit` 监控视图（DB §14 D5 M-01）接入 Slack webhook，任一维度超阈值立即通知。

---

## 10. 安全测试

### 10.1 自动化（CI）

| 类型 | 工具 | 频率 |
|---|---|---|
| 依赖漏洞 | `bun audit` | 每 PR |
| SAST | semgrep + 自定义规则集 | 每 PR |
| SCA | Snyk | 周 |
| 密钥扫描 | gitleaks | 每 PR + pre-commit |
| 容器镜像 | Trivy（若走 Docker） | 按需 |

### 10.2 手动 / 半自动

| 类别 | 场景 | 方法 |
|---|---|---|
| 资源所有权 | 用户 A 查 / 改 用户 B 的书稿、任务、报告 | E2E + API fuzz |
| 角色越权 | B/C 角色越界调管理端点 | E2E |
| IDOR | 直接改 URL 中的 taskId / reportId 到他人资源 | E2E（返回 404 而非 403，不泄露存在性） |
| CSRF | Server Action 无 Origin header / 错 Origin | 集成测 |
| 文件上传 | 恶意 .docx（zip 炸弹、含宏）、超大文件、伪扩展名 | 集成测 + fixtures |
| 鉴权 | Cookie / session 过期处理 | E2E |

### 10.3 密钥轮换演练

- 每季度一次：轮换 `SILICONFLOW_API_KEY` + `BETTER_AUTH_SECRET` → 预期无 session 中断（Better Auth 支持 secret rotate）
- 演练结果记入 `notes/security-drills/YYYY-Q.md`

---

## 11. 测试数据与 Fixtures

### 11.1 来源单一

- 基础 fixture：`tests/fixtures/quotes.ts`（来源 UI §8 的 8 边缘态）
- 文史字符 golden：`tests/fixtures/cjk-golden.ts`（§3.2）
- LLM 响应 mock：`tests/fixtures/llm-responses/`（每个文件对应一种业务情景）
- 真实样本：`origin/260319-幺弟解惑-引用校对结果.csv`（脱敏后转 fixture）

### 11.2 Seed 脚本

```typescript
// tests/seed/full-project.ts
// 创建：1 B-user + 2 C-user + 3 manuscript + 3 reference + 2 已完成任务 + 1 进行中任务
// 全部带版本戳（模拟真实冻结）
export async function seedFullProject() { /* ... */ }
```

### 11.3 禁忌

- **禁**用真实用户数据（客户书稿）做 fixture——即使脱敏也不得（real.md #3）
- **禁**在 git 中提交 secret 类 fixture（`.env` / `api-key.json`）

---

## 12. 测试环境

| 环境 | 目的 | DB | LLM | Blob |
|---|---|---|---|---|
| Unit/Local | 开发者 pre-commit | testcontainers-pg（ephemeral） | msw mock | memfs |
| CI contract | GitHub Actions | testcontainers-pg | msw mock | memfs |
| CI E2E | GitHub Actions | Neon preview branch（per PR） | siliconflow **stub account**（单独 API key + rate limit） | Vercel Blob staging |
| Nightly | 完整合规跑一次 | Neon preview branch | 同上（允许小额真调） | 同上 |
| Prod monitoring | 真实流量 | Neon main | 硅基流动生产 | Vercel Blob prod |

**硬约束**：
- E2E 的 stub LLM account 只对 `fixtures/*` 中的提示词返回预录制响应（msw 优先，必要时 sidecar server）
- 真调 LLM 仅在 nightly，且单次总成本上限 ¥5（超出自动停 job）

---

## 13. CI/CD 流水线（收口版）

汇总 `spec-coding §20`（15 项）+ 本规约新增，形成 **16 项 CI 门禁**：

| # | 检查 | 何时 | 失败处理 |
|---|---|---|---|
| 1 | Typecheck（`tsc --noEmit`） | 每 PR | 阻断 |
| 2 | ESLint（含 12 自定义） | 每 PR | 阻断 |
| 3 | Prettier | 每 PR | 阻断 |
| 4 | Unit tests | 每 PR | 阻断 |
| 5 | Contract tests（含 6 触发器） | 每 PR | 阻断 |
| 6 | Integration tests | 每 PR | 阻断 |
| 7 | Compliance tests（§7 全套） | 每 PR | 阻断 |
| 8 | E2E（关键旅程） | 每 PR（preview） | 阻断 |
| 9 | 视觉回归（变更影响组件） | 每 PR | 阻断 |
| 10 | A11y（axe）critical+serious = 0 | 每 PR | 阻断 |
| 11 | `.env.example` 同步 | 每 PR | 阻断 |
| 12 | `prompts/v1/` 冻结（`git diff` 检查） | 每 PR | 阻断 |
| 13 | Drizzle schema 有对应 migration | 每 PR | 阻断 |
| 14 | `bun audit` + semgrep | 每 PR | critical+high 阻断 |
| 15 | Bundle size 回归（>10% 阻断） | 每 PR | 阻断 |
| 16 | 密钥扫描（gitleaks） | 每 PR + pre-commit | 阻断 |

### 13.1 Nightly 额外（不在 PR 门禁）

- 完整 LLM 真调回归（成本 <¥5）
- Snyk 全仓扫 + 依赖漏洞报告
- 性能基线跑（Lighthouse CI）
- 数据库慢查询回归（Neon slow query log 前 20 条）

### 13.2 Release 门禁（main → production）

main 合入时**额外**：
- Neon main branch 迁移演练（shadow apply → 成功才真 apply）
- Preview 环境手工旅程验收（QA 工程师签字）
- CHANGELOG.md 更新 + 对应 MS / ADR 引用
- `real.md` / `notes` 任何变动触发合规评审（`real.md #7`）

---

## 14. 覆盖率目标

| 区域 | 行覆盖最低 | 行覆盖目标 | 关键分支 |
|---|---|---|---|
| `lib/ai/*`（合规） | 100% | 100% | 100% |
| `lib/text/*`（合规） | 100% | 100% | 100% |
| `lib/prompts/*`（合规） | 100% | 100% | 100% |
| PG 触发器契约 | 6/6 全覆盖 | 6/6 | — |
| `lib/auth/*` | 90% | 95% | 100%（拒登陆分支） |
| `lib/db/schema.ts`（Zod + Drizzle） | 100% schema 有测试 | 同 | — |
| `components/quote-card` 等核心 | 85% | 95% | 禁忌分支 100% |
| `app/api/*` Route Handler | 80% | 90% | 错误码分支 100% |
| 普通 `lib/*` | 70% | 85% | — |
| `components/ui/*`（shadcn 原生） | 可豁免单元测 | 由视觉测覆盖 | — |

### 14.1 覆盖率非目标化的地方

- Next.js `app/**/layout.tsx` 可豁免（框架边界）
- 开发脚本 `scripts/*.ts` 可豁免

---

## 15. 发布门禁决策表

| 条件 | 允许合入 main |
|---|---|
| 16 项 CI 全绿 | ✔ |
| 任一合规测试（§7）失败 | ✘ |
| 视觉回归未审查 | ✘ |
| 依赖漏洞 critical/high | ✘（除非白名单 + ADR） |
| prompts/v1/ 被修改（不是新增 v2） | ✘ |
| Drizzle migration 缺失 | ✘ |
| Better Auth / Inngest secret 变更无密钥轮换演练 | ✘ |

任一 ✘ 均阻断；合规红线无紧急豁免通道（即便生产事故也必须补测后再修）。

---

## 16. 非范围

- **不做**完整 WCAG AAA（仅 AA）
- **不做**全浏览器矩阵（仅 Chromium + WebKit；Firefox 由社区回归）
- **不做**移动端 E2E（UI §14.8 盲区 U8：移动布局未定）
- **不做**Load / Stress 压测（v1.0 用户规模小；v1.1+ 再评估）
- **不做**混沌工程（Netflix Chaos）——不在当前资源量级
- **不做**合约测试跨服务（无微服务；Next.js 单体）

---

## 17. 盲区清单（中度披露）

### Q1 视觉回归对"同等语义、不同像素"过度敏感

**现象**：字体 hinting / 子像素反锯齿在 macOS / Linux 差异导致基线不稳；110 基线 × 每月 10 次抖动 = 每月 3-5 次无意义的 PR 重跑。

**缓解**：运行容器锁字体 + 禁 subpixel；容忍 `maxDiffPixels=100`；仍然会漏网——**接受"偶尔需人工判读"的现实**。

### Q2 合规测试 fixture 的"滞后偏差"

**现象**：notes #1 的审核拒绝 fixture 是预录制的——国产模型审核策略升级后，新拒答模板我们不会知道，检测器会漏。

**缓解**：
- Nightly 真调 LLM 时**主动触发**已知敏感话题列表（民国史 / 文革 / 宗教等），若真返回 "通过" 意味着审核策略有变 → 告警
- 生产监控：若某 task 的 verification_result 全部 `matchStatus=MATCH` 且书稿含敏感话题白名单词 → 人工抽查

### Q3 `testcontainers-pg` 与 Neon serverless 的行为漂移

**现象**：本地 testcontainers 跑的是 Postgres 16；Neon 是 Postgres 16 但 pgbouncer 代理，某些扩展（如 `pg_stat_statements`）行为不同。契约测在本地通过但 prod 挂。

**缓解**：每周 nightly 在 Neon preview branch 跑一轮完整契约测；不完全依赖 testcontainers。

### Q4 E2E 的"时间耦合"

**现象**：`waitForSelector({ timeout: 60_000 })` 依赖 LLM 真调（即便 mock 也有 Inngest 调度延迟）；CI 偶发 flaky。

**缓解**：
- Inngest 本地开发模式 + `inngest-dev-server` 实时触发（无队列调度延迟）
- 超时的引文校对写快速 path（dev fixture 走 sync）；prod path 走异步

### Q5 合规 grep 的"教学性逃逸"

**现象**：本规约（`spec-*.md`）和 `CHANGELOG.md` 里必须说明"禁用 xx 词"——这些文件本身就会命中 grep。

**缓解**：§7.2 的 grep 脚本排除 `spec-*.md` / `CHANGELOG.md` / `tests/fixtures/**`——但这也意味着**如果有开发者把禁忌词藏在 fixture 里并在真实代码里 import**，grep 会漏。需要 code review 人工补。

### Q6 视觉测+字体的"许可证"

**现象**：Noto Sans CJK 受 SIL OFL 许可证，放仓库内没问题；但如果未来某字体方案换成商业字体，视觉基线会被动失效或引入许可证风险。

**缓解**：lock 在 OFL / Apache / MIT 许可证字体；ADR 记录字体变动。

### Q7 Inngest test 对并发幂等的模型

**现象**：`@inngest/test` 能 mock 事件流但对真正并发重放（10 个相同事件同时进）的去重行为需真服务验证。

**缓解**：Nightly 在 Inngest cloud staging 环境真发 10 条相同 event，断言只跑一次。

### Q8 覆盖率"100%"的心理陷阱

**现象**：`lib/ai/*` 100% 覆盖 ≠ 100% 正确——测试写得烂也能拿 100%（assertion 空壳）。

**缓解**：
- Mutation testing（Stryker）季度跑一次 `lib/ai/*` + `lib/text/*`
- Code review 必检测试质量（assertion 强度、边缘覆盖）

### Q9 secret 轮换的"半失败状态"

**现象**：`SILICONFLOW_API_KEY` 轮换时，Vercel 环境变量已更新但 Inngest cloud 的环境变量尚未同步（或反之），窗口期任务会间歇性失败。

**缓解**：轮换演练 checklist 必须包含 "Vercel + Inngest + Neon 同步更新" 的三点确认；演练记录存档。

### Q10 A11y 自动化的盲区

**现象**：axe 不能测"颜色意义"（如红色 = 错误的语义承载），而本项目恰好硬禁"NOT_MATCH = 红色"——axe 看不出来。

**缓解**：§6.3 自定义 E2E 规则（扫 computed color）；但这规则一旦 OKLCH 值调整会误报。

---

## 18. 交付与触发下游

### 18.1 本次交付物

- 主文件：`.42cog/spec/spec-quality-assurance.md`（本文件）
- **不产出**测试代码——那些在 `dev-coding` 执行阶段按本规约编写

### 18.2 关联更新

- `.42cog/work/milestones.md`：追加 D 级交付条目；标注规约链 0→9 闭合
- 无需修改其他 spec：本规约的所有条目都**引用**自上游规约

### 18.3 触发下游

| 下游 | 任务 | 触发点 |
|---|---|---|
| **执行阶段（非规约）：脚手架搭建** | `bun create next-app` + `spec-coding §3 目录` + `§20 CI` 同时落 | 本规约交付后 |
| **测试套件起步** | 按 §3-§7 先起**合规测试套件**（早于业务实现）；TDD 式保护硬约束 | 脚手架完成后立即 |
| **E2E 骨架** | 按 §6.1 写 9 条关键用户旅程的空壳（`test.skip()` + 注释），实现逐条拆 MS 进度 | 脚手架完成后 |

### 18.4 规约链闭合标记

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
| 8 | spec-coding | ✅ |
| 9 | **spec-quality-assurance（本规约）** | ✅ |

**规约层闭合。** 下一步切入执行阶段（脚手架 + 实装 + 按 MAS 故事推进）。

---

## 19. 附录

### 附录 A：MS → 测试用例映射（节选）

| MS | 单元 | 契约 | 集成 | E2E | 合规 |
|---|---|---|---|---|---|
| MS-L-01 注册 B/C 落 role | — | ✓ | ✓ | J-1 | — |
| MS-L-03 上传 + 费用预估 | Zod schema | — | Route Handler | J-2 / J-6 | — |
| MS-L-05 校对发起 | — | — | Inngest `proofreadRun` | J-2 | §7.5 confidence |
| MS-L-06 SSE 进度 | Hook `useTaskStream` | — | stream route | J-2 | — |
| MS-L-07 三维度报告 | VerdictChip | — | `/api/reports/:id` | J-2 | §7.6 禁总分 |
| MS-L-08/09 导出 Word/CSV | `docx` generator | — | export route | J-4 | 报告含版本戳 |
| MS-L-11 协议 | AgreementDialog | — | `/api/privacy/agreement` | J-3 | — |
| MS-G-02 暂停任务 | — | — | `/api/tasks/:id/pause` | J-6 边缘 | — |
| MS-G-03 报告对比 | — | — | compare route | J-5 | — |
| MS-G-05 TTL 销毁 | — | ✓ | `ttlDestroy` Inngest fn | J-3 | §7.9 |
| MS-D-02 审核拒绝 | isModerationRejection | — | proofreadRun 拒绝分支 | J-7 | §7.3 |
| MS-D-04 成本暂停 | cost-guard | — | `/api/tasks/:id/pause` | J-6 | — |
| MS-D-06 数据销毁请求 | — | — | `/api/privacy/destroy` | J-3 延伸 | §7.9 |

### 附录 B：合规测试 → 原约束 行号映射

| 合规测试项 | 原约束 |
|---|---|
| §7.1 Prompt 禁忌 | real.md #1 + notes #5（MAS-2 硬迁移） |
| §7.1 Prompt SHA256 | real.md #7 + notes #7 + ADR-012 |
| §7.2 代码库措辞扫描 | notes #5 + MAS-2 |
| §7.3 审核拒绝检测 | notes #1 + MS-D-02 |
| §7.4 文史字符黄金样本 | notes #3 + ADR-014 |
| §7.5 禁 AI 自评 | real.md #2 + ADR-007 |
| §7.6 禁总分 | notes #6 + UI §7 + spec-coding §14/16 |
| §7.7 日志脱敏 | notes #2 + ADR-015 |
| §7.8 版本戳不可变 | real.md #7 + notes #7 + PG T-01~T-05 |
| §7.9 TTL 销毁真删 | real.md #3 + ADR-013 + MS-G-05 |

### 附录 C：快速启动命令

```bash
# 开发期
bun run test                      # unit + contract + integration + compliance
bun run test:e2e                  # Playwright 关键旅程
bun run test:visual               # 视觉回归
bun run test:compliance           # 只跑 §7 合规套件（CI 必跑，最快）
bun run test:coverage             # 带覆盖率报告

# 契约测试（需 docker 启 testcontainers）
bun run test:contract

# CI 本地模拟
bun run ci                        # = typecheck + lint + test + e2e + visual + compliance
```

---

**版本说明**：v1.0.0-draft。任何**放松**合规测试条目（§7 / §13 / §15）均需走架构评审 + 追加订正记录；绝不走"临时跳过 CI"（`--no-verify` / GitHub Actions skip）的路径——合规红线无例外通道。
