---
name: project-milestones
description: quote-check 项目里程碑与开发进度（只追加、不改写；每次实质性进展追加一行）
updated: 2026-04-19-v4
---

# 里程碑记录（Milestones Log）

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

**v1.0 执行阶段 · 脚手架就位 → 核心模块实装**

- 目标（对齐 meta.md）：突破 20000 字符截取 + 原典语料库接口层 + 长任务队列
- 支撑文档：规约 v1.0-draft 共 9 份（`.42cog/spec/spec-*.md`）全部落地；产品、用户故事、系统架构、数据库、UI、编码、质量保障互相引用闭合
- 已识别 MAS 故事：6 个正式 + 1 个后期候选（MAS-候选-7 留待后期）
- **脚手架状态**：Next.js 15 + React 19 + Drizzle + Inngest + AI SDK + Better Auth + Zod + Pino + Tailwind v4 已装（574 包 / bun.lockb 已写）；typecheck / lint / format / env-sync 四检全绿；prompts/v1/ 三份冻结（extract 28c55aa6 / map dfdc27ad / verify 6117d149）
- **下一步触发**：TDD-early 写合规测试骨架（prompt-integrity / moderation-detection / cjk-golden），再实装 lib/db/schema.ts（含 6 PG 触发器迁移）与 lib/ai/client.ts、lib/auth.ts 核心

---

## 进行中（🟡）

- `2026-04-18` | M | 🟡 | v1.0 产品规约 v1.0-draft 已生成，进入 Review 期 | `.42cog/spec/spec-product-requirements.md`

---

## 已完成（🟢）

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

- | F | ⚪ | MAS-1 基座重构：任务持久化 + 三维度独立呈现 + 版本戳 | `src/`（待创建）
- | F | ⚪ | MAS-2 参考为准绳：单/多权威参考上传 + 三态匹配（MATCH/NOT_MATCH/NOT_FOUND_IN_REF）+ prompt 中性措辞迁移 + `SourceCorpusProvider` 接口预留 | —
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
