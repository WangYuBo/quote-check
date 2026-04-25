---
name: project-milestones
description: quote-check **事件日志**（只追加、不改写）。前瞻规划见 .42cog/work/roadmap-v1.0.md；愿景版本见 .42cog/meta/meta.md §项目里程碑
updated: 2026-04-20
---

# 事件日志（Milestones Log · Activity Log）

> **文件定位澄清（2026-04-20 · roadmap 落盘同步）**：
>
> 本文件是**事后账本**（changelog / activity log），记录已发生的事件。
>
> - 愿景版本节奏（MVP / v1.0 / v2.0）→ 见 `.42cog/meta/meta.md §项目里程碑`
> - 前瞻执行路线图（m1 / m2 / m3 + 判据 + 决策门）→ 见 `.42cog/work/roadmap-v1.0.md`
> - 已发生的实质进展（本文件）→ 每次 feat/fix/docs/test 后追加一行
>
> 此前本文件标题曾叫"里程碑记录"，与 meta §项目里程碑 一词双义，现修正为"事件日志"以消歧。保留"Milestones Log"英文副标以不破坏历史引用（milestone 在软件工程语境里就是 activity-level checkpoint，并非 release-level milestone）。

## 规则

1. **只追加、不改写**——改写等同于篡改项目历史，违背 real.md #7 "版本锁定"精神
2. **每条格式固定**：`日期 | 级别 | 状态 | 一句话摘要 | 关联产物`
3. **级别枚举**：
   - `M` 重大里程碑（版本发布 / 规约落地 / 架构级决策）
   - `F` 功能项（单个 affordance / MAS 故事完成）
   - `T` 技术债（修复 / 重构 / 基础设施）
   - `D` 文档（规约 / 认知模型 / 工程 notes）
4. **状态枚举**：
   - 🟢 已完成
   - 🟡 进行中
   - 🔴 阻塞 / 待决策
   - ⚪ 计划中
5. **修正错误条目的方式**：**追加一条订正记录**（带 ↳ 前缀指向原条目），不删改原条目

---

## 当前阶段

**v1.0 执行阶段 · 数据层就位 → Inngest + Auth + AI 客户端**

- 目标（对齐 meta.md）：突破 20000 字符截取 + 原典语料库接口层 + 长任务队列
- 支撑文档：规约 v1.0-draft 共 9 份（`.42cog/spec/spec-*.md`）全部落地；产品、用户故事、系统架构、数据库、UI、编码、质量保障互相引用闭合
- 已识别 MAS 故事：6 个正式 + 1 个后期候选（MAS-候选-7 留待后期）
- **脚手架状态**：Next.js 15 + React 19 + Drizzle + Inngest + AI SDK + Better Auth + Zod + Pino + Tailwind v4 已装；typecheck / lint / format / env-sync 四检全绿；prompts/v1/ 三份冻结（extract 28c55aa6 / map dfdc27ad / verify 6117d149）
- **合规基线**：TDD-early 43 测试（prompt-integrity 14 · moderation-detection 12 · cjk-golden 17）全绿；4 份核心 lib（prompts / moderation / normalize / variants）最小实装
- **数据层基线**：lib/db/schema.ts（15 表 / 4 pgEnum + 1 varchar+CHECK 状态机 / 完整 relations） + lib/db/types.ts + lib/db/index.ts（Neon HTTP + drizzle）+ 0001_triggers.sql（6 触发器 + GIN / trigram 索引 + task.status CHECK + 监控视图 + 冷归档表）全部落位
- **下一步触发**：(1) Neon 真实 DB 建分支后 `bun run db:generate` 产出 0000_init.sql 合并 0001_triggers.sql；(2) tests/contract/ 用 testcontainers-pg 跑 6 触发器契约测；(3) lib/auth.ts（Better Auth）与 lib/ai/client.ts（DeepSeek via siliconflow baseURL）同步起手

---

## 进行中（🟡）

- `2026-04-18` | M | 🟡 | v1.0 产品规约 v1.0-draft 已生成，进入 Review 期 | `.42cog/spec/spec-product-requirements.md`

---

## 已完成（🟢）

- `2026-04-25` | F | 🟢 | **MAS-3 拒绝显式**：moderation-gate 真实 probe call（前 3 段 ≤600 字）+ `isModerationRejection()` 签名 A/B 双覆盖 + `REJECTED_BY_MODERATION` 独立 UI（rejected-skin 斜纹 + ShieldOff 图标 + 60% 不透明） | `inngest/functions/proofread-run.ts` · `app/tasks/[id]/page.tsx`

