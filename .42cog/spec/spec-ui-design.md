---
name: spec-ui-design
description: 文史类引用校对软件 v1.0 UI 设计规约——三维度卡片、参考匹配中性措辞、协议弹窗 B/C 差异化、PARTIAL_MATCH 面板、SSE 进度流的组件规格、状态管理与交互模式
version: v1.0.0-draft
generated_by: design-ui-design skill
depends_on:
  - .42cog/meta/meta.md
  - .42cog/cog/cog.md
  - .42cog/real/real.md
  - .42cog/spec/spec-product-requirements.md
  - .42cog/spec/spec-user-story.md
  - .42cog/spec/spec-system-architecture.md
  - .42cog/spec/spec-database-design.md
  - notes/260417-engineering-and-ethics-notes.md
stack_lock:
  framework: Next.js 15 (App Router) + React 19
  styling: Tailwind CSS v4 (OKLCH via @theme inline)
  components: shadcn/ui + 12 本项目核心自定义组件
  forms: React Hook Form + Zod
  state_client: Zustand + localStorage (UI prefs only)
  state_server: TanStack Query (API/DB 数据)
  state_realtime: Inngest Realtime subscribe → SSE client
  icons: Lucide React
  fonts: 系统字体栈（无 Google Fonts）
created: 2026-04-19
---

# UI 设计规约（UI Design）

## 0. 读法

- **上游**：产品规约（12 affordance + 视觉契约清单）+ 用户故事规约（25 MS + B/C 差异化表）+ 架构规约（子系统 + 组件归属）+ 数据库设计规约（Drizzle 类型 → 组件 props）
- **本规约**：把 UI 落到**页面 / 组件 / 交互模式 / 状态 / 中性措辞 CI 规则 / B-C 皮肤**
- **下游**：`dev-coding` 起 Next.js 脚手架后按 §5 目录 + §7 组件清单展开；`dev-quality-assurance` 按 §11 交互验收清单写 E2E

---

## 1. Context：与 SKILL.md 默认流程的两处偏离

### 1.1 偏离 A：推迟项目初始化

**SKILL.md Phase 0** 要求先跑 `.42plugin/42edu/design-ui-design/scripts/init-project.sh` 创建 Next.js 脚手架。**本规约不执行该步**，理由：

1. 项目既有约定"**先规约后代码**"——meta / cog / real / product / user-story / system-architecture / database-design 全部为 `.42cog/spec/` 下的纯规约，`origin/` 之外无活码
2. `milestones.md` 计划里把"v1.0 UI 设计规约"列为交付物，脚手架创建属于 `dev-coding` 阶段
3. 本规约交付后，`dev-coding` 会一次性跑 `bun create next-app`，按 §5 目录结构 + §7 组件清单一次性就位——**避免现在起脚手架再改**

### 1.2 偏离 B：Mock 模式不走"localStorage 永久持久化"

**SKILL.md Core Principles** 强推 Zustand + localStorage 的"feature independence + 全 mock"心智。本规约调整为**两层 Mock 策略**：

| 层 | 用 Mock | 不用 Mock |
|---|--------|----------|
| **UI 原型层**（Storybook / 开发预览） | 按数据库规约 §4.2 类型生成 fixture；涵盖 8 种边缘态（MATCH / PARTIAL / NOT / NOT_FOUND / VARIANT / REJECTED / 低置信 / 含异体字） | — |
| **运行时** | 仅 UI 偏好（侧边栏折叠、主题、B/C 皮肤切换预览）用 Zustand + localStorage | 业务数据（task / quote / verification_result）走 TanStack Query + API；SSE 进度走 Inngest Realtime |

理由：本项目后端已完整规划（架构规约 + 数据库规约都 v1.0-draft 稳态），不存在"前端先跑、后端待接入"的空窗期；localStorage 持久化业务数据会与 real.md #3（TTL 销毁）和 real.md #7（版本冻结）冲突。

---

## 2. Intelligent Analysis

### 2.1 App Type：SPA

| 判定维度 | 本项目特征 | 判定 |
|---------|----------|-----|
| 核心交互 | SSE 实时进度 + 三维度卡片折叠/筛选 + 费用确认对话流 | 高频状态变化 |
| 用户任务 | 编辑在"工作台 → 任务 → 报告"之间穿梭，偶尔访问参考库/设置 | 连续流 |
| 导航需求 | 5 个主功能区 + 每个区的深度视图 | 多层级 |
| **结论** | **SPA**（App Router + 客户端状态） | — |

### 2.2 Navigation：侧边栏主导

**5 个主功能区**（侧边栏）：
1. 工作台（任务列表 + 最近书稿）— 落地页
2. 书稿（上传 + 解析状态）
3. 任务（进行中 + 已完成，筛选器丰富）
4. 报告（历史报告 + 对比 + 导出）
5. 参考库（上传/管理权威参考文献）

**顶部条**：LOGO + 全局搜索 + 通知（费用超额/TTL 临期） + 用户菜单
**右侧面板（可折叠）**：当前任务的 SSE 进度流 + 版本戳（始终可见，MS-L-09）

### 2.3 Color Scheme（OKLCH）

**设计决策**：避开"纯红/纯绿"的情绪化语义（real.md #4 异文 ≠ 错误；中性措辞原则）。主色取**深青**——介于科技感（AI）与古籍感（传统学术）之间。

| Token | OKLCH | 用途 |
|-------|-------|-----|
| `--color-primary` | `oklch(0.48 0.08 215)` | 主按钮、链接、活跃状态 |
| `--color-primary-fg` | `oklch(0.98 0 0)` | 主按钮文字 |
| `--color-accent-b` | `oklch(0.40 0.02 60)` | B 端皮肤强调色（暖灰，严肃） |
| `--color-accent-c` | `oklch(0.72 0.08 95)` | C 端皮肤强调色（浅橄榄，友好） |
| `--color-bg` | `oklch(0.99 0 0)` / dark `oklch(0.15 0 0)` | 页面背景 |
| `--color-card` | `oklch(1 0 0)` / dark `oklch(0.20 0 0)` | 卡片背景 |
| `--color-fg` | `oklch(0.15 0 0)` / dark `oklch(0.95 0 0)` | 主文字 |
| `--color-fg-muted` | `oklch(0.5 0.01 250)` | 辅文字 |
| `--color-border` | `oklch(0.90 0.005 250)` | 边框 |
| `--color-verdict-match` | `oklch(0.62 0.11 155)` | "符合参考"柔和绿（**非纯绿**） |
| `--color-verdict-partial` | `oklch(0.70 0.13 85)` | "部分命中"琥珀 |
| `--color-verdict-notmatch` | `oklch(0.55 0.03 250)` | "不符合"**冷灰蓝**（避免纯红暗示"错"） |
| `--color-verdict-notfound` | `oklch(0.60 0.02 280)` | "参考未涉及"中性紫灰 |
| `--color-verdict-variant` | `oklch(0.60 0.13 240)` | "版本异文"蓝（独立于 match/notmatch，real.md #4） |
| `--color-rejected` | `oklch(0.50 0 0)` | 审核拒绝深灰（配斜纹底纹） |
| `--color-warning` | `oklch(0.70 0.15 80)` | 费用超额、TTL 临期 |
| `--color-destructive` | `oklch(0.55 0.18 30)` | 删除、取消（仅用于破坏性动作，**不**用于 verdict） |

**B/C 皮肤切换**：CSS 变量层 override（见 §14）；不动组件。

---

## 3. Design System

### 3.1 Tailwind v4 Design Tokens（`app/globals.css`）

