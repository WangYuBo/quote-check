# Claude Code 项目初始化教程

> 本教程面向技术小白，手把手教你如何使用 Claude Code 从零开始初始化一个项目。

## 目录

1. [什么是 Claude Code？](#什么是-claude-code)
2. [准备工作](#准备工作)
3. [第一步：创建项目配置文件](#第一步创建项目配置文件)
4. [第二步：初始化 Git 仓库](#第二步初始化-git-仓库)
5. [第三步：创建 .gitignore 文件](#第三步创建-gitignore-文件)
6. [第四步：注册 Claude Skills](#第四步注册-claude-skills)
7. [第五步：生成项目文档](#第五步生成项目文档)
8. [第六步：优化文档](#第六步优化文档)
9. [常用命令速查](#常用命令速查)
10. [常见问题](#常见问题)

---

## 什么是 Claude Code？

Claude Code 是 Anthropic 公司推出的命令行 AI 助手。你可以把它想象成一个住在你电脑终端里的超级助手，它能够：

- 帮你创建和编辑文件
- 执行命令行操作
- 理解你的项目结构
- 根据你的需求生成代码和文档

**简单来说**：你用中文告诉它你想做什么，它就帮你做。

---

## 准备工作

### 你需要准备的东西

1. **一台电脑**（本教程以 Mac 为例）
2. **安装好 Claude Code**
3. **一个空的项目文件夹**

### 打开 Claude Code

在终端中进入你的项目文件夹，然后启动 Claude Code：

```bash
cd /你的项目路径
claude
```

启动后，你会看到一个对话界面，可以直接用中文和 Claude 交流。

---

## 第一步：创建项目配置文件

### 什么是 CLAUDE.md？

`CLAUDE.md` 是一个特殊的文件，用来告诉 Claude Code 关于你项目的信息。就像给新来的同事一份项目说明书。

### 如何创建？

直接告诉 Claude：

```
请创建 CLAUDE.md 文件，包含以下信息：
- 项目名称：我的聊天应用
- 开发环境：Mac 电脑
- 使用中文沟通
```

### Claude 会做什么？

Claude 会自动创建一个 `CLAUDE.md` 文件，内容类似：

```markdown
# CLAUDE.md

本文件为 Claude Code 提供项目上下文指导。

## 项目概述
这是一个聊天应用项目。

## 开发环境
- 设备：Mac 电脑
- Node.js 管理：通过 bun 进行安装管理

## 注意事项
- 所有沟通和回复请使用中文
```

### 为什么要创建这个文件？

- Claude 每次启动都会读取这个文件
- 它能记住你的项目信息和偏好
- 不用每次都重复说明

---

## 第二步：初始化 Git 仓库

### 什么是 Git？

Git 是一个版本控制工具，可以：
- 记录你代码的每一次修改
- 随时回退到之前的版本
- 和团队成员协作

### 如何初始化？

告诉 Claude：

```
请初始化 Git 仓库
```

### Claude 会执行什么命令？

```bash
git init
```

### 执行结果

你会看到类似这样的输出：

```
Initialized empty Git repository in /你的项目路径/.git/
```

这表示 Git 仓库已经创建成功。

### 添加远程仓库（可选）

如果你有代码托管平台（如 GitHub、GitLab、cnb.cool），可以告诉 Claude：

```
我的仓库地址是：https://github.com/你的用户名/你的项目名
```

Claude 会执行：

```bash
git remote add origin https://github.com/你的用户名/你的项目名.git
```

---

## 第三步：创建 .gitignore 文件

### 什么是 .gitignore？

`.gitignore` 文件告诉 Git 哪些文件不需要被追踪。比如：
- 临时文件
- 依赖包（node_modules）
- 包含密码的配置文件

### 如何创建？

告诉 Claude：

```
请创建 .gitignore 文件，忽略以下内容：
- node_modules
- .env 文件
- .DS_Store
- .next 目录
```

### Claude 会创建什么？

```gitignore
# 系统文件
.DS_Store

# Node.js 相关
node_modules/
npm-debug.log*

# 环境变量文件
.env.local
.env.development.local

# Next.js 项目
.next/
build/
```

### 为什么需要这个文件？

- 避免上传不必要的大文件（node_modules 可能有几百 MB）
- 保护敏感信息（API 密钥、密码）
- 保持仓库整洁

---

## 第四步：注册 Claude Skills

### 什么是 Claude Skills？

Skills 是预先写好的"技能说明书"，告诉 Claude 如何完成特定任务。比如：
- 如何写产品需求文档
- 如何设计数据库
- 如何写用户故事

### Skills 放在哪里？

Skills 文件通常放在 `.claude/skills/` 目录下。

### 如何注册 Skills？

假设你有一些 Skills 文件在 `.42plugin/` 目录下，告诉 Claude：

```
请将 .42plugin 目录下的所有 Skills 通过软连接注册到 .claude/skills 目录
```

### Claude 会做什么？

1. 创建 `.claude/skills/` 目录
2. 创建软连接（快捷方式）指向原始 Skill 文件

```bash
mkdir -p .claude/skills
ln -sf ../../.42plugin/42edu/pm-user-story/SKILL.zh.md .claude/skills/pm-user-story.md
```

### 什么是软连接？

软连接就像 Windows 的快捷方式：
- 不复制文件，只创建一个指向
- 原文件更新，软连接自动更新
- 节省空间

### 注册后如何使用？

注册后，你可以直接调用这些 Skills：

```
请使用 pm-user-story Skill 生成用户故事文档
```

---

## 第五步：生成项目文档

### 使用 Skills 生成文档

假设你已经注册了产品需求 Skill，可以这样使用：

```
请使用 pm-product-requirements Skill 生成产品需求规格书，
参考 .42cog/real/real.md 和 .42cog/cog/cog.md
```

### Claude 会做什么？

1. **读取 Skill 文件**：了解如何写产品需求
2. **读取参考文档**：了解项目约束和认知模型
3. **生成文档**：按照 Skill 的模板生成完整文档

### 生成的文档示例

Claude 会生成类似这样的文档：

```markdown
# 产品需求规格书

## 1. 产品环境
**名称：** 活水智聊
**定位：** 多模型 AI 对话中枢

## 2. 最小可供故事（MAS）
### MAS-1：与 AI 对话
登录 → 新建对话 → 发送消息 → 查看回复

## 3. 可供性目录
| ID | 名称 | 行动 |
|----|------|------|
| P01 | 登录 | 进入系统 |
| P02 | 发送消息 | 发送文本 |
...
```

### 指定输出位置

你可以告诉 Claude 把文档放在哪里：

```
请生成产品需求规格书，放在 spec/pm 目录下，文件名为 pr.spec.md
```

---

## 第六步：优化文档

### 为什么要优化？

生成的文档可能很长，包含很多解释性内容。对于 AI Agent 来说，精简的文档更高效。

### 如何优化？

告诉 Claude：

```
请对 spec/pm/pr.spec.md 创建一个精简版，
保留所有 AI Agent 需要的关键信息，
生成新文件在同文件夹
```

### 优化前后对比

| 版本 | 字符数 | 说明 |
|------|--------|------|
| 原版 | 8,400 | 包含详细解释 |
| 精简版 | 2,193 | 只保留关键信息 |

**减少 74%！**

### 精简原则

保留：
- 核心流程
- API 端点
- 选择器和操作方法
- 约束条件

删除：
- 冗长的解释
- 重复的内容
- 装饰性文字

---

## 常用命令速查

### 项目初始化

| 你说的话 | Claude 做的事 |
|---------|--------------|
| "创建 CLAUDE.md" | 创建项目配置文件 |
| "初始化 Git 仓库" | 执行 `git init` |
| "创建 .gitignore" | 创建忽略规则文件 |
| "添加远程仓库 xxx" | 执行 `git remote add origin xxx` |

### 文件操作

| 你说的话 | Claude 做的事 |
|---------|--------------|
| "读取 xxx 文件" | 显示文件内容 |
| "创建 xxx 文件" | 创建新文件 |
| "编辑 xxx 文件" | 修改文件内容 |
| "删除 xxx 文件" | 删除文件 |

### Git 操作

| 你说的话 | Claude 做的事 |
|---------|--------------|
| "查看 Git 状态" | 执行 `git status` |
| "提交代码" | 执行 `git add` + `git commit` |
| "推送到远程" | 执行 `git push` |

### 文档生成

| 你说的话 | Claude 做的事 |
|---------|--------------|
| "使用 xxx Skill 生成文档" | 按 Skill 模板生成 |
| "精简这个文档" | 创建精简版本 |
| "统计文件字数" | 执行 `wc -m` |

---

## 常见问题

### Q1：Claude 说找不到文件怎么办？

**原因**：路径可能不对

**解决**：
1. 告诉 Claude 完整路径
2. 或者让 Claude 先搜索：`请搜索项目中的 xxx 文件`

### Q2：如何让 Claude 用中文回复？

**方法**：在 CLAUDE.md 中添加：

```markdown
## 注意事项
- 所有沟通和回复请使用中文
```

### Q3：Claude 创建的文件在哪里？

**答案**：在你启动 Claude 时所在的目录下。

**查看方法**：
```
请列出当前目录的所有文件
```

### Q4：如何撤销 Claude 的操作？

**方法**：
1. 如果已经 Git 提交：`请回退到上一个提交`
2. 如果还没提交：`请撤销对 xxx 文件的修改`

### Q5：Skill 文件从哪里来？

**来源**：
1. 自己编写
2. 从开源项目获取
3. 团队共享

**格式**：Markdown 文件，包含任务说明和模板

### Q6：为什么要用软连接而不是复制？

**优点**：
1. 原文件更新，软连接自动更新
2. 不占用额外空间
3. 方便统一管理

---

## 实战练习

### 练习 1：初始化一个新项目

1. 创建一个空文件夹
2. 启动 Claude Code
3. 依次执行：
   - 创建 CLAUDE.md
   - 初始化 Git
   - 创建 .gitignore
   - 提交代码

### 练习 2：生成项目文档

1. 准备好 Skill 文件
2. 注册到 .claude/skills
3. 使用 Skill 生成文档
4. 创建精简版

### 练习 3：推送到远程仓库

1. 在 GitHub/GitLab 创建仓库
2. 添加远程仓库地址
3. 推送代码
4. 在网页上查看结果

---

## 总结

通过本教程，你学会了：

1. **CLAUDE.md** - 项目配置文件，让 Claude 了解你的项目
2. **Git 初始化** - 版本控制，记录代码历史
3. **.gitignore** - 忽略不需要追踪的文件
4. **Claude Skills** - 预设技能，快速生成专业文档
5. **文档优化** - 精简内容，提高效率

**记住**：Claude Code 是你的助手，用自然语言告诉它你想做什么，它会帮你完成。

---

## 附录：本教程涉及的文件结构

```
你的项目/
├── .claude/
│   ├── skills/           # Claude Skills（软连接）
│   │   ├── pm-user-story.md
│   │   └── pm-product-requirements.md
│   └── settings.local.json
├── .git/                 # Git 仓库目录
├── .gitignore            # Git 忽略规则
├── .42cog/               # 认知敏捷法文档
│   ├── real/real.md      # 现实约束
│   ├── cog/cog.md        # 认知模型
│   └── meta/meta.md      # 项目元信息
├── spec/
│   └── pm/
│       ├── pr.spec.md      # 产品需求（完整版）
│       └── pr.spec.lite.md # 产品需求（精简版）
├── CLAUDE.md             # Claude Code 配置
└── README.md             # 项目说明
```

---

**教程版本**：v1.0.0
**创建日期**：2025-12-06
**作者**：活水AI实验室
