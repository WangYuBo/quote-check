# Claude Code 快速入门

> 5 分钟学会用 Claude Code 初始化项目

## 什么是 Claude Code？

命令行 AI 助手，用中文告诉它你想做什么，它帮你执行。

```bash
cd /你的项目路径
claude  # 启动
```

---

## 项目初始化 6 步

### 1. 创建配置文件

```
请创建 CLAUDE.md，项目名称是 xxx，使用中文沟通
```

### 2. 初始化 Git

```
请初始化 Git 仓库
```

### 3. 创建 .gitignore

```
请创建 .gitignore，忽略 node_modules、.env、.DS_Store
```

### 4. 添加远程仓库

```
我的仓库地址是 https://github.com/xxx/xxx
```

### 5. 提交代码

```
请提交代码
```

### 6. 推送到远程

```
请推送
```

---

## 使用 Skills 生成文档

### 注册 Skills

```
请将 .42plugin 目录下的 Skills 软连接到 .claude/skills
```

### 生成文档

```
请使用 pm-product-requirements Skill 生成产品需求文档
```

### 精简文档

```
请对这个文档创建精简版，保留 AI Agent 关键信息
```

---

## 常用命令速查

| 你说 | Claude 做 |
|------|----------|
| 创建 xxx 文件 | 创建文件 |
| 读取 xxx | 显示内容 |
| 编辑 xxx | 修改文件 |
| 查看 Git 状态 | `git status` |
| 提交代码 | `git commit` |
| 推送 | `git push` |
| 统计字数 | `wc -m` |

---

## 项目结构

```
项目/
├── .claude/skills/    # Skills
├── .git/              # Git
├── .gitignore         # 忽略规则
├── CLAUDE.md          # 配置文件
└── spec/              # 文档
```

---

**提示**：详细教程见 `claude-code-tutorial-full.md`