```css
@import "tailwindcss";

@theme inline {
  /* Spacing */
  --spacing-1: 0.25rem;
  --spacing-2: 0.5rem;
  --spacing-3: 0.75rem;
  --spacing-4: 1rem;
  --spacing-6: 1.5rem;
  --spacing-8: 2rem;
  --spacing-12: 3rem;

  /* Radius */
  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;

  /* Shadow */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.06);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.08);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);

  /* Font */
  --font-sans: ui-sans-serif, system-ui, -apple-system, "PingFang SC",
    "Microsoft YaHei", "Source Han Sans CN", sans-serif;
  --font-serif: ui-serif, Georgia, "Source Han Serif CN", "Noto Serif SC", serif;
  --font-mono: ui-monospace, "SF Mono", "JetBrains Mono", monospace;

  /* Colors (light) */
  --color-primary: oklch(0.48 0.08 215);
  --color-primary-fg: oklch(0.98 0 0);
  --color-bg: oklch(0.99 0 0);
  --color-card: oklch(1 0 0);
  --color-fg: oklch(0.15 0 0);
  --color-fg-muted: oklch(0.50 0.01 250);
  --color-border: oklch(0.90 0.005 250);

  --color-verdict-match: oklch(0.62 0.11 155);
  --color-verdict-partial: oklch(0.70 0.13 85);
  --color-verdict-notmatch: oklch(0.55 0.03 250);
  --color-verdict-notfound: oklch(0.60 0.02 280);
  --color-verdict-variant: oklch(0.60 0.13 240);
  --color-rejected: oklch(0.50 0 0);
  --color-warning: oklch(0.70 0.15 80);
  --color-destructive: oklch(0.55 0.18 30);

  --color-accent-b: oklch(0.40 0.02 60);
  --color-accent-c: oklch(0.72 0.08 95);
}

/* Dark mode overrides */
@media (prefers-color-scheme: dark) {
  @theme inline {
    --color-bg: oklch(0.15 0 0);
    --color-card: oklch(0.20 0 0);
    --color-fg: oklch(0.95 0 0);
    --color-border: oklch(0.30 0.005 250);
  }
}

/* B/C 皮肤 override（加在 <html data-skin="B"> 上） */
[data-skin="B"] {
  --color-accent: var(--color-accent-b);
  --font-body-weight: 500; /* B 端稍重，显严肃 */
}
[data-skin="C"] {
  --color-accent: var(--color-accent-c);
  --font-body-weight: 400;
}

/* 审核拒绝斜纹底纹（独立视觉皮肤，notes #1） */
.rejected-skin {
  background-image: repeating-linear-gradient(
    45deg,
    oklch(0.50 0 0 / 0.06),
    oklch(0.50 0 0 / 0.06) 4px,
    transparent 4px,
    transparent 8px
  );
}

/* VARIANT 异文高亮（独立于 NOT_MATCH，real.md #4） */
.variant-highlight {
  background-color: oklch(0.60 0.13 240 / 0.12);
  border-bottom: 2px dotted var(--color-verdict-variant);
}
```

### 3.2 Typography 层级

| 层级 | size / line-height / weight | 场景 |
|------|----------------------------|------|
| H1 | 2rem / 1.2 / 600 | 页面标题 |
| H2 | 1.5rem / 1.3 / 600 | 区块标题 |
| H3 | 1.25rem / 1.4 / 600 | 卡片标题、子章节 |
| Body | 0.9375rem / 1.6 / 400 | 正文 |
| Caption | 0.8125rem / 1.5 / 400 | 元信息（时间、id） |
| Quote | 1rem / 1.8 / 400 serif | 引文原文（强调可读） |
| Mono | 0.8125rem / 1.5 / 400 mono | 版本戳、display_id |

### 3.3 Iconography（Lucide React）

| 语义 | Icon | 不用什么 |
|------|------|---------|
| 任务 | `ListChecks` | — |
| 书稿 | `BookOpen` | `FileText`（太泛） |
| 参考文献 | `Library` | `Book`（与书稿冲突） |
| 引文 | `Quote` | — |
| 三维度之字词 | `Type` | — |
| 三维度之解释 | `BookMarked` | — |
| 三维度之上下文 | `AlignLeft` | — |
| 符合 | `CheckCircle2` | `Check`（太小） |
| 部分命中 | `CircleDotDashed` | — |
| 不符合 | `CircleMinus` | **不用** `XCircle`（带"错"暗示） |
| 未涉及 | `HelpCircle` | — |
| 异文 | `GitBranch` | — |
| 审核拒绝 | `ShieldOff` | **不用** `Ban`（冲突) |
| 成本警告 | `TriangleAlert` | — |
| TTL 临期 | `Clock` | — |
| 版本戳 | `Stamp` | — |

---

## 4. Page Layout

### 4.1 响应式断点

| Name | Width | Layout |
|------|-------|--------|
| Mobile | `< 640px` | 单列；侧边栏变抽屉；底部导航 5 项 |
| Tablet | `640-1024px` | 可折叠侧边栏；右侧 SSE 面板默认折叠 |
| Desktop | `> 1024px` | 完整三栏：侧边 + 主区 + 右侧 SSE 面板 |

### 4.2 主 Shell 结构

```
┌──────────────────────────────────────────────────────────────┐
│  Header: Logo │ SearchBar │ 🔔Notifications │ User + Skin[B/C]│
├──────────┬─────────────────────────────────────┬──────────────┤
│ Sidebar  │ Main (route outlet)                 │ SSE Panel    │
│          │                                     │ (collapsible)│
│ 工作台    │   /workbench                        │ Progress     │
│ 书稿      │   /manuscripts/[id]                 │ VersionStamp │
│ 任务      │   /tasks/[id]                       │ CostMeter    │
│ 报告      │   /reports/[id]                     │              │
│ 参考库    │   /references                       │              │
│          │   /settings                         │              │
│ ────     │                                     │              │
│ ⚙ 设置   │                                     │              │
│          │                                     │              │
└──────────┴─────────────────────────────────────┴──────────────┘
```

### 4.3 页面路由（对齐架构规约 §5 目录）

| 路由 | 页面 | 覆盖 MS |
|------|-----|--------|
| `/(auth)/login` | 登录 | MS-L-02 |
| `/(auth)/register` | 注册（选择 B/C 角色） | MS-L-01 |
| `/(main)/workbench` | 工作台 | MS-G-04 |
| `/(main)/manuscripts/new` | 上传书稿 | MS-L-03 |
| `/(main)/manuscripts/[id]` | 书稿详情 + 任务列表 | MS-L-03 |
| `/(main)/tasks/[id]` | 任务进行中（SSE 进度） | MS-L-06 |
| `/(main)/tasks/[id]/cost-confirm` | 费用二次确认 | MS-D-04 |
| `/(main)/reports/[id]` | 报告详情（三维度） | MS-L-07, MS-L-10 |
| `/(main)/reports/[id]/export` | 导出 Word/CSV | MS-L-12, MS-L-13 |
| `/(main)/reports/[id]/compare/[otherId]` | 新旧对比 | MS-G-03 |
| `/(main)/references` | 参考库管理 | MS-L-04, MS-G-01 |
| `/(main)/settings` | 设置（含销毁 TTL、协议历史） | MS-D-06, MS-L-11 |
| `/(main)/settings/agreements` | 协议历史 | MS-L-11, MS-G-05 |

---

## 5. 目录结构（UI 视角）

> 与架构规约 §5 一致；本节聚焦 UI 相关目录。

