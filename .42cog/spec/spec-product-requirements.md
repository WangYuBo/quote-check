---
name: spec-product-requirements
description: 文史类引用校对软件 v1.0 的 affordance 驱动产品规约（MAS 故事骨架）
version: v1.0.0-draft
generated_by: pm-product-requirements skill (v3.0 Affordance-Driven)
depends_on:
  - .42cog/meta/meta.md
  - .42cog/cog/cog.md
  - .42cog/real/real.md
  - notes/260417-engineering-and-ethics-notes.md
scope: v1.0 前瞻 + MVP-as-prompt-prototype
stakeholders:
  - 出版社质检编辑 / 文史类编辑（B 端主力付费）
  - 作者 / 研究生 / 自出版学者（C 端种子）
  - 项目内部 AI 编排引擎
last_updated: 2026-04-18
---

# 文史类引用校对软件 — 产品规约（Product Requirements）

> **定位**：把"读一行引文 → 翻一页原典 → 下一行判断"的人工劳作，转化为"上传 → 按故事推进 → 收到可审计报告"的结构化行动链。
>
> **核心方法**：Affordance 驱动 + MAS（Minimum Affordance Story，最小 affordance 故事）。每个 MAS 是一条完整的意义闭环，而非孤立功能点。
>
> **MVP 定位**：`origin/` 是**提示词原型**（prompt prototype），非产品架构。本规约为 v1.0 定义"应然状态"，每条 affordance 显式标注 MVP 当前实现的三态：
> - `✅ MVP 已有` —— 可直接迁移
> - `⚠️ MVP 有但不合规` —— 实现存在但违反 real.md / notes 约束，需重构
> - `❌ MVP 未实现` —— v1.0 新建

---

## 1. 产品环境（Product Environment）

### 1.1 基本信息

| 项 | 值 |
|----|-----|
| **名称** | 文史类引用校对软件（Quote-Check） |
| **标语** | 一个让文史类书稿引用"可辨、可核、可留痕"的核校环境 |
| **版本** | v1.0（规约版本）/ MVP 在 `origin/` |
| **代码仓库** | `github.com/WangYuBo/quote-check` |

### 1.2 环境描述（Action Space）

本产品创造一个**引用核校环境**：

- 输入侧：用户带着"一部待校书稿 + 若干参考文献"进入
- 行动侧：环境暗示并支持三类动作——「上传与关联」「观察与等待」「复核与定论」
- 输出侧：一份**可审计的三维度报告**——每条引用附原文定位 + AI 判断理由 + 客观置信度 + 模型与 prompt 版本戳

> 核心哲学：**AI 加速判断，编辑保留终审权**。环境提供的 affordance 是"候选与证据"，不是"替换与定论"。

### 1.3 主要 Agent

> 用户明确：**本系统的终点是人类编辑**——校对结果交由编辑自行判断。下游 AI agent（用户自己的 Claude Code / Cursor 调用本系统做自动化核校）**不是 v1.0 的主要 agent**。

| Agent 类型 | 子类 | 动作能力 | 感知通道 |
|-----------|------|---------|---------|
| **人类（主要读者）** | 出版社质检编辑 | 上传 / 配对参考 / 复核 / 导出 / 终审 | 视觉（引文卡片、三维度分栏） |
| 人类 | 文史作者 / 研究生 | 上传 / 自我核查 / 导出 | 视觉 |
| 人类 | 管理员（机构版） | 多席位管理 / 审计日志查看 | 视觉 + 表格 |
| **AI（系统内部）** | 校对编排引擎 | 解析、提取、检索、校对、归档 | DeepSeek-V3.2 API（硅基流动） |
| **AI（系统内部）** | 源映射子模型 | 归一化 source_work、匹配文件名 | LLM 语义匹配 |

**不在 v1.0 主要 agent 之列的角色**（但规约需为其留接口，见 MAS-候选-7）：
- 外部下游 AI agent（用户自己的 Claude Code / Cursor 调用本系统做自动化核校流）

### 1.4 核心 Affordance 总览

| # | Affordance | 对应 MAS |
|---|-----------|---------|
| A01 | 上传书稿 | MAS-1 |
| A02 | 关联参考文献（含多版本） | MAS-1 / MAS-2 |
| A03 | 费用预估与二次确认 | MAS-4 |
| A04 | 发起校对任务 | MAS-1 |
| A05 | SSE 进度观察 | MAS-1 |
| A06 | 三维度独立评级呈现 | MAS-1 |
| A07 | "不符合参考文献"显式标记 | MAS-2 |
| A08 | 审核拒绝显式标记 | MAS-3 |
| A09 | 客观置信度计算 | MAS-1 / MAS-5 |
| A10 | 报告版本冻结 | MAS-5 |
| A11 | 历史报告列表 | MAS-5 |
| A12 | 导出（含版本戳） | MAS-1 / MAS-5 |

---

## 2. MAS 故事目录（6 个正式 + 1 个后期候选）

### 故事依赖图

```
MAS-1（基座：交付可审计的校对报告）
  ├─ MAS-2（以上传参考为准绳 — 不越权判错）
  ├─ MAS-3（拒绝即可见 — 合规性闭环）
  ├─ MAS-4（成本透明可停 — 商业安全）
  ├─ MAS-5（报告可溯源 — 学术可复现）
  └─ MAS-6（数据保密闭环 — B 端采购红线）
        └─ MAS-候选-7*（agent 感知主体 — v1.1+ 留待后期）
```

---

### 2.1 MAS-1：交付可审计的校对报告（基座故事）

**Story Theme**：编辑交给系统一部书稿和参考文献，拿回一份每条引用都可逐一人工复核的三维度报告。AI 加速，但话语权不转移。

**Core Affordance Sequence**：

1. **上传书稿** → perceive：拖拽区 + 文件类型提示（docx/pdf/md/txt/epub）
2. **关联参考文献** → perceive：可拖拽 1–10 份；多版本可并列（见 MAS-2）
3. **费用预估 + 二次确认**（MAS-4）→ perceive：预估条数 × 单价 × 模型费率，> 阈值时阻塞提交
4. **发起校对任务** → perceive："开始校对"按钮从禁用到可点；点击后进入进度视图
5. **观察进度**（SSE）→ perceive：三段式里程碑（解析 → 提取 → 校对）+ 日志流
6. **收到三维度独立评级报告** → perceive：每条引用一张卡片，三栏独立显示【字词准确性 / 解释一致性 / 上下文相符性】，**禁用综合评分**（notes #6）
7. **逐条人工终审** → perceive：每条旁有"AI 建议，请人工复核"显式文字（notes #5）；候选标注不直接改稿（real.md #1）
8. **导出** → perceive：Word / CSV 下载按钮；文件含模型 + prompt 版本戳

**Meaning Closure**：编辑把"AI 嫌疑"转化为"编辑定论"。AI 是第一过筛，编辑是终审；二者分工不合流。

**Intrinsic Motivation**：
- **Interest**：每次校对都有真实新发现（与参考不符、断章、解释偏差）
- **Mastery**：编辑在判断 AI 建议的过程中，反而提升了自己的文本敏感度
- **Autonomy**：每一条 AI 建议都是"候选"，编辑有权全部忽略

**Story Dependencies**：
- Enables：MAS-2 / MAS-3 / MAS-4 / MAS-5 / MAS-6（所有其他故事都在 MAS-1 之上生长）
- Requires：无（基座）

**Out of Scope**（此故事内不处理）：
- 修改建议的写入（由编辑手动在 Word 中操作）
- 校对结果的云端协同评论（企业版 v2.0）

**MVP 状态**：
- ✅ 已有：多格式解析、逐段提取、三维度判定框架、SSE、Word/CSV 导出
- ⚠️ 不合规：置信度来自 AI 自评（应客观计算，见 A09）；CSV 把三维度问题合并为"问题描述"（应拆为三列，见 A06）
- ❌ 未有：模型+prompt 版本戳（MAS-5）、"AI 建议请人工复核"显式文案（notes #5）

---

### 2.2 MAS-2：以上传参考文献为准绳，不越权判"错"（守真实编辑流）

> **关键原则**：**编辑上传的参考文献即是本次核校的权威绳尺**。
>
> 真实工作流：编辑习惯以某权威出版社/版本（如中华书局《论语译注》杨伯峻本）为**自己选定的权威标准**进行核校——符合即通过，不符合即需调查。系统要做的是**忠实报告引文与上传参考文献的符合度**，**不越权判"错误"**（judged 与 not judged 是两种不同行为）。
>
> 这恰恰是 real.md #4 "异文 ≠ 错误" 的**正确实现**：系统只标"不符合 [上传参考]"，而不说"错误"。编辑拿到这个信号后，自己判断这是打字错误、转引、还是作者用了别的版本——决定权在编辑。

**Story Theme**：引文要不要改，是编辑的专业判断；系统只负责告诉编辑"这条引文与你上传的参考文献对得上 / 对不上"，绝不替编辑下"错/对"的结论。

**Core Affordance Sequence**：

1. **上传权威参考文献** → perceive：
   - 支持 1-10 份参考文献（cog.md 参考文献分类：原典 / 注本 / 现代译本 / 工具书）
   - 每份可标注"版本角色"（默认"原典"），方便编辑在多参考情况下自己心里有数
2. **系统按"上传参考文献 = 权威绳尺"执行校对** → 内部行动：
   - 若上传 1 份：该份即绳尺
   - 若上传多份：**任一份匹配即视为符合**（因为编辑上传的都是他选定的权威版本）
