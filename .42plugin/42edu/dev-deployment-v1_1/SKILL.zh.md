---
name: dev-deployment-v1
description: "用于将 Next.js 项目部署到 EdgeOne Pages - 自动检测 SSG/SSR 项目类型，支持本地 CLI 部署或 CNB 流水线，处理环境变量和区域配置（global/overseas）。"
version: "1.0"
---

# dev-deployment-v1: Next.js 部署到 EdgeOne Pages

## 概述

将 Next.js 项目部署到 EdgeOne Pages，自动检测项目类型。支持本地 CLI 部署和 CNB（Cloud Native Build）流水线部署两种方式。

## 何时使用

- 将 Next.js 项目部署到 EdgeOne Pages
- 为 EdgeOne 设置 CNB CI/CD 流水线
- 首次部署需要配置环境变量
- 更新现有的 EdgeOne Pages 部署

**不要用于：**
- 非 Next.js 项目
- 部署到其他平台（Vercel、Netlify 等）

## 快速参考

| 任务 | 操作 |
|------|------|
| 检测项目类型 | 检查 `out/` 文件夹（SSG）或 `.next/` 文件夹（SSR） |
| 检查 CLI 安装 | `which edgeone` 或 `edgeone --version` |
| 安装 CLI | `bun add -g edgeone` |
| 本地部署（SSG） | `edgeone pages deploy ./out -n <项目名> -a <区域>` |
| 本地部署（SSR） | `edgeone pages deploy . -n <项目名> -a <区域>` |
| CNB 部署 | 创建 `.cnb.yml` 并推送到仓库 |

## 工作流程

### 步骤 1：检测项目类型

```bash
# 检查项目类型
if [ -d "out" ] && [ "$(ls -A out 2>/dev/null)" ]; then
    echo "检测到 SSG 项目"
elif [ -d ".next" ]; then
    echo "检测到 SSR 项目"
else
    echo "请先构建项目: bun run build"
fi
```

| 类型 | 检测方式 | 部署目标 |
|------|----------|----------|
| SSG | `out/` 文件夹存在且非空 | `./out` 文件夹 |
| SSR | `.next/` 文件夹存在，无 `out/` | `.`（整个项目） |

### 步骤 2：检查前置条件

1. **EdgeOne CLI 已安装？**
   ```bash
   edgeone --version
   ```
   如未安装：`bun add -g edgeone`

2. **EdgeOne 登录状态？**
   ```bash
   edgeone whoami
   ```
   如未登录：`edgeone login`

### 步骤 3：从对话中提取参数

**优先从用户消息中提取参数，仅询问缺失的参数：**

| 参数 | 检测关键词 | 默认值 |
|------|-----------|--------|
| 项目名 | `-n`、`name`、引号包裹的字符串如 `"my-project"` | 询问用户 |
| 区域 | `overseas`/`海外` → overseas；`global`/`国内`/`中国` → global | 询问用户 |
| 方式 | `cnb`/`流水线` → CNB；`local`/`本地` → 本地推送 | 本地推送 |

**示例：** 用户说"把这个项目用 skill-test01 部署，使用海外节点"
→ 提取：name=`skill-test01`，area=`overseas`，method=本地推送

仅询问对话中未提及的参数。

### 步骤 4：部署

#### 方式 A：本地推送

**SSG 项目：**
```bash
edgeone pages deploy ./out -n <项目名> -a <区域>
```

**SSR 项目：**

首次部署（项目不存在）：
1. 直接部署创建项目：
```bash
edgeone pages deploy . -n <项目名> -a <区域>
```
2. 部署成功后，输出提醒：
```
请在 项目设置-环境变量 中填写项目的环境变量，否则可能影响项目正常运行。
https://pages.edgeone.ai/zh/document/build-guide#c51018ad-71af-43a6-83af-acbc3690c653
```

更新部署（项目已存在）：
```bash
edgeone pages deploy . -n <项目名> -a <区域>
```

#### 方式 B：CNB 推送

1. 检查远程仓库连接：
   ```bash
   git remote -v
   ```

2. 检测主分支名（用于配置 CNB 触发分支）：
   ```bash
   # 获取主分支名，无 git 初始化时默认 master
   if git rev-parse --git-dir > /dev/null 2>&1; then
       MAIN_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@')
       [ -z "$MAIN_BRANCH" ] && MAIN_BRANCH="master"
   else
       MAIN_BRANCH="master"
   fi
   echo "主分支: $MAIN_BRANCH"
   ```

3. 检查现有 `.cnb.yml` 配置（如存在）：
   ```bash
   # 如果已存在 .cnb.yml，检查分支名是否匹配
   if [ -f ".cnb.yml" ]; then
       # 获取文件中配置的分支名（第一个顶级键，通常是 master: 或 main:）
       CNB_BRANCH=$(grep -E "^(master|main):" .cnb.yml | head -1 | sed 's/://')
       if [ -n "$CNB_BRANCH" ] && [ "$CNB_BRANCH" != "$MAIN_BRANCH" ]; then
           echo "警告: .cnb.yml 中配置的分支 ($CNB_BRANCH) 与当前主分支 ($MAIN_BRANCH) 不一致"
           echo "需要将 .cnb.yml 中的 '$CNB_BRANCH:' 替换为 '$MAIN_BRANCH:'"
       fi
   fi
   ```
   - 如果分支名不一致，修改 `.cnb.yml` 文件首行的分支名
   - 例如：将 `master:` 改为 `main:`，或反之

4. 创建或更新 `.cnb.yml`：
   - 如果不存在，使用相应模板创建：
     - SSG：使用 `assets/ssg-cnb-template.yml`
     - SSR：使用 `assets/ssr-cnb-template.yml`
   - **重要**：确保文件中的分支名与检测到的主分支名一致

5. 提醒用户：
   - 创建包含 `EDGEONE_API_TOKEN` 的密钥仓库
   - 更新 `.cnb.yml` 中的 imports URL

6. 提交并推送：
   ```bash
   git add .cnb.yml
   git commit -m "添加 CNB 部署配置"
   git push
   ```

## SSG 与 SSR 差异

| 方面 | SSG | SSR |
|------|-----|-----|
| 构建产物 | `./out` 文件夹 | `.next` 文件夹 |
| 部署目标 | 仅 `./out` | 整个项目 |
| CNB 构建步骤 | 是（bun install + build） | 否（EdgeOne 构建） |
| 环境变量 | 可选 | 通常需要 |
| 首次部署 | 直接部署 | 直接部署，后配置环境变量 |

## 常见错误

| 错误 | 失败原因 | 修复方法 |
|------|----------|----------|
| SSR 项目缺少环境变量 | 部署后运行时错误 | 首次部署后在 EdgeOne 控制台配置环境变量 |
| SSG 部署目标错误 | 上传了不必要的文件 | 使用 `./out` 而非 `.` |
| CNB 中缺少 EDGEONE_API_TOKEN | 流水线认证失败 | 创建包含 token 的密钥仓库 |
| 使用 global 区域但调用海外 API | 中国区 API 调用被屏蔽 | 使用 `overseas` 区域 |
| 部署前忘记构建 | SSG 没有 `out/` 文件夹 | 先运行 `bun run build` |

## 资源

### 参考文档
- `references/edgeone-cli-reference.md` - EdgeOne CLI 完整命令参考

### 资产文件
- `assets/ssg-cnb-template.yml` - SSG 项目的 CNB 配置模板
- `assets/ssr-cnb-template.yml` - SSR 项目的 CNB 配置模板