```
app/
├── (auth)/
│   ├── login/page.tsx
│   └── register/page.tsx
├── (main)/
│   ├── layout.tsx                   # Shell: Header + Sidebar + SSE panel
│   ├── workbench/page.tsx
│   ├── manuscripts/
│   │   ├── new/page.tsx
│   │   └── [id]/page.tsx
│   ├── tasks/
│   │   ├── [id]/page.tsx
│   │   └── [id]/cost-confirm/page.tsx
│   ├── reports/
│   │   ├── [id]/page.tsx
│   │   ├── [id]/export/page.tsx
│   │   └── [id]/compare/[otherId]/page.tsx
│   ├── references/page.tsx
│   └── settings/
│       ├── page.tsx
│       └── agreements/page.tsx
├── globals.css                       # §3.1 design tokens
└── layout.tsx                        # Root layout + skin provider

components/
├── ui/                               # shadcn/ui 基元（button/card/dialog/...）
├── quote-card/
│   ├── QuoteCard.tsx                 # 三维度卡片主组件
│   ├── VerdictChip.tsx               # 三维度独立 chip
│   ├── MatchStatusChip.tsx           # MATCH/PARTIAL/NOT/NOTFOUND chip
│   ├── ConfidenceBar.tsx             # 置信度条 + breakdown tooltip
│   ├── VariantHighlight.tsx          # 版本异文高亮
│   └── ModerationRejectedSkin.tsx    # 审核拒绝斜纹皮肤
├── reference-hit-panel/
│   ├── ReferenceHitPanel.tsx         # PARTIAL_MATCH 命中清单（默认 LIMIT 3）
│   └── ReferenceHitItem.tsx
├── progress-stream/
│   ├── ProgressStream.tsx            # SSE 客户端 + 断线重连
│   ├── TaskStatusBadge.tsx           # 10 状态 badge
│   └── ProgressTimeline.tsx
├── agreement-dialog/
│   ├── AgreementDialog.tsx           # B/C 差异化协议弹窗
│   ├── AgreementContentB.tsx         # B 端完整版文本
│   └── AgreementContentC.tsx         # C 端简化版文本
├── cost-confirm/
│   ├── CostEstimateCard.tsx          # 预估展示
│   └── CostPausedBanner.tsx          # 越界暂停横幅
├── version-stamp/
│   ├── VersionStampBadge.tsx         # 任务详情页的小角标
│   └── VersionStampCard.tsx          # 报告首页的完整卡片
├── shell/
│   ├── Sidebar.tsx
│   ├── Header.tsx
│   ├── SkinSwitcher.tsx              # B/C 皮肤切换（开发期可见）
│   └── SSEPanel.tsx
└── common/
    ├── EmptyState.tsx
    ├── ErrorBoundary.tsx
    ├── LoadingSkeleton.tsx
    └── NeutralTextGuard.tsx          # 中性措辞 CI 运行时守护（dev only）

lib/
├── stores/                           # Zustand（仅 UI 偏好）
│   ├── ui-prefs.ts
│   └── skin.ts
├── queries/                          # TanStack Query hooks（业务数据）
│   ├── use-tasks.ts
│   ├── use-task-results.ts
│   └── use-references.ts
├── realtime/
│   └── subscribe-task.ts             # Inngest Realtime 订阅封装
└── fixtures/                         # Mock fixture（Storybook/开发）
    ├── quotes.ts
    ├── verification-results.ts
    └── moderation.ts
```

---

## 6. 组件规格 — shadcn/ui 基元清单

以下 shadcn/ui 组件**全部使用**，不重造：

| 类别 | 组件 | 用途 |
|------|------|-----|
| **基础** | `Button`, `Badge`, `Card`, `Avatar`, `Separator` | 全局基元 |
| **表单** | `Input`, `Textarea`, `Select`, `Switch`, `Label`, `Checkbox`, `RadioGroup` | 登录/上传/设置 |
| **布局** | `Dialog`, `Sheet`, `ScrollArea`, `Tabs`, `Accordion` | 协议弹窗、参考命中展开、设置分栏 |
| **导航** | `DropdownMenu`, `NavigationMenu`, `Breadcrumb`, `Tooltip` | Header + 面包屑 |
| **数据** | `Table`, `DataTable`, `Pagination` | 报告列表、参考库 |
| **反馈** | `Skeleton`, `Progress`, `Sonner`, `Alert` | 骨架屏、SSE 进度、Toast |
| **表单+校验** | `Form`（RHF + Zod） | 所有表单 |

---

## 7. 核心自定义组件规格（12 个）

### 7.1 `<QuoteCard>` — 三维度卡片（核心组件）

**MS 归属**：MS-L-07（三维度独立报告呈现 + 参考匹配三态）
**产品规约硬约束**（§5.2）：**禁合并为一列或一行总分**；三栏并列独立 chip。

**Props 类型**（引用数据库规约 §4.2）：
```typescript
import type { VerificationResult, Quote, ResultReferenceHit } from '@/lib/db/types';

interface QuoteCardProps {
  quote: Pick<Quote, 'id' | 'displayId' | 'quoteText' | 'canonicalName' | 'locationHint' | 'kind'>;
  result: Pick<
    VerificationResult,
    | 'id'
    | 'matchStatus'
    | 'verdictTextAccuracy'
    | 'verdictInterpretation'
    | 'verdictContext'
    | 'confidence'
    | 'confidenceBreakdown'
    | 'moderationStatus'
  >;
  hits?: ResultReferenceHit[];         // 可选，PARTIAL_MATCH 时提供（默认 LIMIT 3）
  versionStamp?: { modelId: string; frozenAt: string }; // 角标
  onOpenHitPanel?: (resultId: string) => void; // lazy-load 详情（D5）
  onOpenVersionStamp?: () => void;
}
```

**视觉结构（Desktop）**：
```
┌──────────────────────────────────────────────────────┐
│ [📖 论语·学而] #20260419-001-quote-007          🕒 🔖 │  ← header: 归属 + id + versionStamp
├──────────────────────────────────────────────────────┤
│ 「学而时习之，不亦悦乎」                                │  ← 引文 serif + 1.8 line-height
│  ↳ 出自：《论语译注》杨伯峻 ch01                        │  ← locationHint
├──────────────────────────────────────────────────────┤
│ 字词   │ 解释      │ 上下文    │ 参考匹配           │  ← 四列独立 chip（三维度 + match）
│ ❓符合 │ ✅一致    │ ⚠部分    │ 🟠部分命中(2/3)    │
│        │           │           │   [展开命中清单 →] │  ← PARTIAL_MATCH 时的 CTA
├──────────────────────────────────────────────────────┤
│ AI 理由：字词与参考一致；解释与杨伯峻本一致；上下文与   │
│ 原章节略有偏离，建议复核"学"字释义的现代化口径。         │
├──────────────────────────────────────────────────────┤
│ [置信度 0.78]━━━━━━━━━ ℹ                             │  ← 悬停显示 breakdown
└──────────────────────────────────────────────────────┘
```

**状态变体**（必须全部实现，E2E 必测）：

| 状态 | 视觉 |
|------|-----|
| 全 MATCH | 主色边框 + 柔和绿 chip |
| PARTIAL_MATCH | 琥珀边框 + "[展开命中清单]" CTA |
| NOT_MATCH | 冷灰蓝 chip + 无情绪化配色（不红！） |
| NOT_FOUND_IN_REF | 中性紫灰 chip + "参考文献未涉及此引文" |
| VARIANT（字词异文） | 蓝色 `.variant-highlight` 底纹 + "版本异文" chip + tooltip "与杨伯峻本一致，与朱熹本不一致" |
| REJECTED_BY_MODERATION | `.rejected-skin` 斜纹 + ShieldOff 图标 + "审核未通过，无法校对" + 整卡暗淡到 60% 不透明度 + 禁用所有交互（MS-D-02 AC2） |
| 低置信（<0.6） | ConfidenceBar 变琥珀色 + "建议复核" 胶囊 |

**禁忌（运行时 + CI 双守）**：
- ❌ 不得在任何位置合并三维度为"综合评分"或"总分 N/10"（产品规约 N06）
- ❌ 文案中不得出现"错误 / 有误 / 误引 / 错引 / 错别字"（A07 中性措辞；`NeutralTextGuard` dev 时 throw）
- ❌ NOT_MATCH 不得用红色（现用冷灰蓝）
- ❌ 无 versionStamp 不得渲染（强制传入）