3. **三态标签呈现**（不再包含"异文"为独立状态）：
   - ✅ **符合参考文献**：至少一份上传参考文献命中
   - ❌ **不符合参考文献**：所有上传参考文献都对不上（系统**仅陈述"不符合"，不判"错误"**）
   - ❓ **参考文献中未找到**：引文文献与上传文献不匹配（如引文标称《史记》但上传的只有《论语》）→ 进入 A02 / MAS-1 的"原文未上传"旁路
4. **每条"不符合"附证据** → perceive：
   - 报告显示引文原样 + 在上传参考中最接近的段落 + 字符级差异高亮
   - 文案措辞：**"与上传参考文献不符"**（而非"有误 / 错误"）
   - 编辑侧固定提示："请人工确认此处是打字错误、转引差异、还是作者采用了其他版本"
5. **编辑手动定论** → perceive（这一步留给编辑在 Word 中完成，系统不介入）：编辑基于"不符合"信号 + 自己对上传参考的版本认识，自己决定改 / 不改

**Meaning Closure**：系统克制自己的"判错"冲动，把专业判断的话语权完全留给编辑。real.md #4 的精神不是让系统"识别多版本"，而是让系统**不要越过自己的能力边界下结论**。

**预留接口**（不在 v1.0 阶段实现功能，但接口先设计好，为 v1.1+ 接入古籍语料库预留）：

- `SourceCorpusProvider` 抽象接口：
  ```python
  class SourceCorpusProvider(Protocol):
      def search(self, quote: str, canonical_name: str) -> List[SearchResult]: ...
      def provider_name(self) -> str: ...  # 记入版本戳
  ```
- v1.0 唯一实现：`UserUploadedCorpus`——只搜用户本次上传的参考文献
- v1.1+ 备选实现：`CtextCorpus`、`ZhidaigeCorpus`、`PgvectorLocalCorpus` 等
- **硬约束**：所有对参考文献的搜索/匹配必须经 `SourceCorpusProvider.search()`——不得在业务代码里硬编码"只搜用户上传"，否则未来接入外部语料库需改动多处
- **版本戳记录**：MAS-5 版本冻结时须记录 `corpus_provider = "UserUploadedCorpus"` + 所用参考文献 hash 清单

**Intrinsic Motivation**：
- **Autonomy**：编辑的专业判断权被系统**主动守护**而非侵犯
- **Trust**：长期使用后编辑知道"这工具不会乱判错"，建立信任
- **Mastery**：系统只报"事实"（符合/不符合），编辑在做出判断的过程中锻炼和沉淀自己的版本学知识

**Story Dependencies**：
- Requires：MAS-1（基座报告流程）+ A02（多参考上传）
- Enables：MAS-5（版本冻结记录 corpus_provider + 参考文献 hash）

**Out of Scope**：
- ❌ 系统不对"不符合"自动打"错误"标签（违反 real.md #4）
- ❌ 系统不提供"异文候选抽屉 / 多版本并列比对"的复杂交互（过度设计；编辑的心智模型是"我选的参考就是绳尺"）
- ❌ 系统不预置任何语料库（real.md #5 版权责任在用户）
- ❌ 系统不自动判定"哪个版本更权威"（权威判断属编辑专业）

**MVP 状态**：
- ✅ 部分已有：MVP 已实现"以上传参考为准"的匹配逻辑（`proofreader.py::_find_source_text_for_work`）
- ⚠️ 不合规：
  - MVP 的 `verify_quote_prompt.txt` 让 AI 在 `text_accuracy.is_accurate=false` 时给出问题描述——部分语境下 AI 会使用"错误/有误"字眼，需在 prompt 层调整措辞为"与原文不符"
  - MVP 无"不符合"独立状态枚举，混在 `has_issue: true` 的通用状态中
- ❌ 未有：
  - `SourceCorpusProvider` 接口抽象（业务代码直接调 `_find_source_text_for_work`）
  - UI 层"不符合"的专属文案设计（目前与其他"有问题"共用样式）
- **迁移资产**：`_BOOK_NAME_ALIASES` / `_normalize_source_work` / `_match_source_work_to_file` 迁入 `SourceCorpusProvider` 的默认实现 `UserUploadedCorpus`

---

### 2.3 MAS-3：拒绝即可见（合规性闭环）

**Story Theme**：AI 因内容审核拒绝响应时，**编辑看见这个事实**，而不是被伪装成"通过"。

**Core Affordance Sequence**：

1. **模型调用 → 拒绝信号捕获** → perceive（系统内部）：
   - HTTP 4xx/5xx 特定错误码
   - 响应 JSON 含拒绝标识（如 `content_filter` / `moderation`）
   - 响应文本匹配拒绝模式（"抱歉，我无法回答" / "不能提供" 等）
2. **显式状态标记** → perceive：该条引用在报告中呈现 **"⛔ 审核拒绝，无法校对"** 状态（专用状态，与"校对失败"区分）
3. **保留证据** → perceive：报告中该条占一张卡片，标明"已尝试校对，被模型拒绝"+ 拒绝时间戳
4. **提示人工接管** → perceive：卡片上提示"建议人工核对原文：《xxx》+ 章节定位"

**Meaning Closure**：国产 AI 审核边界被显式 surfaced。用户不会基于错误的"通过"签发书稿。notes #1。

**状态枚举**（v1.0 需新建）：
```
PASS              # 三维度全通过
HAS_ISSUE         # 三维度任一有问题
REJECTED_BY_MOD   # 审核拒绝 ← 新增
NO_SOURCE         # 未上传对应文献
PARSE_ERROR       # JSON 解析失败
API_ERROR         # 网络/其他 API 错误
```

**Intrinsic Motivation**：
- **Interest**：了解"哪些内容会被 AI 拒"本身是研究者感兴趣的元信息
- **Mastery**：在可预见的敏感主题上主动切换人工核校节奏
- **Autonomy**：知情权——用户知道系统什么时候"没办法"

**Story Dependencies**：
- Requires：MAS-1
- Enables：MAS-5（版本快照需记录"该条曾被拒"这一历史事实）

**Out of Scope**：
- 绕过模型审核（red line — 合规不能也不应绕）
- 自动切换多个模型重试直到不被拒（违反 notes #7"版本锁定"，且容易引起合规争议）

**MVP 状态**：
- ⚠️ 不合规——现 `_make_error_result`（`origin/app/services/proofreader.py:653-675`）把"拒绝 / JSON 解析失败 / 网络错误"混为同一 error 语义
- ❌ 未有：拒绝信号的显式捕获逻辑、专用 UI 标签

---

### 2.4 MAS-4：成本透明可停（商业安全）

**Story Theme**：费用可预估、运行中可追踪、越界可自动暂停。

**Core Affordance Sequence**：

1. **上传后预估** → perceive：
   - 引文数粗估（基于书稿长度 + 密度估算）
   - 预估公式展示：`预估条数 × 每条 token × 费率`
   - 预估金额 + 误差区间（如 `¥16.40 ± 20%`）
2. **阈值二次确认** → perceive：预估 > 默认 ¥50 → 阻塞式对话框 "本次预计 ¥XX，确认继续？"
3. **运行中累计费用推送** → perceive：SSE 事件携带 `cost_so_far` 字段，UI 显示当前已花费
4. **越界自动暂停** → perceive：累计 > 预估 × 1.5 → 系统**暂停而非终止**任务；显示"已花费 ¥YY，超出预估 1.5 倍，是否继续？【继续 / 停止】"
5. **费用透明报表** → perceive：任务结束后生成成本明细（按引文数 × 模型 tokens）

**Meaning Closure**：按量计费的暴击被制度性拦截。real.md #6。

**默认阈值**（可在用户设置中修改）：
- 单任务预估硬上限：¥50 → 触发二次确认
- 运行时超预估比例：1.5x → 触发暂停

**Intrinsic Motivation**：
- **Mastery**：长期使用后用户对"自己书稿的成本区间"形成预期
- **Autonomy**：每一笔钱花在哪一条引文上，可审可查

**Story Dependencies**：
- Requires：MAS-1
- Enables：MAS-6（费用明细进入审计日志）

**Out of Scope**：
- 自动限流（让慢、降级到 cheaper 模型等"偷偷省钱"的做法——违反 notes #7 版本锁定）
- 多租户的账户余额管理（v2.0 企业版）

**MVP 状态**：
- ❌ 全新。`origin/app/services/proofreader.py:189-240` `_call_api` 不返回 tokens/费用元数据

---

### 2.5 MAS-5：报告可溯源（学术可复现）

**Story Theme**：三个月后回看报告，还能看到"当时用的什么模型、什么 prompt、什么参考版本"。

**Core Affordance Sequence**：

1. **报告生成时冻结版本三元组** → perceive（系统内部）：
   ```
   {
     "model_id": "deepseek-ai/DeepSeek-V3.2",
     "model_version_snapshot": "2026-04-18",
     "prompt_versions": {
       "extract": "sha256:abc...",
       "verify":  "sha256:def...",
       "map":     "sha256:ghi..."
     },
     "source_refs_hash": "sha256:jkl..."
   }
   ```
2. **进入历史列表** → perceive：用户历史报告列表，每条含生成时间 + 版本戳缩写
3. **禁止重跑覆盖** → perceive（系统约束）：界面上无"用新模型重跑此报告"按钮；若用户想升级，必须**主动发起新任务**——新旧报告并存
4. **导出文件含版本戳** → perceive：Word 页眉 + CSV 文件头包含 `model=DeepSeek-V3.2 | prompts=abc/def/ghi | generated=2026-04-18`

