# Chats 目录

> 存放与 AI 交互的提示词、对话记录和导出文件

## 目录用途

本目录用于存储项目开发过程中与 AI 的所有交互记录，包括：

1. **提示词模板**：发送给 AI 的结构化提示词
2. **对话记录**：与 AI 的完整对话导出
3. **关键决策**：通过 AI 对话做出的重要技术决策
4. **问题解决**：使用 AI 解决问题的过程记录

## 推荐的文件组织方式

```
chat/
├── prompts/              # 提示词模板
│   ├── feature-*.md      # 功能开发提示词
│   ├── debug-*.md        # 调试问题提示词
│   └── refactor-*.md     # 重构代码提示词
├── conversations/        # 对话记录
│   ├── 2024-12-06-*.md   # 按日期命名的对话
│   └── archived/         # 归档的旧对话
├── decisions/            # 技术决策记录
│   └── *.md              # 重要决策文档
└── README.md             # 本文件
```

## 文件命名规范

### 提示词文件
```
prompts/[类型]-[功能]-[日期].md

示例：
- prompts/feature-user-auth-20241206.md
- prompts/debug-api-error-20241206.md
- prompts/refactor-database-20241206.md
```

### 对话记录文件
```
conversations/[日期]-[主题].md

示例：
- conversations/20241206-implement-login.md
- conversations/20241206-fix-performance-issue.md
- conversations/20241207-design-database-schema.md
```

### 技术决策文件
```
decisions/[决策主题]-[日期].md

示例：
- decisions/choose-auth-library-20241206.md
- decisions/database-migration-strategy-20241206.md
```

## 对话记录模板

创建新的对话记录时，建议使用以下模板：

```markdown
---
date: YYYY-MM-DD
topic: [对话主题]
ai_model: [使用的AI模型，如 Claude Sonnet 4.5]
status: [进行中/已完成/待续]
---

# [对话主题]

## 背景

[简要说明为什么需要这次对话]

## 目标

- [ ] 目标1
- [ ] 目标2
- [ ] 目标3

## 对话内容

### 第一轮

**我的提示词：**
[粘贴你的提示词]

**AI 回复：**
[粘贴 AI 的回复]

### 第二轮

**我的提示词：**
[继续记录]

**AI 回复：**
[继续记录]

## 关键收获

- 收获1
- 收获2
- 收获3

## 后续行动

- [ ] 行动1
- [ ] 行动2

## 相关文件

- [链接到相关代码文件]
- [链接到相关文档]
```

## 提示词模板示例

### 功能开发提示词

```markdown
---
type: feature
feature: [功能名称]
date: YYYY-MM-DD
---

# 功能开发：[功能名称]

## 上下文

请阅读以下文件以了解项目背景：
- .42cog/real/real.md（现实约束）
- .42cog/cog/cog.md（认知模型）
- .42cog/spec/[相关规约].md

## 需求

[详细描述功能需求]

## 约束条件

[列出必须遵守的约束]

## 期望输出

- [ ] 代码实现
- [ ] 测试用例
- [ ] 文档更新
```

### 调试问题提示词

```markdown
---
type: debug
issue: [问题描述]
date: YYYY-MM-DD
---

# 调试：[问题描述]

## 问题现象

[详细描述问题]

## 错误信息

```
[粘贴错误日志]
```

## 相关代码

[指出问题可能相关的代码文件]

## 已尝试的方案

1. 方案1 - 结果：失败
2. 方案2 - 结果：部分有效

## 期望帮助

[说明希望 AI 提供什么帮助]
```

## 使用建议

### 1. 及时记录

- ✅ **立即记录**：对话结束后立即保存记录
- ✅ **完整导出**：使用 Claude Code 的导出功能保存完整对话
- ✅ **标注重点**：在对话中标注关键决策和重要代码

### 2. 定期整理

- 📅 **每周整理**：将零散的对话归档到对应目录
- 📅 **每月回顾**：回顾重要决策，更新文档
- 📅 **季度清理**：归档过时的对话记录

### 3. 知识沉淀

- 📝 **提取模式**：从对话中提取可复用的提示词模板
- 📝 **总结经验**：将成功的对话模式文档化
- 📝 **更新技能**：将常用提示词转化为 `.42plugin` 技能

### 4. 团队协作

- 👥 **分享提示词**：将有效的提示词分享给团队
- 👥 **记录决策**：重要技术决策要有完整的对话记录
- 👥 **知识传承**：新成员可以通过对话记录快速了解项目

## 导出对话的方法

### Claude Code (Zed)

1. 在对话窗口中，点击右上角的菜单
2. 选择 "Export Conversation"
3. 保存为 Markdown 格式
4. 移动到 `chat/conversations/` 目录

### Claude Web