### 7.2 `<VerdictChip>` — 三维度独立 chip

```typescript
type VerdictDim = 'textAccuracy' | 'interpretation' | 'context';
interface VerdictChipProps {
  dimension: VerdictDim;
  verdict: string;  // 由数据库规约 §8.3 verifyQuoteOutputSchema 定义的枚举
  explanation?: string; // tooltip
}
```

**文案映射表**（**唯一真源**——lib/i18n/verdict-labels.ts）：

| Dimension | Verdict | Label（UI 显示） | Chip 色 | 图标 |
|-----------|---------|-----------------|--------|-----|
| textAccuracy | MATCH | 符合参考 | match | CheckCircle2 |
| textAccuracy | VARIANT | 版本异文 | variant | GitBranch |
| textAccuracy | MISMATCH | 不符合参考 | notmatch | CircleMinus |
| textAccuracy | NOT_FOUND_IN_REF | 参考未涉及 | notfound | HelpCircle |
| interpretation | CONSISTENT | 解释一致 | match | CheckCircle2 |
| interpretation | PARTIAL | 解释部分一致 | partial | CircleDotDashed |
| interpretation | DIVERGENT | 解释偏离 | notmatch | CircleMinus |
| interpretation | NOT_APPLICABLE | 不适用 | notfound | HelpCircle |
| context | APPROPRIATE | 上下文得当 | match | CheckCircle2 |
| context | AMBIGUOUS | 上下文存疑 | partial | CircleDotDashed |
| context | OUT_OF_CONTEXT | 上下文偏离 | notmatch | CircleMinus |
| context | NOT_APPLICABLE | 不适用 | notfound | HelpCircle |

### 7.3 `<MatchStatusChip>` — 参考匹配三态

```typescript
interface MatchStatusChipProps {
  status: 'MATCH' | 'PARTIAL_MATCH' | 'NOT_MATCH' | 'NOT_FOUND_IN_REF';
  hitCount?: { matched: number; total: number }; // PARTIAL 时显示 2/3
}
```

| Status | Label | Chip 色 |
|--------|-------|---------|
| MATCH | 符合参考 | match |
| PARTIAL_MATCH | 部分命中 (X/Y) | partial |
| NOT_MATCH | 未在参考中匹配 | notmatch |
| NOT_FOUND_IN_REF | 参考文献未涉及 | notfound |

### 7.4 `<ReferenceHitPanel>` — PARTIAL_MATCH 命中面板

**MS 归属**：MS-L-07 + 架构规约 ADR-011 + 数据库规约 D5
**D5 硬约束**：默认 LIMIT 3；展开后 lazy-load 全量；禁止一次性加载所有 hits。

```typescript
interface ReferenceHitPanelProps {
  resultId: string;
  preloadHits?: ResultReferenceHit[];  // 前 3 条（hit=true，从 query 预取）
  totalHits: number;                   // 全量数（后端聚合返回）
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}
```

**视觉**：使用 `Sheet`（右侧抽屉，Desktop）/ `Dialog`（Mobile）；分栏显示 `(referenceDisplayId, versionLabel, hit, snippet, similarity, location)`；每项带 `<CopyLocationButton>` 快速复制章节段落定位。

**懒加载行为**：
1. 首次打开用 `preloadHits` 渲染
2. 若 `totalHits > 3`，底部按钮"加载剩余 N 条"触发 query `useReferenceHits(resultId, { offset: 3 })`
3. loading 时 `Skeleton` 占位

### 7.5 `<ProgressStream>` — SSE 实时进度流

**MS 归属**：MS-L-06
**架构依赖**：ADR-009（Inngest Realtime 桥接 SSE）

```typescript
interface ProgressStreamProps {
  taskId: string;
  initialTask: Task;  // 首屏 SSR 数据
}
```

**内部用 `EventSource` 连 `/api/tasks/[id]/stream`**：
- 事件类型：`task.status_changed` / `task.quote_verified` / `task.cost_warning` / `task.moderation_rejected` / `task.completed` / `task.failed`
- 重连策略：指数退避（1s / 2s / 4s / 8s），最多 10 次
- 断线横幅：`Alert variant="warning"` "连接中断，正在重连..." + 手动重连按钮
- 完成后自动升级为 `TaskStatus="COMPLETED"` + Sonner toast
- 审核拒绝：独立事件路径，UI 走 `ModerationRejectedSkin`（不走普通 FAILED 路径，notes #1）

### 7.6 `<TaskStatusBadge>` — 10 状态 badge

```typescript
interface TaskStatusBadgeProps {
  status: TaskStatus;  // 数据库规约 §4.1 TASK_STATUS_VALUES
}
```

| Status | Label | 配色 |
|--------|-------|-----|
| PENDING_PARSE | 解析待开始 | fg-muted |
| PARSING | 解析中 | primary（脉动） |
| PENDING_ESTIMATE | 估算中 | primary |
| AWAITING_CONFIRM | 待确认费用 | warning |
| VERIFYING | 校对中 | primary（脉动） |
| PAUSED_COST | 暂停（成本超额） | warning |
| REJECTED_BY_MODERATION | 审核未通过 | rejected |
| COMPLETED | 已完成 | match |
| FAILED | 失败 | destructive |
| CANCELED | 已取消 | fg-muted |

### 7.7 `<AgreementDialog>` — 协议弹窗（B/C 差异化）

**MS 归属**：MS-L-11, MS-G-05
**产品规约 MAS-6 硬约束**：B 端**必须**全屏 Dialog（不可 Sheet，不可关闭）；C 端可 Sheet（可勾选"下次不再提示"但协议本身必勾选）。

```typescript
interface AgreementDialogProps {
  role: 'B' | 'C';
  currentVersion: string;
  userAcceptedVersion?: string;  // undefined = 从未接受；不等 = 版本更新需重签
  onAccept: (checksum: string) => Promise<void>;
}
```

**版本 diff 行为**：
- `userAcceptedVersion === undefined`：首次弹窗（MS-L-11）
- `userAcceptedVersion !== currentVersion`：重签弹窗（MS-G-05），顶部红色 banner "协议已更新，请重新确认"
- `userAcceptedVersion === currentVersion`：不弹

**B 端必含内容**（不得省略任何一项）：
- TTL 销毁机制（默认 7 天，可协议约定）
- 数据流向（硅基流动 DeepSeek API）
- 不用于训练声明
- 日志脱敏承诺（notes #2）
- 审计追踪告知（notes #6）
- 用户上传内容版权责任（real.md #5）
- 机构席位授权范围

**C 端简化版**：保留"TTL 销毁 / 数据流向 / 不用于训练"三条核心，其余折叠到"查看完整条款"链接。

### 7.8 `<CostEstimateCard>` + `<CostPausedBanner>`

**MS 归属**：MS-D-04（成本透明 + 二次确认 + 越界暂停）
**real.md #6 硬约束**：预估 > 阈值（¥50）必二次确认；运行中 > 1.5× 必暂停。

```typescript
interface CostEstimateCardProps {
  estimatedCents: number;
  ceilingCents: number;      // 1.5× 预估
  breakdown: { tokens: number; quotes: number; model: string };
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

interface CostPausedBannerProps {
  taskId: string;
  currentCostCents: number;
  ceilingCents: number;
  onResume: () => Promise<void>;
  onCancel: () => Promise<void>;
}
```

**视觉约束**：
- 预估 > ¥50 时数字放大 1.5×，红底警示条
- 越界暂停 banner 占满主区顶部，不可忽略（MAS-4）
- "继续"按钮需二次输入确认（type "确认继续" → enable）

### 7.9 `<VersionStampBadge>` + `<VersionStampCard>`