**Meaning Closure**：学术场景的"稳定性 > 先进性"。编辑/作者事后引用"经 AI 核校后三处改动"时，能回到当时的精确状态。real.md #7 + notes #7。

**不可变快照原则**（实现约束）：
- 报告一旦生成，其内容、版本戳即被**数据库层级冻结**（PostgreSQL 上使用只读表约束或审计日志模式）
- 模型/prompt 升级后，旧报告**不得被后台批处理触及**
- 修正错误的唯一方式：发布新任务，生成新报告，并在新报告中可选引用"基于旧报告 ID 的重校"

**Intrinsic Motivation**：
- **Mastery**：长期积累后，用户形成"版本档案"，本身成为学术资产
- **Autonomy**：用户对"要不要升级模型重校"拥有显式选择权

**Story Dependencies**：
- Requires：MAS-1
- Enables：MAS-6（历史归档的数据保密原则）

**Out of Scope**：
- 报告的可编辑注释（可放在 v2.0）
- 跨报告的引文聚合分析（v2.0 功能增强）

**MVP 状态**：
- ❌ 全新。MVP 无持久化（`_tasks: dict` 内存存储），任务结束即销毁，无版本记录

---

### 2.6 MAS-6：数据保密闭环（B 端采购红线）

**Story Theme**：上传的书稿和参考文献**不被训练、自动过期删除、数据流向明示**。没有这条，B 端永远不会签采购。

**Core Affordance Sequence**：

1. **上传前用户协议** → perceive：
   - 显式对话框（B 端机构版必展示；C 端个人版可简化但不可省略）
   - 列出数据流向：本地存储 → 调用硅基流动 API（DeepSeek-V3.2）→ 结果回写本地
   - 明示：**第三方服务商承诺不用于训练**（引用官方条款截图 / 链接）
2. **任务完成自动销毁** → perceive：
   - 任务结束 → 倒计时 N 天（默认 7 天，可协议约定）
   - 倒计时可见（"本任务资料将于 YYYY-MM-DD 自动删除"）
   - 用户可主动"立即删除"
3. **日志脱敏强制** → perceive（开发侧约束）：
   - 结构化日志只记 task_id / quote_hash / metadata，**不记原文片段**
   - 错误日志中的原文引用需截断或脱敏
   - 通过代码层级 LoggerFilter 强制，不依赖开发者自觉
4. **主动删除接口** → perceive：用户端有"退约并删除"按钮，立即触发销毁流程

**Meaning Closure**：B 端采购红线。一次泄密 = 永久失去机构市场。real.md #3 + notes #2。

**具体技术约束**（开发侧必须遵守）：
- 上传文件存储路径不包含原始文件名（用 task_id + hash 重命名）
- Web 框架日志中间件需配置"请求体截断" —— FastAPI 的 `logger.info(request_body)` 是默认反模式
- 错误追踪（Sentry / 类似）需配置 PII scrubber
- 备份策略须包含"TTL 到期的备份也销毁"

**Intrinsic Motivation**（这里更偏"安全感"）：
- **Autonomy**：数据归属权完全在用户手里
- **Trust**：明示流向的透明，建立长期信任

**Story Dependencies**：
- Requires：MAS-1 / MAS-5（销毁时同时销毁报告？不——**报告脱敏后保留**，原文销毁）

> 🔑 **关键设计决策**：销毁时，**原始书稿/参考文献文件销毁**，但**校对结果报告保留**（用户可能已基于其工作）。报告中不含原始引文上下文的大段原文，只保留引文片段 + 判断结论——此为脱敏后的**研究资产**而非**保密原文**。

**Out of Scope**：
- 端到端加密（过度设计，默认信任服务器；B 端企业版 v2.0 可补）
- 自建模型避免调用第三方（v2.0 之外）

**MVP 状态**：
- ✅ 部分：任务完成后删除上传文件（`routes.py:126-131`）
- ⚠️ 不合规：
  - 无显式 TTL（只是任务结束立即删，不符合"N 天保留供用户查验后再销毁"的约束）
  - 无日志脱敏（`routes.py` 多处 `logger.info("[task %s] ...")` 未显式过滤原文）
  - 无用户协议展示
- ❌ 未实现：主动删除接口、备份 TTL、PII scrubber

---

### 2.7 MAS-候选-7：AI agent 作为感知主体（留待后期开发，不在 v1.0）

> **定位**：本条**不在 v1.0 实施范围**，留待 v1.1 或 v2.0 开发。此处记录是为了防止 v1.0 架构把"人类 UI"与"未来 agent API"做成两套脱钩系统——规约先约束"不要挖坑"，不等同于"必须现在做"。

**Story Theme**（未来）：用户自己的 Claude Code / Cursor / 其他 AI agent，能把本系统当一个"引用校对工具"编程式地调用。

**Core Affordance Sequence**（未来）：
1. OpenAPI / MCP Server 文档
2. 语义化响应字段命名 + 结构化错误码枚举
3. 长轮询 / SSE 的稳定契约
4. 认证与限流的 API Key 体系

**v1.0 阶段的最小预留**：
- 响应字段命名保持语义自解释（如 `verdict_text_accuracy` 而非 `v1`）
- 错误码枚举化（MAS-3 已约束）
- 不引入反语义化设计（如 "点击按钮 X 才能触发接口"这种只靠 UI 而无 API 的路径）

**Meaning Closure**（未来）：在"AI 时代产品即环境"的命题下，本系统可被其他 agent 作为感知者进入，而不只是"给人看"。

**Story Dependencies**：
- Requires（未来）：MAS-1 / MAS-5（稳定的核心契约）+ 认证体系
- Enables（未来）：批量 API / 自动化流水线集成

**Out of Scope（v1.0）**：全部实现；只做"不挖坑"的预留。

**MVP 状态**：
- ✅ 已有部分 REST API（`/api/proofread` / `/api/result/{task_id}` 等）
- ❌ 未有 OpenAPI 文档、agent 友好的错误码约定、MCP Server

---

## 3. Affordance 详目（12 条 Primary）

> 每条按 SKILL.md Phase 2 模板填充。Secondary / Latent affordance 在 §3.13 以表格简列。

---

### A01：上传书稿

**Level**: Primary
**Action Enabled**: 把本地 docx/pdf/md/txt/epub 文件提交为一次校对任务的书稿输入
**MVP 状态**: ✅ 已有（`origin/app/api/routes.py:150-220`）

**Environmental Properties**:

| 属性 | 值 | 可感知者 |
|------|---|---------|
| 视觉线索 | 大面积拖拽区 + 上传按钮 + 文件类型列表 + 最大尺寸提示 | 人类 |
| 语义标记 | `<input type="file" accept=".docx,.pdf,.md,.txt,.epub">` + `aria-label="上传书稿"` | 无障碍 / 未来 agent |
| 交互模式 | 拖拽 / 点击选择 / 粘贴（可选） | 双 |

**Perception-Action Coupling**:

| 阶段 | 人类 | 系统内部 |
|------|------|---------|
| See | 拖拽区 + 文件图标 | — |
| Do | 拖入文件 / 点击选择 | 解析扩展名 → 校验白名单 |
| Feedback | 文件卡片出现 + 进度条 + 解析完成后显示"共 XX 段 / XX 字" | 持久化到 uploads/ + task_id 生成 |

**Constraints**（锚定 real.md / notes）:
- 文件体积上限（默认 50MB，用户可在设置修改）
- 文件类型白名单：`.docx / .pdf / .md / .txt / .epub`
- 上传文件**必须用 task_id + hash 重命名**，不保留原始文件名（MAS-6 约束）

**Dependencies**:
- Requires：无
- Enables：A02 A03 A04

**Acceptance Criteria**:

| ID | 标准 | 人类测试 | 系统内部验证 |
|----|------|---------|-------------|
| A01-1 | 拖拽区可感知 | 用户看到带虚线边框的大矩形区域 | DOM 含 drag-drop 属性 |
| A01-2 | 文件类型过滤 | 上传 `.exe` 时显示"不支持的类型" | MIME + 后缀双重校验 |
| A01-3 | 尺寸限制 | 上传 >50MB 时显示"超出限制" | HTTP 413 + 前端拦截 |
| A01-4 | 任务 ID 返回 | 上传成功显示 task_id | API 返回 `{task_id, status: "pending"}` |
| A01-5 | 文件名脱敏存储 | — | 服务器 uploads/ 目录中文件名为 task_id + hash |

---

### A02：关联参考文献（含多版本）

**Level**: Primary
**Action Enabled**: 为本次任务关联 1-10 份参考文献；若同一文献有多版本（原典/注本/译本），支持并列上传并标注版本角色
**MVP 状态**: ⚠️ 部分——可上传多份但无版本角色标注；无"语料库接口"抽象

**Environmental Properties**:

| 属性 | 值 | 可感知者 |
|------|---|---------|
| 视觉线索 | 多文件上传区 + 每份文件右侧"版本角色"下拉（原典/注本/译本/工具书） | 人类 |
| 语义标记 | `<input type="file" multiple>` + 每份文件的 `data-version-role` 属性 | 双 |
| 交互模式 | 拖拽多份 / 每份独立指定版本角色 | 人类 |

**Perception-Action Coupling**:

| 阶段 | 人类 | 系统内部 |
|------|------|---------|
| See | 上传区 + 版本角色下拉 | — |
| Do | 拖入文件 → 从下拉选"注本" | 解析 + 按版本角色分组 |
| Feedback | 文件列表按版本角色分区显示 | 内部挂载到 `SourceCorpusProvider.user_uploaded` |

**Constraints**:
- 最多 10 份参考文献（MVP 既有）
- 版本角色枚举：`原典 / 注本 / 现代译本 / 工具书 / 其他`（对应 cog.md 参考文献分类）
- **不预置受版权校点本**（real.md #5）
- 支持未来接入外部语料库（通过 `SourceCorpusProvider` 抽象），v1.0 只实现 `UserUploadedCorpus`

**Dependencies**:
- Requires：A01
- Enables：A04 / A07（上传参考文献作为校对准绳）

**Acceptance Criteria**:

| ID | 标准 | 人类测试 | 系统内部验证 |
|----|------|---------|-------------|
| A02-1 | 多文件上传 | 拖拽 3 份文件全部出现在列表 | FormData 含 3 份 sources |
| A02-2 | 版本角色标注 | 下拉可选 4+ 个版本角色 | API 请求含 `version_role` 字段 |
| A02-3 | 上限提示 | 上传第 11 份时报错 | HTTP 400 |
| A02-4 | 语料库接口隔离 | — | 代码中对 source 的搜索全部经 `SourceCorpusProvider.search()` |
| A02-5 | 无版本角色时默认 | 不选版本角色时默认为"原典" | 后端 default 值生效 |

---

### A03：费用预估与二次确认

**Level**: Primary
**Action Enabled**: 在任务真正启动前，用户看到预估费用；超阈值时必须二次确认
**MVP 状态**: ❌ 未实现

**Environmental Properties**:

| 属性 | 值 | 可感知者 |
|------|---|---------|
| 视觉线索 | 上传完成后显示"预估费用"卡片（粗估条数 × 费率）+ 阈值超限时的阻塞式对话框 | 人类 |
| 语义标记 | 预估 API `GET /api/estimate/{task_id}` 返回 `{estimated_cost, quote_count_estimate, threshold_exceeded}` | 双 |
| 交互模式 | 查看 → 确认 → 发起 | 人类 |

**Perception-Action Coupling**:

| 阶段 | 人类 | 系统内部 |
|------|------|---------|
| See | "预估 ¥16 ± 20%（约 500 条引文）" | — |
| Do | 点击"开始校对" | 校验 threshold → 如超限则返回确认要求 |
| Feedback | 若超限 → 弹出二次确认对话框；否则进入 A04 | 记录用户确认事件 |

**Constraints**:
- 预估算法：基于书稿字数 + 引用特征密度（如书名号 + 引号计数）
- 默认阈值 ¥50，用户可在设置修改（real.md #6）
- **不允许跳过二次确认**（硬约束）

**Dependencies**:
- Requires：A01 A02
- Enables：A04

**Acceptance Criteria**:

| ID | 标准 | 人类测试 | 系统内部验证 |
|----|------|---------|-------------|
| A03-1 | 预估可见 | 上传后 2 秒内显示预估卡片 | API 返回估算对象 |
| A03-2 | 阈值触发确认 | 预估 ¥100 时，点击"开始"出现确认对话框 | 后端拒绝无确认的请求 |
| A03-3 | 低于阈值直接通过 | 预估 ¥5 时，点击"开始"直接进入校对 | API 不强制 confirm 字段 |
| A03-4 | 误差范围披露 | 卡片文字含"± X%" | 返回字段 `estimate_uncertainty` |

---

### A04：发起校对任务

**Level**: Primary
**Action Enabled**: 创建一次校对任务并入队执行
**MVP 状态**: ✅ 已有（`origin/app/api/routes.py:150-220`）

**Environmental Properties**:

| 属性 | 值 | 可感知者 |
|------|---|---------|
| 视觉线索 | "开始校对" 主按钮（禁用→可点）+ 提交后转为"任务进行中" | 人类 |
| 语义标记 | `POST /api/proofread` 含 `task_id / confirmed_cost / version_role_map` | 双 |
| 交互模式 | 点击 / API 调用 | 人类（v1.0）/ AI agent（候选 v1.1） |

**Perception-Action Coupling**:

| 阶段 | 人类 | 系统内部 |
|------|------|---------|
| See | 按钮从灰变蓝 | 前置检查（上传完成 + 费用确认） |
| Do | 点击 | 持久化任务状态到数据库（v1.0 新增） |
| Feedback | 按钮变禁用 + 跳转到进度视图 | 任务进入队列 |

**Constraints**:
- 任务状态必须持久化（notes #4，v1.0 硬重构 — 不再用 `_tasks: dict`）
- 每个任务生成幂等 key `{task_id}_{quote_id}_{attempt_n}`（notes #4）

**Dependencies**:
- Requires：A01 A02 A03
- Enables：A05 A06 A08 A09

**Acceptance Criteria**:

| ID | 标准 | 人类测试 | 系统内部验证 |
|----|------|---------|-------------|
| A04-1 | 任务持久化 | 重启服务后任务状态仍在 | 数据库 `tasks` 表有记录 |
| A04-2 | 幂等性 | 重复提交同一 task_id 不产生多次扣费 | 幂等 key 拦截 |
| A04-3 | 未确认费用时拒绝 | A03 超阈值未确认时，直接点"开始"被拒 | HTTP 400 + 明确文案 |

---

### A05：SSE 进度观察

**Level**: Primary
**Action Enabled**: 用户实时观察任务三段式进度（解析 → 提取 → 校对）
**MVP 状态**: ✅ 已有（`origin/app/api/routes.py:258-317`）

**Environmental Properties**:

| 属性 | 值 | 可感知者 |
|------|---|---------|
| 视觉线索 | 三段式进度条 + 日志流面板 + 当前成本显示 | 人类 |
| 语义标记 | `GET /api/stream/{task_id}` SSE 流 + 事件类型枚举 | 双 |
| 交互模式 | 被动接收 + 可中断按钮 | 人类 |

**事件类型枚举**（v1.0 规范化，MVP 是非结构化日志字符串）:
```
parse_start / parse_progress / parse_done
extract_start / extract_progress / extract_done
verify_start / verify_progress / verify_done
cost_update (携带 cost_so_far)
moderation_rejected (携带 quote_id)
warning (未上传原文等)
error (致命错误)
finished (携带 result 摘要)
```

**Perception-Action Coupling**:

| 阶段 | 人类 | 系统内部 |
|------|------|---------|
| See | 进度条填充 + 日志滚动 | — |
| Do | 观察 / 可中断 | SSE 推送结构化事件 |
| Feedback | 每秒更新；卡顿时有"仍在运行"心跳 | 内部状态同步 |

**Constraints**:
- SSE 事件必须结构化（JSON），不能用纯字符串（A05 MVP 合规性改造）
- 日志流中**原文片段不得出现**（MAS-6 约束）——只有引文 hash + 结论摘要

**Dependencies**:
- Requires：A04
- Enables：A06 A08

**Acceptance Criteria**:

| ID | 标准 | 人类测试 | 系统内部验证 |
|----|------|---------|-------------|
| A05-1 | 三段进度可见 | 进度条清晰分三段 | 事件类型分别有 3 组枚举 |
| A05-2 | 事件结构化 | — | 每条 SSE payload 是合法 JSON 含 `event_type` |
| A05-3 | 日志无原文 | — | 自动化测试：抓 SSE 流检查无书稿原文子串 |
| A05-4 | 可中断 | 点击"取消" → 任务进入取消态 | 后端收到 cancel 请求并停止新的 API 调用 |

---

### A06：三维度独立评级呈现

**Level**: Primary
**Action Enabled**: 每条引用的校对结果按字词 / 解释 / 上下文**三维度独立呈现**，永不合并为总分
**MVP 状态**: ⚠️ 部分——JSON 已分三维度，但 CSV 导出合并（`routes.py:378-390`）

**Environmental Properties**:

| 属性 | 值 | 可感知者 |
|------|---|---------|
| 视觉线索 | 每张引用卡片**三栏独立显示**，各维度有独立状态标记（符合/不符合/未找到/存疑）、问题描述、修改建议 | 人类 |
| 语义标记 | 响应 JSON **字段三元化**：`verdict_text_accuracy` / `verdict_interpretation` / `verdict_context` | 双 |
| 交互模式 | 每维度可独立展开查看证据 | 人类 |

**Perception-Action Coupling**:

| 阶段 | 人类 | 系统内部 |
|------|------|---------|
| See | 引用卡片三列（字词/解释/上下文） | — |
| Do | 点击任一维度卡片展开详情 | — |
| Feedback | 展开后显示：原文定位 + AI 理由 + 置信度 + 修改候选 | — |

**Constraints**（hard constraints）:
- **禁止**任何位置（UI / CSV / Word / API）出现"综合评分""总分""通过率"等单一数值（notes #6）
- CSV 导出必须**按三维度拆为三列独立**（MVP 当前合并为"问题描述"，必须改）
- Word 导出表头必须分列：字词准确性 / 解释一致性 / 上下文相符性

**Dependencies**:
- Requires：A04 A05
- Enables：A12

**Acceptance Criteria**:

| ID | 标准 | 人类测试 | 系统内部验证 |
|----|------|---------|-------------|
| A06-1 | 三列独立 | UI 卡片清晰分三栏 | DOM 含三个独立 section |
| A06-2 | CSV 三列 | 导出文件打开后字词/解释/上下文各一列 | 代码 review 确认 |
| A06-3 | API 字段三元 | — | 响应 JSON 含三个 verdict 字段 |
| A06-4 | 无综合评分 | 全 UI / 导出 / API 无 `overall_score` 字段 | 自动化 grep |
| A06-5 | "AI 建议请人工复核"提示 | 每张卡片底部可见提示 | DOM 固定文案 |

---

### A07："不符合参考文献"显式标记（MAS-2 核心）

**Level**: Primary
**Action Enabled**: 当引文与所有上传参考文献均不匹配时，以**"不符合参考文献"（neutral wording）** 标记，绝不使用"错误/有误"措辞
**MVP 状态**: ⚠️ 部分——MVP 已做"与参考文献对比"的逻辑，但措辞上使用了"错误/有误"字眼，且无独立状态枚举

**Environmental Properties**:

| 属性 | 值 | 可感知者 |
|------|---|---------|
| 视觉线索 | 引文卡片字词维度三态 chip：✅ 符合参考文献 / ❌ 不符合参考文献 / ❓ 参考文献中未找到 | 人类 |
| 语义标记 | `verdict_text_accuracy` 枚举：`MATCH` / `NOT_MATCH` / `NOT_FOUND_IN_REF` | 双 |
| 交互模式 | 展开字词维度 → 看到差异对比 + 编辑提示语 | 人类 |

**Perception-Action Coupling**:

| 阶段 | 人类 | 系统内部 |
|------|------|---------|
| See | 黄色/红色 chip + 中性措辞"不符合参考文献" | `SourceCorpusProvider.search()` 返回所有上传参考的命中结果 |
| Do | 展开对比细节 | — |
| Feedback | 显示：引文原样 / 参考中最接近段落 / 字符级 diff 高亮 / 固定提示语"请人工确认此处是打字错误、转引差异、还是作者采用了其他版本" | — |

**Constraints**（此 affordance 的硬约束）:
- 系统**只陈述事实关系**（符合/不符合/未找到），**不做价值判断**（错误/有误/正确）
- 状态枚举的文案**全链路统一**（UI / CSV / Word / API 响应）——不允许某处用"符合"某处用"正确"
- `verdict_text_accuracy` 字段值必须是 `MATCH / NOT_MATCH / NOT_FOUND_IN_REF` 之一，**不出现 `ERROR / WRONG` 等判错语义**
- `verify_quote_prompt.txt` 须相应调整（MVP 迁移时的 prompt 版本升级）：
  - 移除 "错误" / "有误" / "误引" 等措辞
  - 改为 "与参考不符" / "未在参考中找到对应段落"
  - AI 仍可在 `issues` 字段**客观描述差异**（如 "参考为'不亦说乎'，引文作'不亦乐乎'"），但**不作价值定性**
- 多份参考文献时：**任一份命中即 MATCH**（符合真实编辑流——编辑选的每一份都是他认可的权威）
- 语料库搜索必须经 `SourceCorpusProvider` 抽象；v1.0 唯一实现 `UserUploadedCorpus`

**Dependencies**:
- Requires：A02（参考文献关联）+ A04
- Enables：A10（版本冻结记录 corpus_provider 与参考 hash）

**Acceptance Criteria**:

| ID | 标准 | 人类测试 | 系统内部验证 |
|----|------|---------|-------------|
| A07-1 | 三态枚举全覆盖 | 构造 MATCH / NOT_MATCH / NOT_FOUND_IN_REF 各一条引文 → 报告分别显示三种 chip | API 返回值在枚举内 |
| A07-2 | 中性措辞 | UI / 导出文件中无"错误/有误/误引"字眼 | 自动化 grep CI |
| A07-3 | 任一参考命中即 MATCH | 上传两份参考，引文与第二份匹配 → 返回 MATCH | API 层测试 |
| A07-4 | 差异证据可见 | 点击"不符合" → 展开看到引文 / 参考段 / diff 高亮 | DOM 有差异高亮节点 |
| A07-5 | 编辑提示语固定 | 每条"不符合"卡片显示"请人工确认此处是打字错误、转引差异、还是作者采用了其他版本" | 固定文案 |
| A07-6 | 语料库接口隔离 | — | 代码中所有参考搜索调用都走 `SourceCorpusProvider.search()` |
| A07-7 | 版本戳含 corpus 信息 | 报告版本戳含 `corpus_provider: "UserUploadedCorpus"` + `reference_hashes: [...]` | MAS-5 集成 |

---

### A08：审核拒绝显式标记（MAS-3 核心）

**Level**: Primary
**Action Enabled**: AI 模型因审核拒绝时，该条引用显式标记"审核拒绝，无法校对"
**MVP 状态**: ❌ 未实现（现 MVP 混入"校对失败"）

**Environmental Properties**:

| 属性 | 值 | 可感知者 |
|------|---|---------|
| 视觉线索 | 引用卡片顶部 ⛔ 红色状态 chip："审核拒绝，无法校对" + 拒绝时间 | 人类 |
| 语义标记 | API `status = "REJECTED_BY_MOD"` + `rejection_reason_pattern` | 双 |
| 交互模式 | 点击 → 展示"建议人工核对：《xxx》 位置 Y" | 人类 |

**Perception-Action Coupling**:

| 阶段 | 人类 | 系统内部 |
|------|------|---------|
| See | ⛔ chip 醒目 | 拒绝信号捕获（HTTP code + 响应模式匹配） |
| Do | 展开卡片 / 人工核对 | — |
| Feedback | 明确提示"此条未经 AI 校对" | — |

**拒绝检测逻辑**（v1.0 新建）:
```python
def is_moderation_rejection(response) -> bool:
    # 1. HTTP 状态码特征
    if response.status in (400, 451) and "moderation" in response.text.lower():
        return True
    # 2. 响应 JSON 含审核字段
    if isinstance(response.json, dict) and response.json.get("error_type") == "content_filter":
        return True
    # 3. 响应文本模式
    patterns = ["抱歉", "无法回答", "不能提供", "违反相关规定"]
    if any(p in response.text for p in patterns) and len(response.text) < 200:
        return True
    return False
```

**Constraints**:
- 拒绝状态 **不得计入 "校对失败" error_count**（必须独立统计，report 中独立章节）
- 拒绝不触发自动重试（notes #7 版本锁定：不能靠切模型绕合规）

**Dependencies**:
- Requires：A04 A05
- Enables：A11（历史报告记录拒绝事实）

**Acceptance Criteria**:

| ID | 标准 | 人类测试 | 系统内部验证 |
|----|------|---------|-------------|
| A08-1 | 拒绝显式状态 | 构造一条敏感引文 → 报告中出现 ⛔ 标签 | API 返回 `status == "REJECTED_BY_MOD"` |
| A08-2 | 独立统计 | 报告汇总含 `moderation_rejected_count` | 不与 error_count 合并 |
| A08-3 | 不自动重试 | 拒绝后任务继续处理下一条，不对本条重试 | 日志确认 |
| A08-4 | 提示人工 | 卡片有"建议人工核对"文案 | DOM 固定文案 |

---

### A09：客观置信度计算（MAS-1 / MAS-5 交叉）

**Level**: Primary
**Action Enabled**: 每条校对结果附置信度（0-1），**非 AI 自评，而是由客观指标计算**
**MVP 状态**: ⚠️ 不合规——当前直接从 AI 响应 JSON 的 `confidence` 字段取值（`proofreader.py:577`）

**客观指标组合**（v1.0 新建）:

| 指标 | 权重 | 说明 |
|------|-----|------|
| 原文命中准确度 | 0.4 | 引文在 source 中精确/模糊匹配度 |
| 跨模型一致性（可选） | 0.3 | 第二模型（如通义）给同一判断的比例（超预算时关闭） |
| 上下文相符性证据密度 | 0.2 | 引文前后匹配度 + 参考文献章节定位命中 |
| 引文长度/结构特征 | 0.1 | 长引文 + 书名号明确 → 更高置信 |

> **规约约束**（硬性）: AI 模型的自评 `confidence` 字段**仅作参考输入**，不可作为最终置信度（real.md #2）。

**Environmental Properties**:

| 属性 | 值 | 可感知者 |
|------|---|---------|
| 视觉线索 | 置信度以百分比 + 小条形图呈现；鼠标悬停显示各分项 | 人类 |
| 语义标记 | `confidence: float`（0-1）+ `confidence_components: {...}` | 双 |

**Constraints**:
- `confidence` 字段的计算代码必须**独立于 AI 响应解析代码**（代码隔离）
- 跨模型一致性计算可关闭（超预算时），但需在报告中说明"本次未进行跨模型校验"

**Dependencies**:
- Requires：A04（校对结果）+ A07（多版本匹配得分）
- Enables：A10（版本冻结需记录计算公式版本）

**Acceptance Criteria**:

| ID | 标准 | 人类测试 | 系统内部验证 |
|----|------|---------|-------------|
| A09-1 | 非自评 | — | 代码中不存在 `confidence = ai_response["confidence"]` 赋值 |
| A09-2 | 分项可见 | 悬停显示 4 项分数 | API 返回 `confidence_components` |
| A09-3 | 计算版本戳 | 报告含"置信度算法 v1" | API 返回 `confidence_algo_version` |
| A09-4 | 跨模型关闭的说明 | — | 关闭时 `confidence_components.cross_model` 为 null + 报告脚注说明 |

---