1. 点击对话右上角的 "..." 菜单
2. 选择 "Export"
3. 选择 Markdown 格式
4. 保存到 `chat/conversations/` 目录

### 其他 AI 工具

- **Cursor**：使用 Cmd/Ctrl + Shift + E 导出对话
- **GitHub Copilot Chat**：复制对话内容，手动保存为 Markdown

## 注意事项

### ⚠️ 隐私和安全

- ❌ **不要提交敏感信息**：API密钥、密码、个人信息
- ❌ **不要提交商业机密**：未公开的商业计划、客户数据
- ✅ **脱敏处理**：对话中的敏感信息要脱敏后再保存
- ✅ **检查 .gitignore**：确保敏感对话不会被提交到版本控制

### 📋 版本控制建议

建议在 `.gitignore` 中添加：

```gitignore
# 排除包含敏感信息的对话
chat/conversations/*-private.md
chat/conversations/*-secret.md

# 排除临时对话草稿
chat/conversations/draft-*.md
chat/conversations/temp-*.md
```

### 🔍 搜索和检索

- 使用清晰的文件名，便于搜索
- 在对话记录中添加标签：`#feature` `#bug` `#refactor`
- 使用 `grep` 或编辑器的全局搜索功能查找历史对话

## 示例场景

### 场景1：开发新功能

1. 创建提示词：`prompts/feature-user-profile-20241206.md`
2. 与 AI 对话，导出记录：`conversations/20241206-implement-user-profile.md`
3. 如有重要决策，记录到：`decisions/user-profile-data-structure-20241206.md`
4. 在 `.42cog/work/work.md` 中引用对话记录

### 场景2：解决复杂Bug

1. 创建调试提示词：`prompts/debug-memory-leak-20241206.md`
2. 多轮对话，逐步定位问题
3. 导出完整对话：`conversations/20241206-fix-memory-leak.md`
4. 在对话中标注最终解决方案
5. 更新 `.42cog/work/work.md` 记录问题和解决方案

### 场景3：架构设计讨论

1. 准备上下文：将 `real.md` 和 `cog.md` 内容整理好
2. 创建架构讨论提示词：`prompts/design-microservices-20241206.md`
3. 与 AI 深度讨论，导出记录
4. 将架构决策记录到：`decisions/microservices-architecture-20241206.md`
5. 更新 `.42cog/spec/sys.spec.md` 系统架构规约

## 与其他目录的关系

```
project-root/
├── .42cog/              # 认知敏捷法核心文件
│   ├── work/            # 工作记录（引用 chat/ 中的对话）
│   └── spec/            # 规约文档（基于 chat/ 中的讨论生成）
├── chat/                # AI 对话记录（本目录）⭐
│   ├── prompts/         # 提示词模板
│   ├── conversations/   # 对话记录
│   └── decisions/       # 技术决策
├── notes/               # 项目笔记（更结构化的知识沉淀）
└── src/                 # 源代码（基于对话生成）
```

**关系说明**：

- `chat/` 是**原始记录**，保存与 AI 的完整交互
- `.42cog/work/` 是**工作日志**，引用和总结 chat/ 中的对话
- `notes/` 是**知识沉淀**，从 chat/ 中提取的可复用知识
- `src/` 是**最终产物**，基于 chat/ 中的讨论实现

## 最佳实践

### ✅ 推荐做法

1. **每次重要对话都导出保存**
2. **使用清晰的文件命名**
3. **在对话中添加上下文链接**
4. **定期回顾和整理对话**
5. **将成功的提示词模板化**
6. **重要决策单独记录**

### ❌ 避免做法

1. ❌ 不保存对话记录（丢失宝贵经验）
2. ❌ 文件命名混乱（难以检索）
3. ❌ 提交敏感信息（安全风险）
4. ❌ 从不整理归档（目录混乱）
5. ❌ 对话缺少上下文（难以理解）

## 工具推荐

### Markdown 编辑器
- **Zed**：原生支持 Claude Code
- **VS Code**：丰富的 Markdown 插件
- **Obsidian**：强大的知识管理功能

### 对话管理工具
- **Grep/Ripgrep**：快速搜索对话内容
- **fzf**：模糊搜索文件名
- **Git**：版本控制对话历史

### AI 辅助工具
- **Claude Code**：Zed 内置，原生支持对话导出
- **Cursor**：AI 编程助手
- **GitHub Copilot**：代码补全和对话

## 更多资源

- 认知敏捷法文档：https://42cog.com
- Claude Code 文档：https://docs.anthropic.com/claude/docs
- 活水智能：https://huoshuiai.com

---

**最后更新**：2025-12-06
**维护者**：项目团队

**记住**：好的对话记录是项目的宝贵资产，它记录了你的思考过程、决策依据和问题解决方案。认真对待每一次与 AI 的对话，它们会成为你和团队的知识财富。
