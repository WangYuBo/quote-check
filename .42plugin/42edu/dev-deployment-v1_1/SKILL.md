---
name: dev-deployment-v1
description: "Deploy quote-check (Next.js SSR) to Vercel — vercel CLI, env management, Inngest sync, migrations, and integration checks."
version: "1.1"
---

# dev-deployment-v1.1: Next.js SSR → Vercel Deployment

## Overview

Deploy the quote-check project (Next.js 16 App Router · SSR) to Vercel using Fluid Compute (default, not Edge Functions).

This skill is for Vercel deployment only. **Do not use** for EdgeOne Pages, Netlify, etc.

## Project Stack

| Dimension | Value |
|-----------|-------|
| Framework | Next.js 16 (App Router) |
| Rendering | SSR (Fluid Compute), not SSG |
| Database | Neon PostgreSQL (external) |
| Queue | Inngest Cloud (external) |
| AI | SiliconFlow (DeepSeek, external API) |
| Storage | Vercel Blob |
| Auth | Better Auth |
| Config | `vercel.json` (`{ "framework": "nextjs" }`) |

## Prerequisites

1. Vercel CLI installed: `vercel --version`
2. Logged in: `vercel whoami`
3. Vercel project linked (`vercel link`)
4. Environment variables set (see §Environment Variables)

### Install CLI

```bash
npm i -g vercel
vercel login
```

## Deployment Workflow

### Step 1: Commit

```bash
git add -A
git commit -m "<semantic commit message>"
```

### Step 2: Deploy to Vercel

```bash
# Production deploy
vercel --prod
```

Vercel automatically:
1. Installs dependencies (detects `bun.lockb`)
2. Builds (`next build` with Turbopack)
3. Deploys artifacts (`.next/` + serverless functions)
4. Registers all routes from `app/` directory

### Step 3: Inngest Sync

After deployment, make Inngest Cloud aware of new functions:

```bash
# Inngest Cloud → Your project → "Sync" button
# Or via Inngest CLI if auto-sync is configured
```

Functions registered in `app/api/inngest/route.ts` are auto-exposed.

### Step 4: Database Migration (if schema changed)

```bash
# Generate migration (first time or schema change)
bun run db:generate

# Apply to Neon production
bun run db:migrate

# Apply hand-written triggers
bun run db:triggers

# Verify
bun run db:check
```

## Environment Variables

All validated by `lib/env.ts` Zod schema. Application code **must not** read `process.env` directly.

| Variable | Description | Source |
|----------|-------------|--------|
| `DATABASE_URL` | Neon PostgreSQL connection string | Neon Dashboard |
| `BETTER_AUTH_SECRET` | Better Auth secret (≥32 chars) | `openssl rand -hex 32` |
| `BETTER_AUTH_URL` | Deployment domain | `https://<project>.vercel.app` |
| `SILICONFLOW_API_KEY` | SiliconFlow API key | SiliconFlow Console |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob token | Vercel Storage |
| `INNGEST_EVENT_KEY` | Inngest event key | Inngest Cloud |
| `INNGEST_SIGNING_KEY` | Inngest signing key | Inngest Cloud |
| `LOG_LEVEL` | Pino log level (default info) | — |
| `TTL_DAYS` | Data retention days (default 7) | — |
| `DEMO_MODE` | Demo mode flag | — |

### Set via Vercel CLI

```bash
vercel env add DATABASE_URL
vercel env add BETTER_AUTH_SECRET
# ... add each variable
```

Or via Vercel Dashboard > Project > Settings > Environment Variables.

### Environment Isolation

- **Production**: Real database / API keys
- **Preview**: Staging database / test keys
- **Development**: Local `.env` file (not committed)

## Project Type

**Important**: This project is **not** SSG. Next.js 16 App Router + API routes + Inngest → must be SSR (Fluid Compute).

```bash
# ✅ Correct
vercel --prod

# ❌ Wrong
# vercel deploy ./out   ← no out/ directory
# edgeone pages deploy .  ← wrong platform
```

## Post-Deploy Checklist

- [ ] `GET /api/inngest` returns function list
- [ ] `GET /api/me/billing-summary` returns account summary
- [ ] `GET /api/billing/me?groupBy=month` returns billing detail
- [ ] Inngest Cloud shows updated function list (`costGuardFn` removed)
- [ ] Vercel Blob read/write works
- [ ] Neon database connected
- [ ] AI client (SiliconFlow) callable

## Rollback

```bash
# List deployments
vercel list

# Rollback to specific deployment
vercel rollback <deployment-id>
```

## Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Build fails: env validation | Missing env var | `vercel env add <name>` + redeploy |
| Inngest not triggering | Not synced | Manual sync in Inngest Cloud |
| DB connection fails | Stale DATABASE_URL | Update env + redeploy |
| Blob upload 403 | Invalid BLOB_READ_WRITE_TOKEN | Regenerate token |
| AI call 401 | Invalid API key | Update env variable |
| Old functions still active | Code not committed | `git status` + commit + redeploy |

## Resources

- [Vercel CLI Docs](https://vercel.com/docs/cli)
- [Next.js Deployment Docs](https://nextjs.org/docs/app/building-your-application/deploying)
- [Inngest Vercel Integration](https://inngest.com/docs/deploy/vercel)
- [Vercel Blob](https://vercel.com/docs/storage/vercel-blob)