### A10：报告版本冻结（MAS-5 核心）

**Level**: Primary
**Action Enabled**: 报告生成瞬间，其模型 + prompt + 参考版本 + 置信度算法版本被**数据库层级冻结**
**MVP 状态**: ❌ 全新

**Environmental Properties**:

| 属性 | 值 | 可感知者 |
|------|---|---------|
| 视觉线索 | 报告顶部"版本戳"卡片（可折叠），详述冻结的各项版本 | 人类 |
| 语义标记 | 报告 JSON 含 `version_snapshot: {...}` | 双 |
| 交互模式 | 只读 | 人类 |

**冻结三元组**（最小信息集）:
```json
{
  "model_id": "deepseek-ai/DeepSeek-V3.2",
  "model_snapshot_date": "2026-04-18",
  "prompt_versions": {
    "extract": "sha256:...",
    "verify":  "sha256:...",
    "map":     "sha256:..."
  },
  "source_refs_hash": "sha256:...",
  "confidence_algo_version": "v1.0",
  "frozen_at": "2026-04-18T14:22:10Z"
}
```

**Constraints**:
- 数据库层使用**只读约束**（如 PostgreSQL `GENERATED ALWAYS AS` 或审计表模式）
- 运维层禁止脚本批量重跑历史任务以"改善结果"（notes #7）
- Prompt 文件变更时触发 hash 自动更新，旧报告不受影响

**Dependencies**:
- Requires：A04 A06 A09
- Enables：A11 A12

**Acceptance Criteria**:

| ID | 标准 | 人类测试 | 系统内部验证 |
|----|------|---------|-------------|
| A10-1 | 版本戳卡片可见 | 报告顶部 / 导出文件首页含版本戳 | — |
| A10-2 | 数据库不可改 | 尝试 UPDATE 版本戳字段失败 | 约束触发 |
| A10-3 | prompt 更新不影响旧 | 修改 prompt 后查询旧报告版本戳不变 | 自动化测试 |
| A10-4 | 冻结时间 UTC | — | `frozen_at` 字段为 ISO 8601 UTC |

---

### A11：历史报告列表

**Level**: Primary
**Action Enabled**: 用户查看自己所有历史报告，按时间 / 书稿 / 版本筛选
**MVP 状态**: ❌ 未实现（MVP 任务结束即销毁）

**Environmental Properties**:

| 属性 | 值 | 可感知者 |
|------|---|---------|
| 视觉线索 | 报告列表表格：时间 + 书稿名 + 版本戳缩写 + 状态 + 查看按钮 | 人类 |
| 语义标记 | `GET /api/reports?user_id=...&from=...&to=...` | 双 |
| 交互模式 | 列表 / 筛选 / 分页 | 人类 |

**Constraints**:
- 列表中只显示用户自己的报告（权限隔离）
- 已销毁的**原始上传文件**不影响报告本身的访问（MAS-6 关键设计）
- 支持"同书稿多次校对"的并列展示——不覆盖

**Dependencies**:
- Requires：A10
- Enables：A12

**Acceptance Criteria**:

| ID | 标准 | 人类测试 | 系统内部验证 |
|----|------|---------|-------------|
| A11-1 | 列表可见 | 登录后看到历史报告列表 | API 返回数组 |
| A11-2 | 权限隔离 | 用户 A 看不到用户 B 的报告 | 后端 SQL 带 user_id 过滤 |
| A11-3 | 原文销毁后仍可看报告 | 7 天后原文已销毁，报告仍可打开 | 数据库报告表与上传文件表分离 |
| A11-4 | 同书稿多版本并列 | 对同书发起两次校对 → 列表中两条并存 | — |

---

### A12：导出（含版本戳）

**Level**: Primary
**Action Enabled**: 将报告导出为 Word / CSV 文件，文件中包含版本戳
**MVP 状态**: ⚠️ 已有（`routes.py:320-426`）但不合规：
- CSV 三维度合并为"问题描述"（违反 notes #6）
- 无版本戳（违反 notes #7）

**Environmental Properties**:

| 属性 | 值 | 可感知者 |
|------|---|---------|
| 视觉线索 | 报告页面右上角"导出"下拉菜单（Word / CSV） | 人类 |
| 语义标记 | `GET /api/export/{task_id}?format=docx` | 双 |
| 交互模式 | 点击 → 下载 | 人类 |

**文件结构约束**（v1.0 重构）:

**CSV 列（必拆分）**:
```
序号 | 引用文字 | 所在段落 | 字词准确性 | 字词问题 | 解释一致性 | 解释问题 |
上下文相符性 | 上下文问题 | 参考匹配状态（MATCH/NOT_MATCH/NOT_FOUND_IN_REF） | 参考定位 | 置信度 | 置信度分项 | 审核状态 | 综合建议
```

**Word 文档结构**:
- 首页：版本戳卡片（模型 / prompt / 语料库 / 置信度算法）+ 统计摘要（总条数 / 三维度各自问题数 / 不符合数 / 未找到数 / 拒绝数）
- 正文：每条引用一个表格（三列：字词 / 解释 / 上下文）+ AI 建议 + 编辑判定空行
- 附录：参考文献清单 + 任务元信息

**Constraints**:
- CSV 使用 UTF-8 BOM（MVP 已做，保留）
- 文件头/页眉必含版本戳
- **不得输出综合评分列**

**Dependencies**:
- Requires：A10 A11

**Acceptance Criteria**:

| ID | 标准 | 人类测试 | 系统内部验证 |
|----|------|---------|-------------|
| A12-1 | CSV 三维度分列 | Excel 打开见独立三列 | 代码 review |
| A12-2 | Word 版本戳 | 首页显式版本戳卡片 | 模板合规 |
| A12-3 | 无综合评分 | grep `总分 / overall_score` 无结果 | 自动化 |
| A12-4 | 下载文件名含 task_id + frozen_at | — | 格式固定 |

---

### 3.13 Secondary / Latent Affordances（简表）

| ID | Affordance | Level | 说明 | MVP 状态 |
|----|-----------|------|------|---------|
| A13 | 中止任务 | Secondary | 运行中可主动取消 | ❌ |
| A14 | 恢复/断点续跑 | Secondary | 服务重启后从检查点继续（notes #4） | ❌ |
| A15 | 修改建议"一键复制" | Secondary | 编辑可复制 AI 候选文字到 Word | ✅ 浏览器默认复制 |
| A16 | 主动立即删除 | Secondary | 任务完成后用户可提前销毁（MAS-6） | ❌ |
| A17 | 脚注识别 | Secondary | 识别"带脚注的引用"（cog.md 引文分类） | ⚠️ 部分 |
| A18 | 分章切分 | Secondary | 校对结果按章节归组呈现 | ✅ 后端解析已支持 |
| A19 | 用户协议弹窗 | Secondary | 首次使用 / B 端机构版强制弹窗（MAS-6） | ❌ |
| A20 | 个人 vs 机构版差异化交互 | Latent | 同 affordance 集合，差异皮肤（详见 §5） | ❌ |
| A21 | OpenAPI 文档 | Latent | 为 agent 友好预留（MAS-候选-7 最小预留） | ❌ |

---

## 4. 环境约束（Environmental Constraints）

### 4.1 物理约束

| 约束 | 值 | 对 affordance 的影响 |
|------|---|--------------------|
| 文件体积上限 | 50MB/份 | A01 A02 硬拦截 |
| 支持格式 | docx / pdf / md / txt / epub | A01 A02 白名单 |
| 单任务并发 | 2 条同时校对（硅基流动限流） | A04 A05 节奏 |
| 模型上下文 | DeepSeek-V3.2 最大约 64K | A02 原文检索层必需 |
| SSE 最长时长 | 30 分钟/连接（可重连） | A05 需支持重连 |

### 4.2 结构约束（cog.md 实体映射）

> cog.md 的 7 类实体必须在数据模型 + API 中作为一等公民体现，不得仅作"任务内部临时变量"。

| cog 实体 | 数据库表 | 对应 affordance |
|---------|---------|----------------|
| 用户 | `users(id, role, email, ...)` | A11 权限 |
| 书稿 | `manuscripts(id, user_id, task_id_primary, stored_path, filename_hashed, uploaded_at)` | A01 |
| 段落 | `paragraphs(id, manuscript_id, idx, text_hash, chapter, ...)` | A05 A06 内部 |
| 引文 | `quotes(id, paragraph_id, quote_text_hash, source_work, location_hint, ...)` | A06 A07 A08 |
| 参考文献 | `references(id, user_id, canonical_name, version_role, stored_path, filename_hashed, ...)` | A02 A07 |
| 校对任务 | `tasks(id, manuscript_id, status, cost_so_far, frozen_at, ...)` | A04 A05 A10 |
| 校对结果 | `verifications(id, task_id, quote_id, reference_id, verdict_*, confidence, confidence_components, status_enum, ...)` | A06 A07 A08 A09 |

**关键关系**（来自 cog.md）:
- 用户 1:N 书稿 1:N 校对任务 1:N 校对结果
- 引文 N:N 参考文献（通过校对结果作为连接实体）
- 书稿 M:N 参考文献（一部书稿关联多版本原典）

**命名规约**: 数据库字段使用 `snake_case`，API 响应字段使用 `snake_case`，前端内部转 `camelCase`。

### 4.3 安全 / 合规约束（real.md + notes 映射矩阵）