- `2026-04-24` | F | 🟢 | **MAS-2 参考为准绳**：references 上传 API（POST/GET `/api/references`，copyrightDeclared 强制）+ `reference_paragraph` 表 + GIN trigram 索引 I-03 + `pg_trgm` 段落级检索（rawSql 绕 drizzle array 序列化坑）+ `stripForTrigram()` 去标点归一化 + 四态 matchStatus（MATCH/PARTIAL_MATCH/NOT_MATCH/NOT_FOUND_IN_REF）+ `result_reference_hit` M:N 填充（pg_trgm + hit=true/false + snippet + similarity）+ upload 页三阶段扩展 + reports 页命中区块；E2E 验证：论语 referenceId `088e7520`，《论语》引文 PARTIAL_MATCH similarity=0.647 hit=true pg_trgm ✓，其余两引文 NOT_FOUND_IN_REF ✓；typecheck ✓ lint ✓ | `app/api/references/route.ts` `lib/services/reference.ts` `lib/ai/retrieval.ts` `lib/text/normalize.ts`(stripForTrigram) `lib/db/schema.ts`(referenceParagraph) `inngest/functions/proofread-run.ts` `lib/services/task.ts`(saveReferenceHits) `app/upload/page.tsx` `app/reports/[taskId]/page.tsx`
- `2026-04-24` | T | 🟢 | **normMatchStatus 中文归一化修复 + MAS-1 E2E 验证**：LLM 返回 `"无需比对"` 等中文值导致 Zod VerifyOutputSchema 解析失败（"LLM 返回格式异常"）；以 `normMatchStatus()` + `z.unknown().transform()` 统一归一化；typecheck ✓ lint ✓；E2E 测试 3 引用全部解析正确（论语/资本论 MATCH confidence=1.000，狂人日记 PARTIAL_MATCH），verdictInterpretation/verdictContext 均输出合法英文 enum 值；MAS-1 判据全部满足 | `inngest/functions/proofread-run.ts`
- `2026-04-24` | F | 🟢 | **MAS-1 校对主流程基座**：`POST /api/manuscripts`（Vercel Blob + txt/md/docx 解析 + paragraph 落库）→ `POST /api/tasks`（task 创建 + Inngest send）→ proofread-run 真实 LLM（extract-quotes DeepSeek + verify-each-quote 串行 + 三信号置信度 + reportSnapshot freeze）→ `GET /api/reports/[taskId]`（三维度 JSON）；UI 三页（upload 拖拽 / tasks/[id] 进度轮询 / reports/[taskId] 三维度卡片）；typecheck ✓ · lint ✓ · unit 24/24 | `app/api/manuscripts/` `app/api/tasks/` `app/api/reports/` `inngest/functions/proofread-run.ts` `lib/parsers/manuscript.ts` `lib/services/` `lib/storage/blob.ts`
- `2026-04-24` | T | 🟢 | **PG 6 触发器契约测 21/21 全绿（m1 达成）**：Docker Desktop 启动后首次真实执行 `bun run test:contract`，testcontainers-pg 拉起 postgres:16-alpine → 跑全量迁移 + _hand_triggers.sql → 21 个 it 全部 pass（T-01~T-06 + C-03 + 扩展/索引 · 152s）；m1 所有 7 项判据闭合；roadmap-v1.0.md 当前位置更新为 m2 起点 | `tests/contract/db-triggers.test.ts`, `.42cog/work/roadmap-v1.0.md`
- `2026-04-20` | D | 🟢 | **路线图 v1.0 落盘 + 三文档语义分工**：新增 `.42cog/work/roadmap-v1.0.md`（m1/m2/m3 判据 + MAS 依赖图 + 3 个决策门 DG-m2.1/2.2/3.1 + 预估 4-5 周）；修 `meta.md §项目里程碑` 明确其定位为"版本愿景"，与 roadmap（执行）/ milestones（事后账本）三层分工；消除"里程碑"一词双义 | `.42cog/work/roadmap-v1.0.md`, `.42cog/meta/meta.md`, `.42cog/work/milestones.md`
- `2026-04-20` | T | 🟢 | **PG 6 触发器契约测**：tests/contract/db-triggers.test.ts 覆盖 T-01~T-06 + C-03 + 扩展/索引在场性（21 it）；testcontainers-pg 11.14.0 装机；`test:contract` 脚本固化 DOCKER_HOST 指向 Docker Desktop socket；暴露 spec-quality-assurance §4.1 触发器名漂移（记为 TD-1 待修）| `tests/contract/db-triggers.test.ts`, `package.json`
- `2026-04-20` | F | 🟢 | **Inngest proofread-run 骨架 + 幂等三要素**：lib/idempotency.ts `buildResultIdempotencyKey({taskId, quoteId, attemptN})` 强制三要素（attempt 缺省/非整数/负数拒）；inngest/functions/proofread-run.ts 八步 step.run 骨架（load-task→parse→moderation-gate→extract→verify→map→confidence→freeze-report）；app/api/inngest/route.ts 注册 proofreadRunFn；concurrency key=taskId limit=1；11 单测全绿 | `lib/idempotency.ts`, `inngest/functions/proofread-run.ts`, `tests/unit/idempotency.test.ts`
- `2026-04-20` | F | 🟢 | **Better Auth 0.7.5 全生命周期真实验证**：lib/auth.ts（drizzleAdapter + emailAndPassword + additionalFields[role/organization/agreementVersion/agreementAcceptedAt/suspendedAt] + cookie prefix qc + 7d session）；app/api/auth/[...all]/route.ts toNextJsHandler；修 session.token 为 NULL 可（0.7.5 用 session.id 作 cookie）；signup/signin/session/signout 四 API 真实 200 | `lib/auth.ts`, `app/api/auth/[...all]/route.ts`, `lib/db/schema.ts` (session.token drop notNull)
- `2026-04-20` | F | 🟢 | **AI client（DeepSeek via 硅基流动）+ 三信号置信度**：lib/ai/client.ts（createOpenAI + baseURL siliconflow + proxy 告警）；lib/ai/confidence.ts `computeConfidence(signals) / stripLlmSelfScores()` + 权重常量 v1.0（w1=0.5/w2=0.5/w3=0）；scripts/ai-smoke.ts 握手 16 token 返回 "OK"；13 单测覆盖融合 + 剥离 LLM 自评；发现本机 http_proxy 劫持（已存 memory quote-check-local-proxy-hijack）| `lib/ai/client.ts`, `lib/ai/confidence.ts`, `tests/unit/ai-confidence.test.ts`
- `2026-04-20` | T | 🟢 | **Neon 真实库迁移 + 两步部署工作流**：`db:migrate` 跑 0000（15 表）+ 0001（session.token nullable 修）；`db:triggers` 独立脚本读 `_hand_triggers.sql`（6 触发器 + GIN + pg_trgm + CHECK + 监控视图 + 归档表）；`db:check` 脚本验证 16 表 / 6 触发器 / 3 索引 / 扩展全绿；文件名由 `0001_triggers.sql` 改为 `_hand_triggers.sql` 避 drizzle 0000/0001 命名空间；存 memory quote-check-db-init-migration 固化双命令纪律 | `scripts/db-apply-triggers.ts`, `scripts/db-check.ts`, `scripts/db-cleanup-smoke.ts`, `lib/db/migrations/_hand_triggers.sql`
- `2026-04-19` | D | 🟢 | **v1.0 数据层落地**：lib/db/schema.ts 实装 15 张表（user / session / account / verification / manuscript / paragraph / quote / reference / task / verification_result / result_reference_hit / report_snapshot / audit_log / user_agreement_acceptance / prompt_version） + 4 pgEnum（user_role / reference_role / quote_kind / match_status）+ task.status 以 varchar+CHECK 承接（D-03a）+ 完整 relations；lib/db/types.ts 导出 15 组 T/NewT；lib/db/index.ts Neon HTTP 单例；lib/db/migrations/0001_triggers.sql 6 触发器（T-01 报告冻结 / T-02 版本戳冻结 / T-03 结果不可改 / T-04 audit_log append-only / T-05 协议 append-only / T-06 prompt_version 不可改） + I-01/I-02 GIN 索引（task.reference_ids / pg_trgm trigram） + C-03 status CHECK + M-01 监控视图 + M-02 冷归档表；typecheck / lint 全绿；43 合规测试仍全绿；contract 测试留待 testcontainers-pg 就位后 | `lib/db/{schema,types,index}.ts`, `lib/db/migrations/0001_triggers.sql`
- `2026-04-19` | D | 🟢 | **TDD-early 合规基线**：3 文件 43 测试覆盖 prompt 冻结（14 · SHA256 / 禁忌判决词 / 营销话术 / verify 结构）、审核拒绝检测（12 · 9 fixture + 3 边界 · 200/4xx/Error 三签名）、CJK 规范化（17 · 黄金样本 / 异体等价 / 代理对安全 / OpenCC 乾坤回补）；最小 lib 实装 4 份（prompts / moderation / normalize / variants）；未走 mock 兜底，全部走真实 lib 调用 | `tests/compliance/*.test.ts`, `tests/fixtures/cjk-golden.ts`, `lib/ai/{prompts,moderation}.ts`, `lib/text/{normalize,variants}.ts`
- `2026-04-19` | D | 🟢 | **v1.0 脚手架启动**：Next.js 15.1.6 + React 19 + Drizzle 0.36 + Inngest 3.27 + AI SDK 3.4 + Better Auth 0.7 + Tailwind v4 装机；tsconfig strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` + `verbatimModuleSyntax` 全开；ESLint flat config（含 `no-restricted-imports` 禁 `@ai-sdk/openai`/`bcrypt`/`next/router`）；Pino redact + env.ts Zod 校验 + env-sync 脚本 + prompt-frozen 脚本；typecheck / lint / format / env-sync 四检全绿；prompts/v1/ 三份冻结（SHA256 已记录）；eslint-config-next 旧格式 PATCH 暂移除（Next 16 稳定 flat config 后补） | `quote-check/{package.json,tsconfig.json,next.config.ts,drizzle.config.ts,eslint.config.mjs,app/*,lib/env.ts,scripts/*}`
- `2026-04-19` | M | 🟢 | **v1.0 规约链闭合（0→9）**：meta + cog + real + 产品 + 用户故事 + 系统架构 + 数据库 + UI + 编码 + 质量保障 全部交付；所有硬约束已映射到可验证单元；下游切入执行阶段（脚手架 + 按 MAS 故事实装） | `.42cog/spec/*.md`
- `2026-04-19` | D | 🟢 | v1.0 质量保障规约完成（金字塔 50/30/20 + 合规测试独立分层 9 项 + PG 6 触发器契约测 + Inngest 幂等测 + 110 视觉基线 + 16 项 CI 门禁 + 10 条盲区披露），合规红线无临时跳过通道 | `.42cog/spec/spec-quality-assurance.md`
- `2026-04-19` | D | 🟢 | v1.0 编码规范规约完成（TypeScript strict + noUncheckedIndexedAccess + Drizzle/Inngest/AI SDK 硬约束 + 12 条 ESLint 自定义规则 + 日志脱敏 + 幂等键 + Prompt 冻结 + 15 项 CI 清单 + 10 条盲区披露），规约链闭合到 §8/9（spec-quality-assurance 为最后一环）；下游可启 `bun create next-app` 脚手架 | `.42cog/spec/spec-coding.md`
- `2026-04-19` | D | 🟢 | v1.0 UI 设计规约完成（12 核心自定义组件 + OKLCH 色系 Tailwind v4 tokens + B/C 皮肤差异化 via `data-skin` + 三维度禁综合总分 + 中性措辞 ESLint/CI 双层防护 + VARIANT ≠ MISMATCH 视觉区分 + REJECTED_BY_MODERATION 独立皮肤 + 10 条新盲区披露），下游 dev-coding 可直接按 §15 扩展点清单起脚手架 | `.42cog/spec/spec-ui-design.md`
- `2026-04-19` | T | 🟢 | 数据库规约二次修订：盲区 D3（pgEnum 演进成本）与 D5（result_reference_hit 行数爆炸）逐个改进落地——三维度 enum 移除、task.status 改 varchar+CHECK+Zod、新增监控视图 + 冷归档表 + 4 档告警阈值 + 查询契约 | `.42cog/spec/spec-database-design.md` §4.1 + §4.3 + §5 + §6.3 + §14
- `2026-04-19` | D | 🟢 | v1.0 数据库设计规约完成（7 核心实体 + 4 辅助表 + 3 Better Auth 表 + 1 prompt_version 登记表 + 6 PG 触发器 + 完整 Drizzle schema + Zod 宽松 LLM schema + Neon 分支迁移工作流 + 8 条新盲区披露），下游 dev-ui-design / dev-coding 可直接抽取 §4 代码 | `.42cog/spec/spec-database-design.md`
- `2026-04-18` | D | 🟢 | v1.0 系统架构规约完成（7 子系统 + 16 ADR + TS 栈锁定 + 10 盲区披露），下游可驱动 dev-database-design / dev-ui-design / dev-coding | `.42cog/spec/spec-system-architecture.md`
- `2026-04-18` | M | 🟢 | **v1.0 技术栈转向**：从 Python/FastAPI 渐进演进切换为 TypeScript + Next.js 15 + Vercel + Inngest + Neon + Drizzle + Better Auth + Vercel AI SDK，理由是 docker 自托管过重、Neon/Vercel 托管服务降低部署门槛；MVP（`origin/`）降级为只读归档，唯一直搬资产为 3 份 prompt 文件与 `_BOOK_NAME_ALIASES` 别名表 | `.42cog/spec/spec-system-architecture.md` §1 Context
- `2026-04-18` | D | 🟢 | 用户故事规约 v1.0-draft 完成（5 CS + 25 MS，L/D/G = 12/8/5 ≈ 48/32/20，偏离标准 70/20/10 以适配本项目 Dark 故事高权重的信任特质） | `.42cog/spec/spec-user-story.md`
- `2026-04-18` | D | 🟢 | MAS-2 按编辑真实工作流重塑：从"异文辨识/多版本比对"改为"以上传参考为准绳，中性措辞报符合/不符合"；prompt 措辞迁移列为硬迁移项 | `.42cog/spec/spec-product-requirements.md`（§2.2 / §3.7 / §10.1 glossary）
- `2026-04-18` | D | 🟢 | 产品规约初稿完成（affordance 驱动 + MAS 骨架，6 个故事 + 12 条 Primary affordance） | `.42cog/spec/spec-product-requirements.md`
- `2026-04-18` | D | 🟢 | 里程碑记录机制落地（本文件） | `.42cog/work/milestones.md`
- `2026-04-17` | D | 🟢 | 认知模型 cog.md 定稿（7 类实体 + 关系矩阵） | `.42cog/cog/cog.md`
- `2026-04-17` | D | 🟢 | 现实约束 real.md 定稿（4 必选 + 3 可选） | `.42cog/real/real.md`
- `2026-04-17` | D | 🟢 | 项目元信息 meta.md 定稿（价值主张 + 双用户定位 + MVP 技术栈） | `.42cog/meta/meta.md`
- `2026-04-17` | D | 🟢 | 工程与伦理补充 notes 完成（7 条工程/市场/可复现性约束） | `notes/260417-engineering-and-ethics-notes.md`
- `2026-03-??` | M | 🟢 | MVP 上线（三维度校对 + 多格式解析 + SSE + Word/CSV 导出，在真实书稿《幺弟解惑》上跑通） | `origin/`（MVP 上线具体日期待补，参考 `origin/260319-幺弟解惑-引用校对结果.csv` 时间）

---

## 计划中（⚪）

### v1.0 正式版目标（对齐 meta.md）

- ~~| M | ⚪ | v1.0 系统架构规约~~ → 已完成（2026-04-18）
- ~~| M | ⚪ | v1.0 数据库设计规约~~ → 已完成（2026-04-19）
- ~~| M | ⚪ | v1.0 UI 设计规约~~ → 已完成（2026-04-19）

### MAS 故事实施

- ~~| F | ⚪ | MAS-1 基座重构~~→ 已完成（2026-04-24）
- ~~| F | ⚪ | MAS-2 参考为准绳~~→ 已完成（2026-04-24，map.txt 中性措辞 lint 延后至 MAS-2b）
- | F | ⚪ | MAS-3 拒绝显式：`is_moderation_rejection` 检测 + UI 独立状态 | —
- | F | ⚪ | MAS-4 成本透明：预估 + 二次确认 + 越界暂停 | —
- | F | ⚪ | MAS-5 版本冻结：prompt hash + 数据库只读约束 | —
- | F | ⚪ | MAS-6 保密闭环：TTL 销毁 + 日志脱敏 + PII scrubber | —

### 关键技术债

- | T | ⚪ | 任务持久化：从 `_tasks: dict` 迁移到 PostgreSQL + Celery/Arq（notes #4） | —
- | T | ⚪ | 日志脱敏：LoggerFilter 强制排除原文片段（notes #2） | —
- | T | ⚪ | 突破 20000 字符截取：RAG / 向量检索 | —
- | T | ⚪ | 幂等 key 机制：`{task_id}_{quote_id}_{attempt_n}` 防重试风暴 | —
- | T | ⚪ | 置信度客观化：去除 AI 自评依赖（real.md #2） | —
- | T | ⚪ | 文史字符工程：OpenCC + CJK Ext B-G + 异体字表（notes #3） | —

### v2.0 规划（非当前范围）

- | M | ⚪ | v2.0 异文版本对比功能增强 | —
- | M | ⚪ | v2.0 批量 API + 合规审计模块 | —
- | M | ⚪ | MAS-候选-7 AI agent 感知主体：OpenAPI / MCP Server（v1.1+ 起步） | —

---

## 阻塞 / 待决策（🔴）

_（空）_

---

## 订正记录

- `2026-04-20` | ↳ 订正 | 本文件标题/定位重写：原顶部文案将此处语义模糊地称作"里程碑记录"，导致与 meta.md §项目里程碑（版本节点语义）一词双义。本日澄清：meta = 版本愿景 / roadmap-v1.0.md = 前瞻执行路线 / 本文件 = 事后事件日志。原标题"里程碑记录"保留为历史副标，不删改历史条目；新追加条目仍遵循只追加原则。触发点：用户在 2026-04-20 指出"里程碑"在本项目至少两处（meta + milestones）并存且无路线图，开发进度不清、前进路线不明。解决方案：roadmap-v1.0.md 落盘 + 三文档分工。
- `2026-04-19` | ↳ 订正 | 2026-04-18 条目 `v1.0 产品规约 v1.0-draft 已生成，进入 Review 期`（🟡）的 Review 期实际已结束——本日 spec-coding.md 闭合了"上游全部 8 份规约"的链路，产品规约进入稳态事实成立。按只追加原则，原 🟡 条目保留作历史标识，状态迁移由本条订正承接；剩余唯一规约层待办为 `spec-quality-assurance`。
- `2026-04-18` | ↳ 订正 | 本日早先条目 `v1.0 产品规约 v1.0-draft 已生成，进入 Review 期`（🟡 进行中）的含义已被新架构规约的落地向前推进，但按"只追加不改写"原则，原条目保留；产品规约本身未变，只是下游架构规约已基于它产出——状态迁移由后续单独条目承接，不在此处改写原条目的 🟡 标记。
- `2026-04-18` | ↳ 订正 | 对 MAS-2 的理解从"异文辨识（多版本学术比对）"收敛到"以上传参考为准绳，中性措辞只报符合/不符合"。触发点：编辑真实工作流澄清——出版社质检以权威参考为绳尺，"是否错误"由编辑终审，系统不越权判错。影响：MAS-2 / A07 / glossary / N09 非 affordance / prompt 文案迁移均已同步；`SourceCorpusProvider` 抽象保留以备后期外部语料库接入。原条目为规约首版 §2.2 MAS-2（现已覆盖写入，保留本订正记录作为历史线索）。

---

## 历史归档

_（按季度或按版本折叠旧条目，防止文件过长。当前无归档。）_

---

## 使用约定

**何时追加条目（触发点）**：

1. 任一 `.42cog/spec/*.md` 新建或进入重大修订
2. 任一 MAS 故事状态迁移（计划 → 实施 / 实施 → 完成 / 完成 → 回滚）
3. 真实事故、回滚、架构级决策
4. `real.md` / `cog.md` / `meta.md` 被修订
5. 关键技术债被消除或新增

**如何追加**：

```markdown
- `YYYY-MM-DD` | 级别 | 状态 | 一句话摘要 | 关联产物路径或 —
```

将条目插入合适区块（进行中 / 已完成 / 计划中 / 阻塞），**在区块内部按时间倒序**（最新在上）。

**何时归档**：

单一区块超过 40 条时，将最旧的一批条目折叠到"历史归档"节，并按 `YYYY-Q` 或 `vX.Y` 分组。

**不做什么**（里程碑功能的 non-affordance）：

- **不**由 AI 自动生成条目（避免幻觉历史）——AI 可辅助起草，但必须人工确认后追加
- **不**删改历史条目（修正用订正记录实现）
- **不**作为前瞻任务看板（前瞻规划在 `spec-*.md`，本文件只记录事后）
