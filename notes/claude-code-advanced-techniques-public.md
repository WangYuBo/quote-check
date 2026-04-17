# Claude Code 高级对话技巧

> 从实战中提炼的进阶方法论，让 AI 成为你真正的协作伙伴

本文档总结了高效使用 Claude Code 的进阶技巧，这些技巧经过大量实战验证，能显著提升 AI 辅助开发的效率和质量。

---

## 一、文档驱动开发

### 1.1 链式文档生成

**核心思想**：先生成"权威文档"，再用它作为标准生成下游文档。

```
project-overview.md (权威源)
    ↓ 参考生成
requirements.md + constraints.md
    ↓ 参考生成
product-spec.md (产品需求)
    ↓ 参考生成
system-architecture.md (系统架构)
    ↓ 参考生成
database-design.md (数据库设计)
```

**实战示例**：

```
请参考已有的 Claude Skill：docs/skills/system-architecture/SKILL.md

生成系统架构文档：spec/system-architecture.md

注意参考：
- docs/project-overview.md
- docs/constraints.md
- docs/requirements.md
- spec/product-spec.md
```

**为什么有效**：
- 每一层文档都基于上一层，保证一致性
- AI 有明确的参考标准，输出质量更高
- 形成可追溯的文档体系

### 1.2 生成后校验模式

**核心思想**：生成文档后，立即让 AI 用它校验其他相关文档。

**实战示例**：

```
根据我刚才的修改过程，参考最终定稿：
docs/project-overview.md

检查以下文件是否还有需要修改的地方：
- docs/constraints.md
- docs/requirements.md
- spec/product-spec.md
- spec/system-architecture.md
- spec/database-design.md
```

**为什么有效**：
- 单点修改，全局同步
- 避免文档间出现不一致
- AI 自动发现并修复遗漏

### 1.3 规约驱动开发

**核心思想**：先写规约文档，再根据规约反向创建代码结构。

**实战示例**：

```
根据 spec/system-architecture.md
在 src/ 目录下，我应该生成哪几个目录？
```

然后：

```
根据修正后的目录名（my-database），
同步更新 spec/system-architecture.md
```

**为什么有效**：
- 先设计后实现，架构更清晰
- 规约文档成为"单一真相源"
- 代码与文档始终保持同步

---

## 二、知识固化策略

### 2.1 从工作流提炼 Rule

**核心思想**：完成一项任务后，将经验总结成 `.claude/rules/` 规则。

**实战示例**：

```
根据上述对话过程中的修改，整理成 rule，方便未来 Claude Code 记住：
- 技术栈命名约定（具体产品名，不是泛称）
- 产品定位规则（平台定位，不是特定工具）
- 文档一致性规则（修改时需同步哪些文件）
```

**Rule 文件示例**：

```markdown
# .claude/rules/naming-conventions.md

## 技术栈命名

| 正确 | 错误 |
|------|------|
| PostgreSQL (Supabase) | PostgreSQL |
| Redis (Upstash) | Redis |
| SQLite (Turso) | SQLite |
```

**为什么有效**：
- AI 永久记住项目特定规则
- 避免反复纠正相同错误
- 团队知识沉淀

### 2.2 反向创建 Skill

**核心思想**：从实际工作中提炼模式，创建新的 Skill 来标准化这类工作。

**实战示例**：

```
帮我基于上述对话过程，
参考 docs/skills/skill-template/SKILL.md
创建一个专门用于生成 rule 的 Claude Skill
```

**Skill 目录结构**：

```
.claude/skills/rule-creator/
├── SKILL.md                    # 主文件：规则创建指南
├── references/
│   └── rule-examples.md        # 实际规则示例
└── assets/templates/
    ├── naming-rule.md          # 命名约定模板
    └── consistency-rule.md     # 文档一致性模板
```

**为什么有效**：
- 将隐性知识显性化
- 可复用于同类项目
- 工作流程标准化

### 2.3 Skill 驱动生成

**核心思想**：使用预定义的 Claude Skill 来生成标准化输出。

**实战示例**：

```
请使用已经注册好的 Claude Skill：
.claude/skills/product-requirements/SKILL.md

生成产品需求规格书：spec/product-spec.md

注意参考：
- docs/project-overview.md（项目元信息）
- docs/constraints.md（现实约束）
- docs/requirements.md（功能需求）
```

**为什么有效**：
- 输出格式标准化
- AI 有明确的生成指南
- 质量稳定可控

---

## 三、约束分层策略

### 3.1 约束优先级分层

**核心思想**：将约束分为核心/次要/备选，重点强调 AI 容易忽略的。

**实战示例**：

```
优化 docs/constraints.md

保留最核心的四条约束、三条次要约束，其他的作为备选约束

关键：侧重 AI coding 时不太清楚的，但在现实生活中又很重要的
```

**约束分层示例**：

