---
name: roadmap-v1.0
description: quote-check v1.0 执行路线图（前瞻性交付计划 · 版本节奏 + 判据 + 依赖图 + 决策门）
created: 2026-04-20
owner: yubo
---

# 路线图 · v1.0 执行计划（Roadmap）

## 本文件定位

**路线图 = 前瞻性的分阶段交付计划**——回答"接下来按什么顺序做、做到什么程度算一个阶段达成"。

与项目中其他两个相关文档的语义分工：

| 文档 | 语义 | 粒度 | 方向 | 变更频率 | 用法 |
|------|------|------|------|---------|------|
| `.42cog/meta/meta.md §项目里程碑` | **版本里程碑**（release milestone） | 大（MVP / v1.0 / v2.0） | 前瞻但粗 | 季度级 | 回答"项目要做到哪里" |
| `.42cog/work/roadmap-v1.0.md`（本文件） | **执行路线图**（roadmap） | 中（m1 / m2 / m3 + 判据） | 前瞻且可执行 | 周级 | 回答"下一个交付是什么、何时算达成" |
| `.42cog/work/milestones.md` | **事件日志**（activity log / changelog） | 小（单条交付） | 事后 | 每次实质进展 | 回答"到今天为止已经做过什么" |

**三个文档的关系**：meta 锁方向 → roadmap 拆阶段 → milestones 记流水。任何一层缺失，项目就会陷入"没路标（meta 缺）/ 没路线（roadmap 缺）/ 没账本（milestones 缺）"。

**为什么需要显式分工**：此前 meta.md §项目里程碑 与 milestones.md 都用了"里程碑"一词，但语义错位——meta 的"里程碑"是版本节点（3 条），milestones.md 的"里程碑"是事件日志（N 条）。两者一词双义导致"我做的事算不算里程碑"这种反复无解的问题。本路线图出现后，两份文档各回其位：meta 管愿景、milestones 管账本、roadmap 管执行。

---

## 当前位置（2026-04-24）

```
v1.0-m1 基建就绪    ████████████████ 100%   ✓ 达成（2026-04-24）
v1.0-m2 校对主流程  ░░░░░░░░░░░░░░░░   0%   ← 当前
v1.0-m3 上线前闭环  ░░░░░░░░░░░░░░░░   0%
```

**m1 全部 7 项已达成**：

1. ✓ 9 份规约闭合（meta/cog/real + 6 份 spec-*）
2. ✓ Drizzle 16 表 + 6 触发器 + 3 GIN + pg_trgm 部署到 Neon
3. ✓ Better Auth 0.7.5 全生命周期真实验证
4. ✓ AI client（DeepSeek via 硅基流动 baseURL）ai-smoke 握手
5. ✓ Inngest proofread-run 八步骨架 + idempotency 三要素
6. ✓ PG 6 触发器契约测 21/21 全绿（testcontainers-pg · 2026-04-24）
7. ✓ milestones.md 追平 + roadmap-v1.0.md 落盘

---

## v1.0-m1 基建就绪

**判据（7/7 全勾 = m1 达成）**

| # | 判据 | 验证方式 | 状态 |
|---|------|---------|------|
| 1 | 9 份 spec-*.md 闭合 | 文件存在 + 相互引用无悬空 | ✓ |
| 2 | Drizzle schema 迁移到 Neon 真实库 + 触发器应用 | `db:check` 全绿 | ✓ |
| 3 | Better Auth 全生命周期可用 | signup/signin/session/signout 四 API 真实响应 | ✓ |
| 4 | AI client 连通硅基流动 | `ai:smoke` 返回 "OK" 且 tokenUsage 非零 | ✓ |
| 5 | Inngest 路由 + 骨架函数注册 | GET /api/inngest 返回函数清单 | ✓ |
| 6 | 6 触发器契约测全绿 | `test:contract` pass 21+ | ✓ 2026-04-24 |
| 7 | milestones.md 追平实际进度 + roadmap-v1.0.md 落盘 | 文件存在 + 4 条 v0.0.12-16 补登 | ✓ |

**m1 达成（2026-04-24）**

**m1 阶段已知技术债**（不阻塞 m1 达成，但需在 m2 前消化）：