**MS 归属**：MS-L-09（版本冻结）、MS-L-12 AC1（Word 首页版本戳卡片）
**real.md #7 硬约束**：每份报告都要显示 modelId + promptVersions + sourceRefsHash + algoVersion + frozenAt

```typescript
interface VersionStampProps {
  stamp: Task['versionStamp'];  // 数据库规约 §4.1 jsonb 类型
  variant: 'badge' | 'card';    // badge=角标；card=报告首页完整卡
}
```

**Badge 视觉**：`Stamp` 图标 + mono 字体截断 "v1·ds-v3.2·2026-04-19"；hover 展开 Tooltip 显示全量。
**Card 视觉**：6 字段分行显示 + 复制按钮 + "此报告已冻结，不可修改"声明。

### 7.10 `<ConfidenceBar>` + breakdown tooltip

**real.md #2 硬约束**：置信度**不得由 AI 自评**，来自客观三信号（refHit / locationValid / crossModel）。

```typescript
interface ConfidenceBarProps {
  confidence: number;  // 0-1
  breakdown: VerificationResult['confidenceBreakdown'];
}
```

**视觉**：进度条 + Tooltip 显示 breakdown 三条 + 算法版本角标（`v1.0`）；<0.6 自动变琥珀 + 显示 "建议复核"。

### 7.11 `<VariantHighlight>` — 版本异文高亮

**real.md #4 硬约束**：异文 ≠ 错误；独立视觉语言。

```typescript
interface VariantHighlightProps {
  text: string;
  variants: Array<{ referenceId: string; versionLabel: string; matchedText: string }>;
}
```

**视觉**：原文用 `.variant-highlight` 类（蓝底 + 蓝虚线下划线）；hover tooltip 显示"与《XX 本》一致，与《YY 本》不一致"；**决不使用红色下划线**（red squiggly = typo 暗示）。

### 7.12 `<ModerationRejectedSkin>` — 审核拒绝皮肤

**notes #1 硬约束**：审核拒绝语义**独立**于"校对失败/未找到"。

```typescript
interface ModerationRejectedSkinProps {
  rejectedAt: Date;
  reason?: string;
  children: React.ReactNode;  // 包裹原 QuoteCard
}
```

**视觉**：
- 整卡覆盖 `.rejected-skin` 斜纹
- 右上 `ShieldOff` icon + "审核未通过" 灰 chip
- 卡片不透明度 60%（仍可读，强调"无法校对"而非"删除"）
- 底部显式说明："内容因第三方模型审核政策未能校对，不代表引用有误"
- **禁用**所有交互按钮（置信度条、参考命中面板、重试按钮）
- 导出 CSV/Word 时此条目独立列显示 `审核状态=REJECTED_BY_MODERATION`（MS-L-13 AC5）

---

## 8. State Management

### 8.1 分层原则

| 层 | 方案 | 存什么 |
|---|------|-------|
| **服务器状态**（业务数据） | TanStack Query | task / manuscript / quote / verification_result / reference / report_snapshot |
| **实时推送** | EventSource → 事件分发 → TanStack Query invalidate | SSE 事件 |
| **客户端 UI 偏好** | Zustand + localStorage persist | 侧边栏折叠、主题、B/C 皮肤预览、最近选中的参考集、SSE 面板展开 |
| **临时表单草稿** | React Hook Form state + Zustand | 上传书稿的元信息草稿（刷新保留） |
| **不存** | — | 认证 token（Better Auth cookie 管）；任何原文片段（real.md #3 + notes #2） |

### 8.2 Zustand Store 清单

#### `lib/stores/ui-prefs.ts`
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIPrefs {
  sidebarCollapsed: boolean;
  ssePanelOpen: boolean;
  theme: 'light' | 'dark' | 'system';
  recentReferenceIds: string[]; // 最近选中的 10 个，提升选择效率
  toggleSidebar: () => void;
  toggleSSEPanel: () => void;
  setTheme: (t: UIPrefs['theme']) => void;
  pushRecentReference: (id: string) => void;
}

export const useUIPrefs = create<UIPrefs>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      ssePanelOpen: true,
      theme: 'system',
      recentReferenceIds: [],
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      toggleSSEPanel: () => set((s) => ({ ssePanelOpen: !s.ssePanelOpen })),
      setTheme: (theme) => set({ theme }),
      pushRecentReference: (id) =>
        set((s) => ({
          recentReferenceIds: [id, ...s.recentReferenceIds.filter((x) => x !== id)].slice(0, 10),
        })),
    }),
    { name: 'quote-check-ui-prefs' },
  ),
);
```

#### `lib/stores/skin.ts`
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SkinState {
  skin: 'B' | 'C';       // 由 user.role 初始化；开发期可覆盖
  setSkin: (s: 'B' | 'C') => void;
}

export const useSkin = create<SkinState>()(
  persist(
    (set) => ({ skin: 'C', setSkin: (skin) => set({ skin }) }),
    { name: 'quote-check-skin' },
  ),
);
```

**禁止 Zustand 存的内容清单**：
- ❌ 业务实体：`tasks` / `quotes` / `verification_results` / `references`（走 TanStack Query）
- ❌ 原文片段、引文正文、参考文献内容（TTL 销毁 + 脱敏）
- ❌ 认证 token、密码、API key
- ❌ 任何 `raw_response_snapshot` 数据

### 8.3 TanStack Query Hooks 清单

```typescript
// lib/queries/use-tasks.ts
export function useTasks(filters: TaskFilters) { /* ... */ }
export function useTask(id: string) { /* ... */ }
export function useTaskResults(id: string, { matchStatus?, minConfidence? }) { /* ... */ }

// lib/queries/use-references.ts
export function useReferences() { /* ... */ }
export function useReference(id: string) { /* ... */ }

// lib/queries/use-report.ts
export function useReportSnapshot(taskId: string) { /* ... */ }
export function useReportCompare(taskIdA: string, taskIdB: string) { /* ... */ }

// lib/realtime/subscribe-task.ts
export function useSubscribeTaskProgress(taskId: string) {
  // EventSource + invalidate relevant queries on events
}
```

---

## 9. Feature Independence（本项目边界）

SKILL.md 强推"每个 feature 无依赖独立可用"。本项目对此的**定制**：

| 类型 | 独立可用 | 有依赖（允许） |
|------|--------|--------------|
| 查看工作台（空状态） | ✅ | — |
| 上传书稿 | ✅ | 需先接受协议（MS-L-11） |
| 发起任务 | ❌ | 依赖书稿 + 参考（cog.md 关系） |
| 查看历史报告 | ✅ | — |
| 参考库管理 | ✅ | — |
| **DEMO 模式**（在线预览环境） | Mock 数据驱动 QuoteCard / ReferenceHitPanel / VersionStampCard；用 fixtures（§10）；页面顶部 banner `🎭 Demo Mode，所有数据为示例` | — |

**Demo 模式开关**：通过 env `NEXT_PUBLIC_DEMO_MODE=1` 启用；默认关闭；不进生产。

---

## 10. Mock Data（对齐数据库规约 §4.2 类型）

### 10.1 `lib/fixtures/quotes.ts` — 8 种典型引文

必须覆盖的边缘态（与 §7.1 QuoteCard 状态变体一一对应）：

```typescript
import type { Quote, VerificationResult, ResultReferenceHit } from '@/lib/db/types';

export const MOCK_QUOTES: Array<{
  quote: Quote;
  result: VerificationResult;
  hits: ResultReferenceHit[];
}> = [
  // 1. 全 MATCH 健康态
  { /* 《论语·学而》"学而时习之" - 三维度 MATCH */ },
  // 2. PARTIAL_MATCH 多参考命中
  { /* 《道德经》引文，命中 2/3 份参考 */ },
  // 3. NOT_MATCH（冷灰蓝，非红）
  { /* 字词不符 */ },
  // 4. NOT_FOUND_IN_REF
  { /* 参考文献未涉及 */ },
  // 5. VARIANT（版本异文，real.md #4）
  { /* "悦"vs"說"——与杨伯峻本一致，与朱熹本不一致 */ },
  // 6. REJECTED_BY_MODERATION（notes #1）
  { /* 审核拒绝，独立皮肤 */ },
  // 7. 低置信（confidence < 0.6）
  { /* confidence = 0.52，breakdown refHit=0.8 locationValid=0.4 */ },
  // 8. 含异体字/繁简（notes #3）
  { /* 含"髪/发"异体字 → normalize 后匹配 MATCH */ },
];
```

