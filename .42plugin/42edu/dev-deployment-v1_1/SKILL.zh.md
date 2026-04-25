---
name: dev-deployment-v1
description: "将 quote-check（Next.js SSR）部署到 Vercel——vercel CLI 部署、环境变量管理、Inngest 同步、迁移与集成检查。"
version: "1.1"
---

# dev-deployment-v1.1: Next.js SSR → Vercel 部署

## 概述

将 quote-check 项目（Next.js 16 App Router · SSR）部署到 Vercel。项目使用 Fluid Compute（默认），非 Edge Functions。

此技能仅适用于 Vercel 部署。**不用于** EdgeOne Pages、Netlify 等。

## 项目栈确认

| 维度 | 值 |
|------|-----|
| 框架 | Next.js 16 (App Router) |
| 渲染 | SSR（Fluid Compute），非 SSG |
| 数据库 | Neon PostgreSQL（外置，非 Vercel Marketplace） |
| 队列 | Inngest Cloud（外置） |
| AI | 硅基流动（DeepSeek，外置 API） |
| 存储 | Vercel Blob |
| 认证 | Better Auth |
| 配置 | `vercel.json`（`{ "framework": "nextjs" }`）|

## 前置条件

1. Vercel CLI 已安装：`vercel --version`
2. Vercel 登录态：`vercel whoami`
3. 已配置 Vercel 项目（`vercel link`）
4. 已设置环境变量（见下方 §环境变量）

### 安装 CLI

```bash
npm i -g vercel
vercel login
```

## 部署流程

### 步骤 1：提交代码

```bash
git add -A
git commit -m "<语义化提交信息>"
```

### 步骤 2：部署到 Vercel

```bash
# 正式部署（生产）
vercel --prod
```

Vercel 自动执行：
1. 安装依赖（`bun install`，Vercel 自动检测 bun.lockb）
2. 构建（`next build`，Turbopack）
3. 部署产物（`.next/` + serverless functions）
4. 自动路由：`app/` 目录下路由文件自动注册为 serverless function

### 步骤 3：Inngest 同步

部署后，需让 Inngest Cloud 感知新函数：

```bash
# 登入 Inngest Cloud → Your project → "Sync" 按钮
# 或通过 Inngest CLI（若配置了自动同步则跳过）
```

Inngest 函数注册在 `app/api/inngest/route.ts`，所有 `inngest.createFunction` 自动暴露。

### 步骤 4：迁移数据库（如 schema 变更）

```bash
# 本地生成迁移文件（仅首次或 schema 变更时需要）
bun run db:generate

# 对 Neon 主力库执行迁移
bun run db:migrate

# 应用手写触发器（_hand_triggers.sql）
bun run db:triggers

# 验证
bun run db:check
```

## 环境变量

### 完整清单

所有环境变量由 `lib/env.ts` 的 Zod schema 统一校验。应用代码**禁止**直接 `process.env.X`。

| 变量 | 说明 | 来源 |
|------|------|------|
| `DATABASE_URL` | Neon PostgreSQL 连接串 | Neon Dashboard |
| `BETTER_AUTH_SECRET` | Better Auth 密钥（≥32 字符） | `openssl rand -hex 32` |
| `BETTER_AUTH_URL` | 部署域名 | `https://<project>.vercel.app` |
| `SILICONFLOW_API_KEY` | 硅基流动 API Key | 硅基流动控制台 |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob token | Vercel Storage |
| `INNGEST_EVENT_KEY` | Inngest 事件 key | Inngest Cloud |
| `INNGEST_SIGNING_KEY` | Inngest 签名 key | Inngest Cloud |
| `LOG_LEVEL` | Pino 日志级别（默认 info） | — |
| `TTL_DAYS` | 用户数据保留天数（默认 7） | — |
| `DEMO_MODE` | 演示模式 | — |

### 通过 Vercel CLI 设置

```bash
vercel env add DATABASE_URL
vercel env add BETTER_AUTH_SECRET
# ... 逐个添加
```

或通过 Vercel Dashboard > Project > Settings > Environment Variables 批量添加。

### 环境变量隔离

- **Production**：填真实数据库 / API key
- **Preview**：可填 staging 数据库 / 测试 API key
- **Development**：使用 `.env` 本地文件（不提交到 git）

## 项目类型说明

**重要**：本项目**不是** SSG。Next.js 16 App Router + API routes + Inngest → 必须是 SSR（Fluid Compute）。

```bash
# ✅ 正确部署方式
vercel --prod

# ❌ 错误的做法
# vercel deploy ./out  ← 无 out/ 目录
# edgeone pages deploy .  ← 平台不对
```

## 部署后验证清单

- [ ] `GET /api/inngest` 返回函数清单（验证注册）
- [ ] `GET /api/me/billing-summary` 返回账户摘要（验证计费）
- [ ] `GET /api/billing/me?groupBy=month` 返回结算明细
- [ ] Inngest Cloud 显示新函数列表（`costGuardFn` 已移除，不应出现）
- [ ] Vercel Blob 可读可写
- [ ] Neon 数据库连接正常
- [ ] AI 客户端（硅基流动）可调用

## 回滚

```bash
# 查看部署历史
vercel list

# 回滚到指定部署
vercel rollback <deployment-id>

# 或通过 Vercel Dashboard → Deployments → ⋮ → Rollback
```

## 常见错误

| 症状 | 原因 | 修复 |
|------|------|------|
| 构建失败：env 校验错误 | 缺少环境变量 | `vercel env add <变量名>` |
| Inngest 函数不触发 | 未同步 | 在 Inngest Cloud 手动同步 |
| 数据库连接失败 | DATABASE_URL 过期 | 更新环境变量 + Redeploy |
| Blob 上传 403 | BLOB_READ_WRITE_TOKEN 无效 | 重新生成 token |
| AI 调用 401 | SILICONFLOW_API_KEY 失效 | 更新 API key |
| 部署后旧函数仍存在 | 代码未提交 | `git status` 确认提交 + redeploy |

## 资源

- [Vercel CLI 文档](https://vercel.com/docs/cli)
- [Next.js 部署文档](https://nextjs.org/docs/app/building-your-application/deploying)
- [Inngest Vercel 集成](https://inngest.com/docs/deploy/vercel)
- [Vercel Blob](https://vercel.com/docs/storage/vercel-blob)