| 源约束 | 对应 affordance / non-affordance | 实现位置 |
|--------|------------------------------|---------|
| real.md #1 AI 只给提示不改稿 | A06 卡片固定"AI 建议"文案 + 不自动写回原稿 | 前端 UI + 后端无写回接口 |
| real.md #2 证据链不得自评 | A09 客观置信度 | 独立计算模块 |
| real.md #3 保密 + TTL 删除 | A16 主动删除 + MAS-6 | 定时任务 + 日志过滤 |
| real.md #4 异文 ≠ 错误 | A07 用 "不符合参考文献"（中性措辞，不自动判错） | MAS-2 全部 + prompt 措辞规约 |
| real.md #5 版权责任在用户 | A19 用户协议 + 不预置校点本 | 代码不内置版权资源 |
| real.md #6 成本上限 + 二次确认 | A03 A04 | MAS-4 全部 |
| real.md #7 版本锁定 | A10 报告版本冻结 | MAS-5 全部 |
| notes #1 模型拒绝不得伪造通过 | A08 显式拒绝状态 | MAS-3 全部 |
| notes #2 日志不含原文 | LoggerFilter 强制 | 基础设施 |
| notes #3 文史字符工程 | OpenCC + CJK Ext B-G + 异体字表 | 解析层 |
| notes #4 长任务不可丢 + 幂等 | A14 断点续跑 + 幂等 key | 任务队列 + DB |
| notes #5 话术：辅助而非替代 | A06 "AI 建议请人工复核" | UI 文案规约 |
| notes #6 禁用总分 | A06 A12 | 全链路禁用 |
| notes #7 报告不可变快照 | A10 A11 | 数据库约束 |

---

## 5. 感知通道（Perception Channels）

### 5.1 人类视觉 affordance（UI 设计约束）

| 元素 | 形式 | 不可协商的设计原则 |
|------|------|-----------------|
| 引用卡片 | 三栏并列（字词/解释/上下文），每栏独立状态 chip | 禁止合并为一列或一行总分 |
| 不符合参考文献 chip | ❌ 黄/橙色 chip，使用中性措辞"不符合参考文献" | **禁用**"错误/有误/误引"字眼 |
| 参考未找到 chip | ❓ 灰色 chip，措辞"参考文献中未找到对应段落" | 与"不符合"区分——这是"未能核校"而非"核校失败" |
| 拒绝标签 | ⛔ 灰色 chip | 与"校对失败"独立标识 |
| 置信度 | 百分比 + 细条形图，可悬停查看分项 | 禁止将 4 项合并为单一星级 |
| 版本戳 | 报告顶部可折叠卡片 | 在用户界面可见，非隐藏元信息 |
| AI 建议提示 | 每张卡片底部固定文案 | "AI 建议，请人工复核" — 不得被样式遮蔽 |

### 5.2 系统内部 AI 语义（API 契约约束）

v1.0 阶段虽然下游 agent 不是主要 agent，但 API 语义清晰本身是内部质量要求，也为 v1.1+ MAS-候选-7 留接口：

**响应字段命名**:
- 三维度字段独立：`verdict_text_accuracy` / `verdict_interpretation` / `verdict_context`
- 状态枚举字符串：`PASS / HAS_ISSUE / REJECTED_BY_MOD / NO_SOURCE / PARSE_ERROR / API_ERROR`
- 置信度结构化：`confidence` 顶级 + `confidence_components: {...}`

**错误码枚举**（HTTP 码之外的业务语义）:
```
E_UPLOAD_SIZE / E_UPLOAD_FORMAT / E_COST_NOT_CONFIRMED / E_TASK_NOT_FOUND /
E_MODERATION_REJECTED / E_NO_SOURCE_MATCHED / E_RATE_LIMIT / E_PROMPT_PARSE_FAIL
```

### 5.3 B 端 vs C 端差异化交互（§3.13 A20 展开）

> **设计决策**（对 meta.md 双用户定位的回应）：**同一 affordance 集合，差异化交互皮肤**，而非分裂为两个产品。

| affordance | C 端（个人付费/研究生） | B 端（出版社机构） |
|-----------|---------------------|-------------------|
| A02 参考文献关联 | 轻量，上传即用 | 可从机构共享库选 + 审批流 |
| A03 费用预估 | 显示个人账户余额 | 显示机构账户 + 部门归属 |
| A06 三维度呈现 | 同一 | 同一 |
| A11 历史报告 | 仅本人 | 含机构内共享（权限控制） |
| A16 主动删除 | 用户随时可 | 需机构管理员审批（审计留痕） |
| A19 用户协议 | 简化版（可选勾选） | 完整版（必须弹窗） |

**实现原则**: 共用 affordance 实现，用"角色配置"切换交互规则，避免维护两套代码。

---

## 6. 反馈机制（Feedback Mechanisms）

| 时窗 | 示例 affordance | 人类反馈 | 系统内部反馈 |
|------|---------------|---------|-------------|
| **< 100ms** 即时 | 文件选择 | 文件卡片出现 | — |
| **< 100ms** | 按钮点击 | 按钮状态切换（hover→active→disabled） | — |
| **< 1s** 渐进 | 上传进度 | 进度条 0-100% | 服务器 chunk 接收 |
| **< 1s** | SSE 首包 | 日志流首行出现 | SSE keepalive |
| **< 5s** 阶段 | 解析完成 | "共 XX 段 / XX 字" 气泡 | `parse_done` 事件 |
| **分钟级** 长任务 | 校对进度 | 每 5 条完成更新一次 | `verify_progress` 携带 `verified_count / total` |
| **任务终态** | 完成/失败/拒绝 | 通知（可声音提醒）+ 跳转报告 | `finished` 事件含 result 摘要 |

**SSE 事件类型完整枚举**（v1.0 规范化 MVP 的非结构化日志）:

```
parse_start / parse_progress / parse_done
extract_start / extract_progress / extract_done
verify_start / verify_progress / verify_done
cost_update (cost_so_far)
moderation_rejected (quote_id)
warning (type, message)
error (type, message)
heartbeat (当无其他事件时每 10s 一次)
finished (result_summary)
cancelled
```

---

## 7. Affordance 验收总表

（各 Primary affordance 的验收标准已在 §3 分条给出，此节为索引）

| Affordance | 验收条目数 | 位置 |
|-----------|-----------|------|
| A01 上传书稿 | 5 | §3.1 |
| A02 多版本参考关联 | 5 | §3.2 |
| A03 费用预估 | 4 | §3.3 |
| A04 发起任务 | 3 | §3.4 |
| A05 SSE 进度 | 4 | §3.5 |
| A06 三维度独立 | 5 | §3.6 |
| A07 不符合参考标记 | 7 | §3.7 |
| A08 拒绝标记 | 4 | §3.8 |
| A09 客观置信度 | 4 | §3.9 |
| A10 版本冻结 | 4 | §3.10 |
| A11 历史列表 | 4 | §3.11 |
| A12 导出 | 4 | §3.12 |

---

## 8. 非 Affordance（Explicitly Prevented Actions）

> 以下动作**系统不支持**、**不应支持**，规约显式列出以防实现时被"顺手加上"。

| # | 不支持的动作 | 原因 | 约束源 |
|---|-----------|------|-------|
| N01 | AI 直接修改书稿原文 | AI 幻觉 + 编辑盲信 = 错误印成书 | real.md #1 |
| N02 | AI 自评置信度作为最终置信度 | 自评不可审计 | real.md #2 |
| N03 | 展示"综合评分 / 总分 / 通过率" | 简化误导 | notes #6 |
| N04 | 预置受版权保护的现代校点本 | 版权红线 | real.md #5 |
| N05 | 后台自动用新模型重跑历史任务 | 违反版本锁定 | real.md #7 + notes #7 |
| N06 | 宣传文案中使用"自动校对 / 取代人工 / 解放编辑" | 文史圈话语权红线 | notes #5 |
| N07 | 日志打印书稿原文片段 | 日志泄露 = 全量泄露 | notes #2 |
| N08 | 拒绝后自动切换模型重试 | 合规绕过 | notes #1 + #7 |
| N09 | 引文与参考不符被系统自动标为"错误" / "有误" | 专业性红线——判错权在编辑，不在系统 | real.md #4 |
| N10 | 不带幂等 key 的 API 调用 | 重试风暴 → 数倍扣费 | notes #4 |
| N11 | 任务状态仅存内存 | 崩溃即丢数据 | notes #4 |
| N12 | 原文/参考文献用于模型训练 | 保密红线 | real.md #3 |

---

## 9. 技术实现锚点

### 9.1 前端 affordance 渲染

| affordance | 组件 | 关键设计 |
|-----------|------|---------|
| A01 A02 | `UploadZone` | 支持拖拽 + 版本角色下拉 |
| A03 | `CostEstimateCard` + `ConfirmModal` | 阻塞式对话框 |
| A05 | `ProgressView` + `SSELogStream` | 三段式进度条 |
| A06 | `QuoteVerdictCard`（三栏 Grid）| **严禁合并为单栏** |
| A07 | `ReferenceMatchCard`（字词维度内嵌）| 三态 chip + diff 高亮 + 中性措辞；**不**使用抽屉形式（避免"多版本候选"的过度设计） |
| A08 | `ModerationChip` | 醒目独立颜色 |
| A09 | `ConfidenceBar` + `ConfidenceTooltip` | 悬停显示 4 分项 |
| A10 | `VersionStampBanner` | 报告顶部固定 |
| A11 | `ReportListTable` | 筛选 + 分页 |
| A12 | `ExportMenu` | Word / CSV 按钮 |

