---
name: dev-deployment
description: 将 quote-check（Next.js SSR）部署到 Vercel——vercel CLI 部署、环境变量、Inngest 同步、迁移验证
version: "1.1-lite"
---

# Next.js SSR → Vercel 部署

## 前置条件

1. Vercel CLI 已安装：`npm i -g vercel && vercel login`
2. 环境变量已配置（见 `lib/env.ts`）
3. 代码已提交

## 流程

### 1. 部署

```bash
vercel --prod
```

Vercel 自动构建（bun install + next build）并部署为 SSR（Fluid Compute）。

### 2. Inngest 同步

在 Inngest Cloud 点击 Sync，使新函数生效。

### 3. 数据库迁移（如 schema 变更）

```bash
bun run db:migrate
bun run db:triggers
bun run db:check
```

## 环境变量

通过 `vercel env add` 或 Dashboard 设置。完整清单见 `lib/env.ts`：

- `DATABASE_URL` — Neon
- `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL`
- `SILICONFLOW_API_KEY`
- `BLOB_READ_WRITE_TOKEN`
- `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY`

## 验证

- [ ] `/api/inngest` 返回函数列表
- [ ] `/api/me/billing-summary` 可用
- [ ] Inngest Cloud 已同步

## 常见错误

| 症状 | 修复 |
|------|------|
| 构建失败 | 检查 `vercel env add` 后重新部署 |
| Inngest 不触发 | 在 Inngest Cloud 手动同步 |
| 数据库连不上 | 更新 DATABASE_URL |

---

**版本**: v1.1-lite · **更新**: 2026-04-25
**平台**: Vercel（非 EdgeOne）