```markdown
## 核心约束（4条）— AI 很难自己想到的

1. **合规红线** — 内容审核是项目生死线
2. **核心功能策略** — 哪个功能优先，哪个是次要
3. **竞争意识** — 壁垒在哪里，如何差异化
4. **国际化基因** — 从第一行代码就要考虑 i18n

## 次要约束（3条）— AI 可能低估重要性的

1. **极速体验** — 秒级响应
2. **基础设施级稳定** — 不轻易报错
3. **AI 原生开发** — 代码由 AI 生成

## 备选约束 — 技术细节，AI 能处理好的
```

**为什么有效**：
- AI 不知道的业务约束被显式声明
- 避免 AI 在技术细节上浪费篇幅
- 约束文档更聚焦、更有价值

---

## 四、架构决策模式

### 4.1 先讨论后执行

**核心思想**：重大决策前先征求 AI 意见，确认方向后才开始执行。

**实战示例**：

```
在思考，是否将数据处理模块从主数据库中分离出来。
这样数据库更干净。

也就是用一个本地的 SQLite 数据库专门做数据处理、分析、打分等工作。
离线处理即可。等它做完了，才同步到主数据库里面。

不过的确有些增加复杂度了，我再仔细想一想。

你的建议呢？
```

AI 给出分析后：

```
确认这个方向。只是，这个 SQLite，请与 CLI 的 SQLite 分开。
```

**为什么有效**：
- AI 提供利弊分析，帮助决策
- 人保留最终决策权
- 决策过程有记录可追溯

### 4.2 一步一步引导配置

**核心思想**：复杂配置任务让 AI 引导，每一步等待用户提供信息。

**实战示例**：

```
一步一步帮我配置 GitHub OAuth
```

AI 引导流程：

```
### 第一步：创建 GitHub OAuth App

请在 GitHub 页面上：
1. 点击 "New OAuth App"
2. 填写以下信息：

| 字段 | 填写内容 |
|------|----------|
| Application name | your-app-name |
| Homepage URL | http://localhost:3001 |
| Authorization callback URL | http://localhost:3000/api/auth/callback/github |

---

请把你获取到的 Client ID 和 Client Secret 告诉我
```

用户提供信息后，AI 继续下一步配置。

**为什么有效**：
- 复杂任务拆解为可控步骤
- 敏感信息由用户手动提供
- 出错时容易定位问题

---

## 五、外部文档处理

### 5.1 粘贴文档求解读

**核心思想**：将官方文档直接粘贴给 AI，让它判断是否适用于当前场景。

**实战示例**：

```
[粘贴某认证库的 One-Time Token Plugin 文档]

这个满足我需求吗？还是用你推荐的 Device Authorization 插件？
这个插件是干嘛用的？
```

AI 会对比分析：

```
这是两个不同场景的插件：

| 特性 | One-Time Token | Device Authorization |
|------|----------------|----------------------|
| 适用场景 | 已登录用户跨域传递 session | 无浏览器设备的登录 |
| 前提条件 | 用户已登录 | 用户未登录 |
| 典型用例 | 从 a.com 跳转到 b.com | CLI、智能电视登录 |

结论：你的 CLI 场景应该用 Device Authorization 插件
```

**为什么有效**：
- AI 帮你消化官方文档
- 结合你的具体场景给建议
- 避免选错技术方案

### 5.2 参考 A 检查/优化 B

**核心思想**：用一个 Skill 或文档作为标准，去检查另一个是否符合规范。

**实战示例**：

```
使用 docs/skills/skill-template/SKILL.md
检查与优化 docs/skills/system-architecture/SKILL.md
```

或者更简洁：

```
其实只需要用 docs/skills/skill-template/SKILL.md 检查与优化一下即可
```

**为什么有效**：
- 有明确的检查标准
- AI 知道该检查什么
- 输出更聚焦

---

## 六、项目管理技巧

### 6.1 探索后生成 CLAUDE.md

**核心思想**：让 AI 探索项目后，为每个模块生成 CLAUDE.md 文件。

**实战示例**：

```
src/
分别探索这些项目。在每个项目下面，形成一个 CLAUDE.md 文件。
然后在 src 的根目录下面，也形成一个 CLAUDE.md 文件。
```

**为什么有效**：
- AI 自动理解项目结构
- 每个模块都有上下文文档
- 后续对话效率更高

### 6.2 清理冗余检查

**核心思想**：定期让 AI 检查目录下的文件是否有重复或冗余。

**实战示例**：

```
检查一下 src/my-database/
下的其他文件还有必要存在吗？或者是否可以合并精简？
```

AI 分析后：

```
## 清理建议

**删除的文件**：
- sync-lists.ts - 使用旧表名，已过时
- sync-http.ts - 与 sync.sh 功能重叠

**保留的文件**（共 5 个）：
- migrations/001_schema.sql
- .env.example
- CLAUDE.md
- README.md
- sync.sh
```

**为什么有效**：
- 保持代码库整洁
- 减少维护负担
- AI 能识别过时代码

### 6.3 同步更新关联文件

**核心思想**：修改一处后，要求 AI 检查并更新所有相关文件。