- TD-1: `spec-quality-assurance §4.1` 触发器表格名与实际 _hand_triggers.sql 存在漂移——spec 写的是 `prevent_verification_result_frozen_fields_update / cascade_task_frozen_at / forbid_prompt_version_mutation / archive_result_reference_hit`，实际是 `prevent_version_stamp_mutation / prevent_result_mutation / prevent_prompt_version_mutation`，且 T-06 其实是归档表（不是触发器）。下次 spec 迭代修正。
- TD-2: `eslint-config-next` 因 flat config 不兼容暂移除——等 Next 16+ 稳定后补回，现在只走 typescript-eslint strict。
- TD-3: 自定义 12 条 ESLint 规则（no-accusatory-language / no-total-score / no-confidence-selfeval / ...）未实装，只在 eslint.config.mjs 注释占位。

---

## v1.0-m2 校对主流程

**判据**：在真实 Neon + 真实 DeepSeek 上，能把一份 ≥ 5000 字测试书稿（复用 `origin/260319-幺弟解惑` 为黄金集）跑通三维度报告，UI 可展示；cost-guard 在人为设 0.01 美元预算时触发暂停。

### 依赖图（拓扑排序）

```
      ┌──── MAS-3 拒绝显式 ────────┐
      │    （isModerationRejection） │
      │                             │
MAS-1 基座 ─┼──── MAS-4 成本透明 ────┤──→ m2 达成
(MS-L-01/03  │   （预估 + cost-guard） │     关键里程碑
 /05/06/07)  │                        │
      │                             │
      └──── MAS-2 参考为准绳 ──────┘
           （references + M:N hit）
```

**关键排序约束**：
- MAS-1 必须先开（三维度字段是 DB 表主力列，其他 MAS 都依赖 verification_result 已有 row）
- MAS-3 / MAS-2 可与 MAS-1 并行（不同文件/模块，无代码冲突）
- MAS-4 最后（cost-guard 需要完整 verify 流程来测预算钩子）

### 各 MAS 交付判据

| MAS | 交付判据 | 预估 |
|-----|---------|------|
| MAS-1 基座 | `POST /api/manuscripts` 上传成功 → `POST /api/tasks` 发事件 → Inngest proofread-run 消费 → 三维度结果入 verification_result → `/api/reports/:id` 返回 JSON，UI 可展示三维度卡片 | 3-4d |
| MAS-2 参考为准绳 | references 上传 API + 四态匹配（MATCH/PARTIAL_MATCH/NOT_MATCH/NOT_FOUND_IN_REF）+ result_reference_hit M:N 填充 + prompts/v1/map.txt 中性措辞通过 prompt-integrity lint | 2-3d |
| MAS-3 拒绝显式 | `lib/ai/moderation.isModerationRejection()` 接入 proofread-run moderation-gate；task.status=REJECTED_BY_MODERATION 独立返回 UI，颜色 token 走规约 §7.3 红旗皮肤 | 1d |
| MAS-4 成本透明 | `POST /api/tasks/estimate` 预估 tokens × 单价 → `POST /api/tasks/confirm` 确认后才跑 → cost-guard Inngest 函数监控 task.cost_actual_cents，越界 → PAUSED_COST + Sentry 告警 | 2-3d |

**m2 预估总工期**：8-11 工作日（约 2-3 周）

### m2 决策门（必须在到达该节点时显式决策）

- **DG-m2.1（MAS-1 中期）**：verify-each-quote 用 `step.parallel` 全并发，还是分批 × N？
  - 背景：Inngest 免费层限制 = 25 并发 steps / 每小时 1000 事件
  - 选项 A：串行（简单但慢；500 引用 × 2s = 17min）
  - 选项 B：step.parallel limit=10（快 10×；但并发失败时重试放大）
  - 选项 C：手动分批 step.run 批处理
  - 触发时机：MAS-1 verify-each-quote 骨架填充完毕时
- **DG-m2.2（MAS-2 中期）**：PARTIAL_MATCH 的 similarity 阈值？
  - 背景：pg_trgm similarity 0-1 连续值，需要定一个业务上可解释的切点
  - 依赖：在真实语料（origin/ 的 CSV 历史数据）上实测
  - 输出：写入 `lib/ai/confidence.ts` 常量 + spec-coding §X 注明依据
- **DG-m2.3（MAS-3 末期）**：是否启用 Better Auth `requireEmailVerification=true`？
  - 背景：当前 false 是冒烟便利；上线前必须决策
  - 取舍：true = 合规性强（notes #1 信任感），false = 摩擦低（C 端冷启动友好）
  - 建议：B 端 true / C 端 false 分角色策略（通过 Better Auth hook 实现）

---

## v1.0-m3 上线前闭环