### 10.2 `lib/fixtures/verification-results.ts`

每条 result 必须有完整的：
- `verdictTextAccuracy` + `verdictInterpretation` + `verdictContext`（三 jsonb）
- `matchStatus` + `confidence` + `confidenceBreakdown`
- `moderationStatus`（含 `OK` / `REJECTED_BY_MODERATION` / `FAILED_UPSTREAM` 三种示例）
- `idempotencyKey`（展示用，形如 `task-uuid_quote-uuid_1`）

### 10.3 `lib/fixtures/moderation.ts` — 审核拒绝 fixture

按 MS-D-02 AC2 的要求：`is_moderation_rejection()` 信号齐全的 mock 响应，供开发期测试拒绝路径 UI。

### 10.4 LLM 响应生成器（Demo Mode）

```typescript
// lib/fixtures/llm-responder.ts
export function generateMockVerifyResponse(quote: Quote): VerificationResult {
  // 按引文内容关键词伪判：
  //   含"学而时习之" → 全 MATCH
  //   含"悦/說" → VARIANT
  //   含某敏感词 → REJECTED_BY_MODERATION
  //   其他 → 随机挑 8 种边缘态之一
}
```

---

## 11. Core Features 清单（按 MS）

### P0 必做（CS-01 核心价值流 + CS-06 保密闭环）

| MS | 页面 | 组件 |
|----|------|------|
| MS-L-01 注册 | `/(auth)/register` | Form + 角色选择 RadioGroup（B/C） |
| MS-L-02 登录 | `/(auth)/login` | Form |
| MS-L-03 上传 | `/(main)/manuscripts/new` | 上传组件（react-dropzone）+ 解析状态 Progress |
| MS-L-04 参考库 | `/(main)/references` | `DataTable` + 上传 + 版权声明 Checkbox |
| MS-L-05 发起任务 | `/(main)/manuscripts/[id]` | `CostEstimateCard` → 确认 → 跳转 task |
| MS-L-06 SSE | `/(main)/tasks/[id]` | `<ProgressStream>` + `<TaskStatusBadge>` |
| MS-L-07 三维度报告 | `/(main)/reports/[id]` | `<QuoteCard>` 列表 + 筛选 |
| MS-L-11 协议弹窗 | shell 层拦截 | `<AgreementDialog>` |
| MS-L-12 Word 导出 | `/(main)/reports/[id]/export` | 前端只触发下载；生成走 `app/api/reports/[id]/export/word` |
| MS-L-13 CSV 导出 | 同上 | 同上 |
| MS-D-02 审核拒绝 | 任务/报告均显示 | `<ModerationRejectedSkin>` |
| MS-D-04 费用透明 | 任务详情 | `<CostEstimateCard>` + `<CostPausedBanner>` |
| MS-D-06 TTL | `/(main)/settings` | 任务列表带倒计时 `Clock` |

### P1 次优先（CS-02 至 CS-05）

| MS | 页面 | 组件 |
|----|------|------|
| MS-L-08 失败重试 | 报告详情 | "重试 N 条失败"按钮（仅对 API_ERROR） |
| MS-L-09 版本戳 | 所有报告页 | `<VersionStampBadge>` + `<VersionStampCard>` |
| MS-L-10 历史报告 | 工作台 | `<DataTable>` 历史列表 |
| MS-D-03 限流重试 | SSE 事件 | Sonner toast "触发限流，N 秒后重试" |
| MS-D-05 书名别名 | 上传/提取阶段 | 自动归一（透明于 UI） |
| MS-G-01 参考库管理 | `/(main)/references` | CRUD + 删除前依赖检查（§9.5 DB 查询） |
| MS-G-02 任务暂停 | 任务详情 | `<CostPausedBanner>` |
| MS-G-03 新旧对比 | `/reports/[id]/compare/[otherId]` | 双栏 `<QuoteCard>` diff |
| MS-G-04 历史列表 | 工作台 | 多维度筛选 |
| MS-G-05 协议重签 | shell 层 | `<AgreementDialog>` 重签流 |

---

## 12. 交互模式（Loading / Empty / Error / Edge）

### 12.1 Loading

| 场景 | 方案 |
|------|-----|
| 页面骨架 | `Skeleton` 按目标布局填充 |
| 表格加载 | 行级 `Skeleton` |
| 按钮加载 | `Button` `disabled` + `Loader2` 旋转 icon |
| SSE 连接中 | `Alert` "正在连接进度流..." |
| 长任务 | `Progress` + 预估剩余时间（由 SSE 事件累计） |

### 12.2 Empty

| 场景 | 文案 | 主 CTA |
|------|-----|-------|
| 未上传书稿 | "还没有书稿。开始第一次校对" | "上传书稿" → `/manuscripts/new` |
| 未上传参考 | "还需要一份权威参考作为校对绳尺" | "上传参考" → `/references` |
| 无历史报告 | "完成第一次任务后在此查看" | — |
| 报告无结果 | "此任务未产出可展示结果" | 查看原任务 |

### 12.3 Error

| 场景 | UI |
|------|----|
| 表单校验错 | 字段下方红字（依 Zod message） |
| 网络错 | `Sonner` toast + 重试按钮 |
| 服务器 500 | 页面 `ErrorBoundary` fallback + 日志 id（可供客服） |
| 任务 FAILED | 报告页 banner + 重试按钮（仅适用 `API_ERROR` 子状态） |
| 任务 REJECTED_BY_MODERATION | **不是** error——走独立 UI（§7.12） |
| SSE 断线 | 顶部 banner "连接中断，N 秒后重连" |

### 12.4 Edge Case

| 场景 | 方案 |
|------|-----|
| 书稿 >20MB | 上传前校验 + 友好提示（数据库规约 §8.1） |
| 任务 TTL 已到期 | 报告仍可查（冻结快照），但 "原始书稿已按协议销毁" banner |
| 参考被删除后查历史报告 | 显示 "参考文献已删除"（按 §9.5 D2 盲区） |
| 冷归档数据展示（task.completed_at >90d） | UNION 归档表查询；UI 显示 "历史归档" chip（数据库规约 D5✓） |
| Demo Mode | 页面顶部固定 banner `🎭 Demo Mode`；禁用真实上传 |

---

## 13. Accessibility（WCAG 2.1 AA + 中文可读性）

### 13.1 WCAG 检查项

- [ ] 颜色对比度 ≥ 4.5:1（正文） / ≥ 3:1（大字/图标）—— OKLCH token 均已校准
- [ ] 所有交互元素可键盘到达（Tab 顺序合理）
- [ ] 焦点可见（`:focus-visible` 2px primary 描边）
- [ ] Form label 与 input `for`/`id` 绑定
- [ ] Dialog 有 `aria-labelledby` + focus trap
- [ ] SSE 进度更新用 `aria-live="polite"`
- [ ] 错误消息用 `aria-live="assertive"` + role="alert"
- [ ] 图标单独使用时补 `aria-label`

### 13.2 中文可读性

- 字体：系统栈（避免 Google Fonts，中国大陆不可用）
- 行高：1.6（正文）/ 1.8（引文）
- 字号最小 14px（caption 13px 上限）
- 繁体/异体字原文展示用原字符（notes #3）；normalize 仅用于匹配
- 文言文引用用 `<blockquote>` + serif 字体