**实战示例**：

```
同步更新 src/my-api/、src/my-database/
下相关文件引用路径，例如这种：
Update `api/src/db/schema.ts` to match
```

**为什么有效**：
- 避免引用路径失效
- 一次性完成所有同步
- 减少遗漏

---

## 七、版本管理技巧

### 7.1 语义版本管理

**核心思想**：对 Skill 文件进行版本管理，旧版备份。

**实战示例**：

```
旧版备份，这个叫做新版
采取语义版本管理法（v0.0.0 格式）
```

结果：

```
.claude/skills/system-architecture/
├── SKILL.md           # v3.2 (新版)
├── SKILL.v3.1.md      # v3.1 (备份)
├── skill.zh.md        # v3.2 (新版)
└── skill.v3.1.zh.md   # v3.1 (备份)
```

**为什么有效**：
- 可以回退到旧版本
- 版本演进有迹可循
- 便于团队协作

### 7.2 模板层级机制

**核心思想**：为 Skill 设计模板子目录，支持不同类型项目。

**实战示例**：

```
根据 spec/system-architecture.md 反向创建一个新版的 Claude Skill

放在它下面，作为 template 子目录：fullstack
突出是：webapp+cli+backend+database 类应用的系统架构规约书模板
```

**目录结构**：

```
.claude/skills/system-architecture/
├── SKILL.md                    # 主技能文件
└── template/
    ├── fullstack/              # 全栈混合架构模板
    │   ├── SKILL.md
    │   ├── sys.spec.md
    │   └── README.md
    └── lite/                   # 轻量级架构模板
        ├── SKILL.md
        ├── sys.spec.md
        └── README.md
```

**为什么有效**：
- 同一 Skill 支持多种项目类型
- 模板可独立演进
- 使用时按需选择

---

## 八、深度思考触发

### 8.1 ultrathink 关键词

**核心思想**：复杂问题使用 `ultrathink` 触发 AI 深度分析。

**实战示例**：

```
这个模块的设计方案，请 ultrathink
```

或：

```
请 ultrathink，重新分析这段对话
找出那些非常聪明的技巧，普通人不太容易想到的
```

**为什么有效**：
- 触发 AI 更深入的思考
- 适合复杂决策和分析
- 输出更全面

---

## 九、即时纠偏技巧

### 9.1 精准纠错

**核心思想**：发现 AI 理解偏差时，立即精准纠正。

**实战示例**：

```
# 纠正术语
- 本地存储: SQLite (libSQL) 这里也错了，应该是 Turso

# 纠正范围
这条理解错误，不是这样的，现实约束是，整个项目面对的所有场景，
但目前刚开始更侧重某个平台而已

# 纠正操作
不是移动，而是复制。帮我回撤

# 纠正格式
语义版本管理法，是 v0.0.0 这样的格式
```

**为什么有效**：
- 错误不会累积
- AI 能立即修正
- 节省后续返工时间

### 9.2 回退与恢复

**实战示例**：

```
理解错误，帮我回退 docs/skills/xxx/SKILL.md 与 docs/skills/xxx/skill.zh.md
```

或：

```
docs/skills/xxx/SKILL.md 恢复回去
```

**为什么有效**：
- 错误操作可逆
- 不用担心试错成本
- 保护重要文件

---

## 十、快速参考表

| 场景 | 技巧 | 示例说法 |
|------|------|----------|
| 生成文档 | Skill 驱动 | "请使用已注册的 Skill：xxx 生成..." |
| 检查一致性 | 生成后校验 | "参考最终定稿 A，检查 B/C/D 是否需要修改" |
| 沉淀经验 | 提炼 Rule | "根据上述对话，整理成 rule" |
| 标准化工作流 | 反向创建 Skill | "基于上述过程，创建一个专门的 Skill" |
| 重大决策 | 先讨论后执行 | "你的建议呢？" → "确认这个方向" |
| 复杂配置 | 一步一步引导 | "一步一步帮我配置" |
| 理解外部文档 | 粘贴求解读 | "[粘贴文档] 这个满足我需求吗？" |
| 保持整洁 | 清理冗余 | "这下面的文件还有必要存在吗？" |
| 深度分析 | ultrathink | "请 ultrathink，分析..." |
| 纠正错误 | 精准纠偏 | "这里错了，应该是..." |
| 撤销操作 | 回退恢复 | "帮我回退" |

---

## 总结

高效使用 Claude Code 的核心在于：

1. **文档驱动** — 先规约后代码，链式生成，生成后校验
2. **知识固化** — 将经验沉淀为 Rule 和 Skill
3. **约束分层** — 聚焦 AI 不知道的业务约束
4. **架构先行** — 重大决策先讨论，确认后再执行
5. **即时纠偏** — 发现问题立即修正，错误不累积

这些技巧的本质是：**把 AI 当作协作伙伴，而不是执行工具**。你提供方向和约束，AI 提供能力和效率，双方互补才能发挥最大价值。