**判据**：Vercel production + Neon main + Inngest Cloud sync 三端就位；一份真实测试书稿完成端到端（从 L-01 登录 → L-03 上传 → L-07 三维度 → L-10 历史 → L-11 协议）；无 Sentry error 级告警。

### 交付清单

| 项 | 交付判据 | 预估 |
|----|---------|------|
| MAS-5 版本冻结 | frozen_at 写入后 T-01/T-02/T-03 触发器实战验证（契约测 → 真实数据）；report_snapshot 导出 Word（`docx` 库）+ CSV | 2d |
| MAS-6 保密闭环 | TTL 销毁 Inngest cron（每 10 min 扫 task.ttl_expires_at）+ Pino redact 生产配置（raw text 不落日志）+ Vercel Blob del 脚本 | 2d |
| 观测接入 | Sentry DSN + PII scrubber + /api/admin/health（Neon/Blob/Inngest 三连通性）+ audit_log 查询 API | 1-2d |
| MS-L-11 协议签署 | 签署弹窗 + user_agreement_acceptance append-only 写入（T-05 触发器兜底）+ 拒绝签署 → signOut | 0.5d |
| E2E smoke | Playwright 覆盖 L-01/02/03/07/10 五条主流程；CI 中运行 | 1d |
| 上线部署 | Vercel production 部署 + Neon main branch 迁移 + Inngest Cloud PUT /sync | 0.5d |

**m3 预估总工期**：7-9 工作日（约 2 周）

### m3 决策门

- **DG-m3.1（观测接入前）**：是否接入 Sentry？
  - 取舍：Sentry = 快速定位生产 bug + PII scrubber 复杂；自建日志 + 报警 = 零成本但看不到异常栈
  - 建议：v1.0 用 Sentry 免费层（5K events/month 够 beta 阶段）
- **DG-m3.2（上线前）**：public 还是 invite-only？
  - 背景：real.md 未规定；notes #1 提示信任建立需要缓释
  - 建议：invite-only 软启动 + B 端付费邀请码（同时验证付费意愿）

---

## 预估总工期

| 阶段 | 预估 | 累计工作日 | 累计周数 |
|------|------|----------|---------|
| m1 收尾 | 0.5-1d | 0.5-1d | <1 周 |
| m2 主流程 | 8-11d | 9-12d | 2-3 周 |
| m3 上线 | 7-9d | 16-21d | 4-5 周 |

**v1.0 上线预估**：4-5 周（工作日）。

---

## 盲区与已知风险

1. **单人开发节奏易塌**——路线图按工作日预估，默认全天投入；若实际每天只有 2h 有效时间，总工期乘 2。需要在 milestones.md 记录真实投入时间，以反推下次估算。
2. **Inngest 免费层配额在 MAS-1 中期大概率撞线**（DG-m2.1）——500 引用 × 每次 2 事件（verify + map） = 1000 事件/任务，月配额 50K 事件只够 50 次真实运行。决策门不能推迟。
3. **`origin/` 黄金集被当然视为测试基准**，但 MVP 是 Python 栈，prompt 在 TS 重译时可能产生结果漂移——要在 MAS-1 末期做对比回测（TS 版 vs origin/ 版对同一书稿输出的 diff），diff > 10% 需要 root cause。
4. **m3 的 E2E smoke 被放到最后**——这违背 TDD 精神。建议在 m2 末就跑一条登录 + 空任务的 smoke（0.5d 提前），不必等 m3。
5. **路线图本身会过时**——每完成一个 m 后必须重写 roadmap 的"当前位置"段 + 调整后续预估。不追平 = 路线图即垃圾。

---

## 使用约定

1. **更新节奏**：每完成一个 m（m1/m2/m3）必须重写本文件的"当前位置"段；每完成一个 MAS 调整对应行的百分比。
2. **决策门落盘**：每个 DG-m*.N 触发时，在此文件对应节下追加"DG-m2.1 决策：选 B，依据 ..."；不得在决策门略过。
3. **与 milestones.md 的同步**：每勾掉一条判据（✓→🟢），必须在 milestones.md 追加一条对应级别的条目（通常是 F 或 M）。
4. **不做什么**：
   - 不把路线图当任务看板（前瞻规划 vs 日常 TODO 是两回事——后者应该在 issue tracker / TaskCreate）
   - 不改历史（过期预估保留，另起订正段落；与 milestones.md 只追加原则一致）
   - 不把"规约说要做 X"当判据（判据必须可验证 = 命令/测试/可观察产物，不是"已讨论"）