### 13.3 色盲可达性

verdict chip **不依赖颜色单独传达**——每个 chip 带图标 + 文字。色盲用户通过图标 + 文字仍可识别。

---

## 14. B/C 皮肤差异化（独立小节）

**设计决策回顾**（对齐产品规约 §5.3）：同一 affordance 集合，差异化交互皮肤，**不**分裂为两个产品。

### 14.1 差异化清单

| 维度 | C 端皮肤 | B 端皮肤 |
|------|---------|---------|
| 强调色 | 浅橄榄 oklch(0.72 0.08 95) | 暖灰 oklch(0.40 0.02 60) |
| 字重 | 400 | 500（略重，显严肃） |
| LOGO 副标 | "个人校对工作台" | "机构质检工作台" |
| 协议弹窗 | 简化版 + 可折叠 | 完整版 + 不可关闭 + 滚动到底才 enable "同意" |
| 费用显示 | ¥ 金额（一位小数） | ¥ 金额 + 本席位本月累计 |
| 审计入口 | 不显示 | 侧边栏多一项 "审计日志" |
| 任务列表 | 按时间排序 | 多维度筛选 + 导出 CSV（合规报表） |
| 导出 Word | 带个人署名行 | 带机构印章位 + 审核人空行 |
| TTL 设置 | 固定 7 天 | 可在协议范围内调整（3-30 天） |

### 14.2 切换机制

- 注册时 `user.role` 落盘（`userRoleEnum: B | C | admin`），不可自主切换
- 开发期：`<SkinSwitcher>`（仅 dev 环境可见）允许预览两套皮肤
- Admin 用户：可临时切换查看 B/C 版（用于客户支持）

### 14.3 皮肤无关的"硬规则"（任何皮肤都不可违反）

- 三维度禁综合总分
- 中性措辞禁"错误/有误/误引"
- 审核拒绝独立状态
- 版本戳全页可见
- real.md 7 条 + notes 7 条全部适用

---

## 15. 扩展点（向 dev-coding 交接）

| 扩展点 | 当前 | dev-coding 要做什么 |
|--------|-----|---------------------|
| 项目脚手架 | 未起 | `bun create next-app` + shadcn/ui init + Tailwind v4 + 按 §5 目录创建空文件 |
| 组件源 | 本规约 §7 定义 props | 按规格实现 12 个自定义组件 + Storybook（可选） |
| Fixture | §10 清单 | 按清单生成 8-10 条 mock 数据（对齐数据库规约 §4.2 类型） |
| Zustand stores | §8.2 代码框架 | 直接 copy |
| TanStack Query hooks | §8.3 清单 | 按 API Route Handler（架构规约 §6）对接 |
| SSE 客户端 | §7.5 约束 | 实现 `subscribe-task.ts`（Inngest Realtime → EventSource → query invalidate） |
| 中性措辞 CI | `<NeutralTextGuard>` 运行时 + eslint 自定义规则 `no-accusatory-language` | 配 eslint rule；grep CI 见 §16 |

---

## 16. 质量检查清单

### 设计决策（SKILL Phase 1）
- [x] App type 判定（SPA）+ 理由
- [x] Navigation 结构（Sidebar + Top + SSE Panel）+ 理由
- [x] OKLCH 色系定义（含 verdict 六色 + B/C accent）

### Feature Independence
- [x] Demo Mode 用 fixture 可完整预览 UI（§9 + §10）
- [x] Mock 模式与真实数据边界明确——业务数据走 TanStack Query，不进 Zustand
- [x] Mock Mode 可视指示（顶部 banner）

### Rich Mock Data
- [x] 8 种引文边缘态覆盖（§10.1）
- [x] verification_results fixture 覆盖三维度 × match_status × moderation（§10.2）
- [x] 审核拒绝 fixture 独立（§10.3）
- [x] LLM mock 响应生成器（§10.4）

### 实现规格
- [x] 12 个核心自定义组件全部定义 props（§7）
- [x] 组件 props 类型全部引用数据库规约 §4.2 `Task` / `Quote` / `VerificationResult` 等
- [x] 所有 Form 用 RHF + Zod；Zod schema 在数据库规约 §8
- [x] P0 MS 全部对应页面 + 组件（§11）

### 本项目硬红线
- [x] 三维度**禁综合总分**（§7.1 禁忌清单 + `<QuoteCard>` 不接受 `totalScore` prop）
- [x] verdict **中性措辞**唯一真源 `lib/i18n/verdict-labels.ts`（§7.2）
- [x] 审核拒绝**独立皮肤** `<ModerationRejectedSkin>`（§7.12）
- [x] 异文**独立视觉** `<VariantHighlight>` 蓝色（§7.11，real.md #4）
- [x] 置信度**三信号 breakdown** + algoVersion 角标（§7.10，real.md #2）
- [x] 版本戳**全页可见** `<VersionStampBadge>`（§7.9，real.md #7）
- [x] 费用**二次确认** + 越界暂停 banner（§7.8，real.md #6）
- [x] 协议弹窗 **B/C 差异化**（§7.7 + §14）

### Accessibility
- [x] WCAG 2.1 AA 检查项（§13.1）
- [x] 中文可读性（§13.2）
- [x] 色盲可达（chip 带图标 + 文字，§13.3）

### CI / 守护规则
- [x] eslint 自定义规则 `no-accusatory-language`（禁"错误/有误/误引"）—— 配置见附录 B
- [x] 组件渲染期 `<NeutralTextGuard>`（dev mode throw）
- [x] Storybook 所有 QuoteCard 状态变体都有 story，视觉回归走 Chromatic 或 Playwright screenshot

---

## 17. 盲区清单（本规约新识别）

除继承架构规约 10 条 + 数据库规约 8 条盲区外，本规约新披露：

| # | 盲区 | 对应 |
|---|------|-----|
| U1 | **OKLCH 浏览器兼容性**：Safari 15.4+ / Chrome 111+ 才支持 `oklch()`；低版本浏览器 fallback 需 `@supports not (color: oklch(0 0 0))` 的 hex 兜底。v1.0 受众偏文史（设备更新慢），需评估是否强制升级提示 | §3.1 |
| U2 | **中文全文搜索的前端高亮**：`<VariantHighlight>` 依赖后端返回的 `matchedText` 偏移量；但中文分词 + 繁简异体字混排会导致 offset 与原文不对齐；需要约定 offset 规则（规范化前还是后？）| §7.11 + 数据库规约 ADR-014 |
| U3 | **SSE EventSource 在 Safari 的自动重连 bug**：Safari 会在某些网络中断时不触发 `error` 事件；需手动 heartbeat（每 30s 一次空 comment） | §7.5 |
| U4 | **协议弹窗重签的用户心理压力**：MS-G-05 协议版本升级后强制重签，B 端每月一次不算频繁，但若产品活跃迭代（月度 2+ 次），用户会疲劳；建议协议 minor 版本更新只显示 banner，不阻断 | §7.7 |
| U5 | **Demo Mode 与真实数据混淆**：开发期 fixture 可能误入生产快照（如 E2E 截图作为营销素材）——需在 fixture 数据里硬编码"示例"水印（如 canonicalName = "论语（示例）"）| §10 |
| U6 | **B/C 皮肤切换期数据一致性**：Admin 切换预览 B 皮肤时，如果正在查看自己的 C 端任务，权限仍是 C；UI 显示可能误导其"拥有 B 端权限"。SkinSwitcher 需强制"预览模式"水印 | §14.2 |
| U7 | **`<QuoteCard>` 长列表虚拟滚动**：一本书稿 500+ 引文同时渲染性能瓶颈；需 `@tanstack/react-virtual` 或类似；首屏可见区渲染，其余懒加载 | §7.1 + §11 |
| U8 | **移动端三维度卡片折叠策略未定**：桌面四列并排 OK，移动端怎么排？纵向堆叠会很长；tabs 会隐藏信息。建议：移动端三维度缩为一行图标 + 展开详情，但需用户测试验证 | §7.1 + §4.1 |
| U9 | **verdict label 的国际化**：当前 labels 都是中文硬编码；如果未来要做英文版（海外汉学市场），需 i18n——但 verdict 枚举同时做了翻译双语对照不在本次范围 | §7.2 |
| U10 | **版本戳 Tooltip 的移动端替代**：移动端无 hover，`<VersionStampBadge>` 的 tooltip 要降级为 Popover/Sheet；默认 tap 展开可能影响滚动 | §7.9 |