### 9.2 后端 affordance 支撑

| 模块 | 职责 | MVP 资产迁移 |
|------|-----|-------------|
| **任务编排** | 创建/调度/状态持久化任务 | 重写（MVP 用内存） |
| **文件解析** | docx / pdf / md / txt / epub | ✅ 迁移 `file_parser.py` |
| **引用提取** | 逐段 LLM 提取 | ✅ 迁移 `proofreader.extract_quotes_per_paragraph` + `extract_quotes_prompt.txt` |
| **源映射** | 归一化 source_work + 匹配参考文献 | ✅ 迁移 `map_sources_with_llm` + `map_sources_prompt.txt` + `_BOOK_NAME_ALIASES` |
| **语料库抽象** | `SourceCorpusProvider` 接口 | ❌ 全新，但可内嵌旧匹配逻辑为默认实现 |
| **校对判定** | 三维度判定 + 客观置信度 | ⚠️ 迁移 `verify_quote_prompt.txt` 但需修订措辞（移除"错误/有误"，改为"不符合参考" — MAS-2 约束）；客观置信度模块全新 |
| **费用估算** | 任务预估 + 运行中追踪 | ❌ 全新 |
| **拒绝检测** | 模型响应拒绝识别 | ❌ 全新 |
| **版本冻结** | Hash prompt + 冻结版本戳 | ❌ 全新 |
| **数据保密** | TTL 销毁 + 日志脱敏 | ⚠️ TTL 需增强；日志脱敏全新 |

### 9.3 基础设施

**短期（过渡）**:
- SQLite + Redis 轻量任务队列（如 rq）
- 单体部署（当前架构延续）

**v1.0 目标**:
- PostgreSQL（支持校对结果只读约束）
- Celery / Arq 任务队列（notes #4 长任务持久化）
- Sentry（PII scrubber 配置）
- 文件存储：本地为主；可配置为 S3 兼容（不强制上云）

### 9.4 MVP → v1.0 资产迁移清单

| MVP 资产 | 去向 | 说明 |
|---------|------|------|
| `app/prompts/extract_quotes_prompt.txt` | `prompts/v1/extract.txt` | 版本化 |
| `app/prompts/verify_quote_prompt.txt` | `prompts/v1/verify.txt` | 版本化；输出字段 JSON 结构保留 |
| `app/prompts/map_sources_prompt.txt` | `prompts/v1/map.txt` | 版本化 |
| `_BOOK_NAME_ALIASES` 字典 | `corpus/book_aliases.py` | 扩充 + 外移 |
| `_normalize_source_work` | `corpus/normalize.py` | 保留函数 |
| `_match_source_work_to_file` | `corpus/match.py` | 作为 `UserUploadedCorpus` 内部实现 |
| `verify_quote` 的输出 JSON 结构 | 核心数据模型 | 字段名保留 |
| `file_parser.py` | `parsers/` | 加 OpenCC + CJK Ext 支持 |
| SSE 实现 | 事件类型结构化后保留 | `routes.py:258-317` |
| 429 重试逻辑 | 保留 | 配幂等 key |
| `_make_error_result` | 拆分为 `moderation_rejected_result` / `api_error_result` / `parse_error_result` | MAS-3 硬要求 |

---

## 10. 附录

### 10.1 术语表

| 术语 | 含义 |
|------|------|
| **Affordance** | 环境属性与 agent 行动能力的关系；"这个环境能做什么" |
| **MAS（Minimum Affordance Story）** | 最小 affordance 故事——一条完整的"感知→行动→转化→反思"意义闭环 |
| **三维度** | 字词准确性 / 解释一致性 / 上下文相符性 |
| **版本异文**（概念背景） | real.md #4 提出的历史术语——引文与某权威版本不一致但与另一版本一致。v1.0 实现**不识别"异文"作为独立状态**，而是通过"系统不越权判错、只报'不符合参考'"来守住 real.md #4 的专业性红线——是打字错误还是版本差异，由编辑基于其选定的权威参考自行判断 |
| **参考文献为准绳** | 编辑上传的参考文献即本次核校的权威绳尺；系统只报"符合 / 不符合 / 未找到"，不替编辑判"对 / 错" |
| **证据链** | 原文定位 + AI 判断理由 + 客观置信度 + 版本戳 |
| **版本冻结** | 报告生成瞬间锁定模型+prompt+语料+算法版本，事后不可修改 |
| **语料库接口** | `SourceCorpusProvider` 抽象；v1.0 只实现 `UserUploadedCorpus` |

### 10.2 Usability → Affordance 映射表

| 传统概念 | Affordance 等价 |
|---------|----------------|
| 特性（feature） | Affordance（行动可能性） |
| 用户流（user flow） | Affordance 序列 |
| UI 元素 | Affordance signifier |
| 交互设计 | 感知-行动耦合 |
| 错误提示 | 约束反馈 |
| 帮助文案 | Affordance 澄清 |
| 加载状态 | 渐进式 affordance |

### 10.3 MVP → v1.0 迁移清单（简表）

**保留资产（直接复用）**：
- 三份 prompt 文件
- `_BOOK_NAME_ALIASES` 书名映射
- 文件解析（python-docx / pdfplumber / ebooklib）
- SSE 骨架
- DOCX/CSV 导出骨架
- 三维度 JSON 结构

**重构资产（改接口不改核心）**：
- `_make_error_result` → 拆分三类错误
- CSV 导出字段 → 三维度分列
- `file_parser` → 加 OpenCC + CJK Ext

**新建资产（v1.0 全新）**：
- 任务持久化层
- `SourceCorpusProvider` 抽象
- 客观置信度模块
- 费用预估 + 追踪
- 拒绝检测
- 版本冻结机制
- TTL 销毁 + 日志脱敏
- 用户协议弹窗

### 10.4 本规约需显式暴露的盲区（中度盲区清单）

本规约正文已穿插指出；此处集中索引：

1. **`_make_error_result` 语义混淆** → MAS-3 / A08 / N08 拆解
2. **置信度 AI 自评违反 real.md #2** → A09 全新模块
3. **任务内存存储违反 notes #4** → §9.3 硬重构
4. **日志脱敏缺失（`routes.py` 多处 `logger.info`）** → MAS-6 / §9.2 数据保密模块
5. **CSV 导出合并三维度（`routes.py:378-390`）违反 notes #6** → A06 A12 强制拆列
6. **AI agent 作为感知主体缺位** → MAS-候选-7 留接口
7. **参考文献作为准绳的中性语义缺位**（MVP 直接用"错误/有误/误引"越权判错，破坏 real.md #4） → MAS-2 以"符合/不符合"中性措辞重塑 + prompt 文案迁移 + A07 显式三态标记
8. **B 端 vs C 端 affordance 分化** → §5.3 差异皮肤策略
9. **任务持久化缺失导致崩溃即丢** → §9.2 / §9.3
10. **无幂等 key 导致重试风暴扣费** → N10 硬禁止

### 10.5 引用源文件

| 文件 | 本规约引用位置 |
|------|--------------|
| `.42cog/meta/meta.md` | §1 环境描述 / §10.3 里程碑 |
| `.42cog/cog/cog.md` | §4.2 实体映射 / cog.md:66-73 三维度定义 |
| `.42cog/real/real.md` | §4.3 约束矩阵 / §8 非 affordance |
| `notes/260417-engineering-and-ethics-notes.md` | §4.3 / §8 / §9.2 |
| `origin/app/services/proofreader.py` | §9.4 迁移清单 + 多处行号引用 |
| `origin/app/api/routes.py` | §9.4 + 盲区 #5 |
| `origin/app/prompts/*.txt` | §9.4 核心迁移资产 |
| `.42plugin/42edu/pm-product-requirements/SKILL.md` | 方法论基础 |

---

## 11. Quality Checklist（SKILL.md 要求自检）

- [x] 核心 affordance 清晰定义（§1.4 总览 + §3 详目 12 条）
- [x] 每个 affordance 指明启用的动作（§3 "Action Enabled"）
- [x] 人类 + AI 双通道感知定义（§3 Perception-Action Coupling + §5）
- [x] 反馈机制闭合感知-行动回路（§6）
- [x] 环境约束来自 real.md（§4.3 映射矩阵）
- [x] 验收标准测试 affordance 可感知性（§3 / §7）
- [x] 非 affordance 显式列出防止混淆（§8，12 条）
- [x] Agent 能力与 affordance 需求匹配（§1.3 / §3 Agent Requirements）

---

## 12. 下一步

本规约为静态文档；后续触发的下游 skill：

| skill | 输入 | 产出 |
|-------|------|-----|
| `pm-user-story` | 本规约 §2 的 6 个 MAS | `spec-user-story.md`（每个 MAS 展开为具体 scenario） |
| `dev-system-architecture` | 本规约 §3 §4 §9 | `spec-system-architecture.md`（组件图 / 时序图 / 技术栈决策） |
| `dev-database-design` | 本规约 §4.2 cog 实体映射 | `spec-database-design.md`（表结构 / 索引 / 约束） |
| `dev-quality-assurance` | 本规约 §3 验收标准 + §7 | `spec-qa.md`（测试用例） |

**里程碑追踪**: 本规约进展已记录于 `.42cog/work/milestones.md`。

---

**Last Updated**: 2026-04-18
**Document Version**: v1.0-draft
**Maintainer**: yubo（初稿由 `pm-product-requirements` skill 协助生成）