---

## 18. 交付物 + 下游

### 18.1 本规约交付物

| 产物 | 位置 | 状态 |
|------|-----|------|
| **本规约文件** | `.42cog/spec/spec-ui-design.md` | ✅ 本次交付 |
| **Tailwind v4 tokens CSS** | §3.1（规约内代码块） | ⏳ `dev-coding` 阶段 copy 到 `app/globals.css` |
| **Zustand stores** | §8.2（规约内代码块） | ⏳ copy 到 `lib/stores/` |
| **verdict 标签映射** | §7.2 表 | ⏳ 生成 `lib/i18n/verdict-labels.ts` 常量文件 |
| **12 自定义组件 props** | §7（规约内 TS 接口） | ⏳ `dev-coding` 实现 |
| **Mock fixtures 清单** | §10 | ⏳ `dev-coding` 按清单生成 |
| **页面路由表** | §4.3 | ⏳ 创建对应 `page.tsx` 骨架 |

### 18.2 关联更新

- `.42cog/work/milestones.md`：追加 D 级条目——UI 设计规约 v1.0-draft 完成 + 栈内 `shadcn/ui + TanStack Query + Zustand + React Hook Form` 落地
- `.42cog/spec/spec-system-architecture.md`：§5 目录结构与本规约 §5 对齐（已一致，无需改）；§8 ADR-009 SSE 桥接在 §7.5 获得客户端层面的具体合约
- `.42cog/spec/spec-database-design.md`：§4.2 类型导出被本规约 §7 props 反向引用——验证了类型设计的可用性

### 18.3 触发下游

- `dev-coding`：按 §15 扩展点清单执行：
  1. `bun create next-app --typescript --tailwind --app --src-dir=no`
  2. `bunx shadcn@latest init` + 按 §6 基元清单批量 `add`
  3. copy §3.1 tokens / §8.2 stores / §4.1 schema.ts / §5 triggers.sql
  4. 按 §7 实现 12 自定义组件 + Storybook
  5. 按 §11 P0 MS 起路由 + 页面
- `dev-quality-assurance`：
  - E2E：§11 MS 清单每条至少一个场景
  - 视觉回归：§7.1 QuoteCard 7 种状态变体 + §14 B/C 双皮肤 = 14 组快照
  - 中性措辞 CI：附录 B grep + eslint rule

---

## 附录 A：核心组件 props 类型来源清单

所有自定义组件的 props 类型**必须**从下表导入，**禁止**在组件文件内重复定义 DB 相关类型。

| 类型 | 来源 | 用于 |
|------|-----|-----|
| `Task` | `@/lib/db/types` | `<TaskStatusBadge>`, `<ProgressStream>`, `<CostEstimateCard>` |
| `TaskStatus` | `@/lib/db/schema` (exported const) | `<TaskStatusBadge>` |
| `Quote` | `@/lib/db/types` | `<QuoteCard>`, `<VariantHighlight>` |
| `VerificationResult` | `@/lib/db/types` | `<QuoteCard>`, `<VerdictChip>`, `<ConfidenceBar>` |
| `ResultReferenceHit` | `@/lib/db/types` | `<ReferenceHitPanel>` |
| `Reference` | `@/lib/db/types` | `<ReferenceHitItem>` |
| `VerifyQuoteOutput` | `@/lib/validations/llm-output` | `<QuoteCard>` 内部 verdict 解析 |

---

## 附录 B：中性措辞 CI 配置

### B.1 `eslint-plugin-neutral-tone`（自定义规则）

```typescript
// tools/eslint-rules/no-accusatory-language.ts
const FORBIDDEN_TOKENS = ['错误', '有误', '误引', '错引', '错别字'];

export default {
  meta: { type: 'problem', docs: { description: '禁止在 UI 文案中使用指责性词汇（real.md #1 + #4）' } },
  create(context) {
    return {
      Literal(node) {
        if (typeof node.value !== 'string') return;
        for (const token of FORBIDDEN_TOKENS) {
          if (node.value.includes(token)) {
            context.report({
              node,
              message: `禁止使用 "${token}"——请改用中性措辞（见 .42cog/spec/spec-ui-design.md §7.2）`,
            });
          }
        }
      },
    };
  },
};
```

### B.2 CI grep 脚本

```bash
# scripts/ci/check-neutral-tone.sh
set -e
PATTERN='错误\|有误\|误引\|错引\|错别字'
# 排除正规术语场景（如 ErrorBoundary 组件名、"error" 英文词）
if rg --type tsx --type ts -n "$PATTERN" app/ components/ lib/ | grep -v '^\s*//' | grep -v 'ErrorBoundary'; then
  echo "❌ 发现指责性词汇（违反 real.md #1+#4）"
  exit 1
fi
echo "✅ 中性措辞检查通过"
```

### B.3 运行时守护（dev only）

```typescript
// components/common/NeutralTextGuard.tsx
'use client';
import { useEffect } from 'react';

const FORBIDDEN = /(错误|有误|误引|错引|错别字)/;

export function NeutralTextGuard({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    const observer = new MutationObserver(() => {
      const text = document.body.innerText;
      if (FORBIDDEN.test(text)) {
        console.error('NeutralTextGuard: 检测到指责性词汇，违反 UI 规约 §7.2');
        throw new Error('Accusatory language detected');
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);
  return <>{children}</>;
}
```

---

## 附录 C：页面路由 × MS 覆盖矩阵

见 §4.3（所有 MS 对应的页面清单）+ §11（P0/P1 优先级）。

---

## 附录 D：术语表（补充）

| 术语 | 定义 |
|------|-----|
| **OKLCH** | CSS 4 颜色模型；基于人眼感知（比 HSL 均匀）；Tailwind v4 推荐 |
| **shadcn/ui** | 复制源码到项目的组件库（非 npm 依赖）；基于 Radix + Tailwind |
| **TanStack Query** | 服务器状态管理（取代 SWR）；缓存、失效、乐观更新 |
| **Inngest Realtime** | Inngest 提供的实时事件广播；客户端用 `subscribe` 订阅 |
| **中性措辞** | 不含"错/误/失"情绪化词汇的措辞风格（real.md #1+#4 强制） |
| **B 皮肤 / C 皮肤** | 同一 affordance 集合的两套交互样式；通过 `data-skin` 切换 |
| **Mock Mode** | 开发期的 fixture 驱动 UI 模式；生产禁用 |
| **VARIANT 皮肤** | 版本异文的独立视觉语言（蓝色虚下划线）；与 MISMATCH（冷灰蓝）视觉区分 |
| **Moderation Rejected Skin** | 审核拒绝的斜纹 + 60% 不透明度 + 禁用交互的独立视觉 |

---

**本规约撰写期**：2026-04-19
**规约版本**：v1.0-draft
**方法论来源**：`.42plugin/42edu/design-ui-design/SKILL.md`
**作者**：yubo（通过 Claude Code）
**UI 栈**：Next.js 15 + React 19 + Tailwind CSS v4 (OKLCH) + shadcn/ui + Zustand + TanStack Query + Inngest Realtime SSE
