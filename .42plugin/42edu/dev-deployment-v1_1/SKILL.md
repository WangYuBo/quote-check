---
name: dev-deployment-v1
description: "Use when deploying Next.js projects to EdgeOne Pages - detects SSG/SSR project type, supports local CLI deployment or CNB pipeline, handles environment variables and region configuration (global/overseas)."
version: "1.0"
---

# dev-deployment-v1: Next.js to EdgeOne Pages Deployment

## Overview

Deploy Next.js projects to EdgeOne Pages with automatic project type detection. Supports both local CLI deployment and CNB (Cloud Native Build) pipeline deployment.

## When to Use

- Deploying Next.js project to EdgeOne Pages
- Setting up CI/CD pipeline with CNB for EdgeOne
- First-time deployment requiring environment variable configuration
- Updating existing EdgeOne Pages deployment

**Don't use for:**
- Non-Next.js projects
- Deploying to other platforms (Vercel, Netlify, etc.)

## Quick Reference

| Task | Action |
|------|--------|
| Detect project type | Check for `out/` folder (SSG) or `.next/` folder (SSR) |
| Check CLI installed | `which edgeone` or `edgeone --version` |
| Install CLI | `bun add -g edgeone` |
| Local deploy (SSG) | `edgeone pages deploy ./out -n <project-name> -a <area>` |
| Local deploy (SSR) | `edgeone pages deploy . -n <project-name> -a <area>` |
| CNB deploy | Create `.cnb.yml` and push to repository |

## Workflow

### Step 1: Detect Project Type

```bash
# Check project type
if [ -d "out" ] && [ "$(ls -A out 2>/dev/null)" ]; then
    echo "SSG project detected"
elif [ -d ".next" ]; then
    echo "SSR project detected"
else
    echo "Build project first: bun run build"
fi
```

| Type | Detection | Deploy Target |
|------|-----------|---------------|
| SSG | `out/` folder exists and not empty | `./out` folder |
| SSR | `.next/` folder exists, no `out/` | `.` (entire project) |

### Step 2: Check Prerequisites

1. **EdgeOne CLI installed?**
   ```bash
   edgeone --version
   ```
   If not: `bun add -g edgeone`

2. **EdgeOne login status?**
   ```bash
   edgeone whoami
   ```
   If not logged in: `edgeone login`

### Step 3: Extract Parameters from Conversation

**Extract from user message first, only ask for missing parameters:**

| Parameter | Keywords to detect | Default |
|-----------|-------------------|---------|
| Project name | `-n`, `name`, quoted strings like `"my-project"` | Ask user |
| Region | `overseas`/`海外` → overseas; `global`/`国内`/`中国` → global | Ask user |
| Method | `cnb`/`流水线` → CNB; `local`/`本地` → Local | Local push |

**Example:** User says "Deploy this project as skill-test01, use overseas nodes"
→ Extract: name=`skill-test01`, area=`overseas`, method=local

Only ask for parameters not mentioned in the conversation.

### Step 4: Deploy

#### Option A: Local Push

**For SSG projects:**
```bash
edgeone pages deploy ./out -n <project-name> -a <area>
```

**For SSR projects:**

First deployment (no existing project):
1. Deploy directly to create project:
```bash
edgeone pages deploy . -n <project-name> -a <area>
```
2. After deployment succeeds, output reminder:
```
请在 项目设置-环境变量 中填写项目的环境变量，否则可能影响项目正常运行。
https://pages.edgeone.ai/zh/document/build-guide#c51018ad-71af-43a6-83af-acbc3690c653
```

Update deployment (project exists):
```bash
edgeone pages deploy . -n <project-name> -a <area>
```

#### Option B: CNB Push

1. Check remote repository connection:
   ```bash
   git remote -v
   ```

2. Detect main branch name (for CNB trigger configuration):
   ```bash
   # Get main branch name, defaults to master if no git initialized
   if git rev-parse --git-dir > /dev/null 2>&1; then
       MAIN_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@')
       [ -z "$MAIN_BRANCH" ] && MAIN_BRANCH="master"
   else
       MAIN_BRANCH="master"
   fi
   echo "Main branch: $MAIN_BRANCH"
   ```

3. Check existing `.cnb.yml` configuration (if exists):
   ```bash
   # If .cnb.yml exists, check if branch name matches
   if [ -f ".cnb.yml" ]; then
       # Get branch name configured in file (first top-level key, usually master: or main:)
       CNB_BRANCH=$(grep -E "^(master|main):" .cnb.yml | head -1 | sed 's/://')
       if [ -n "$CNB_BRANCH" ] && [ "$CNB_BRANCH" != "$MAIN_BRANCH" ]; then
           echo "Warning: Branch in .cnb.yml ($CNB_BRANCH) doesn't match current main branch ($MAIN_BRANCH)"
           echo "Need to replace '$CNB_BRANCH:' with '$MAIN_BRANCH:' in .cnb.yml"
       fi
   fi
   ```
   - If branch names don't match, update the branch name at the beginning of `.cnb.yml`
   - Example: change `master:` to `main:`, or vice versa

4. Create or update `.cnb.yml`:
   - If not exists, create using appropriate template:
     - SSG: Use `assets/ssg-cnb-template.yml`
     - SSR: Use `assets/ssr-cnb-template.yml`
   - **Important**: Ensure branch name in file matches detected main branch

5. Remind user to:
   - Create secret repository with `EDGEONE_API_TOKEN`
   - Update imports URL in `.cnb.yml`

6. Commit and push:
   ```bash
   git add .cnb.yml
   git commit -m "Add CNB deployment configuration"
   git push
   ```

## SSG vs SSR Differences

| Aspect | SSG | SSR |
|--------|-----|-----|
| Build output | `./out` folder | `.next` folder |
| Deploy target | `./out` only | Entire project |
| CNB build step | Yes (bun install + build) | No (EdgeOne builds) |
| Environment vars | Optional | Often required |
| First deploy | Direct | Direct, then configure env vars |

## Common Mistakes

| Mistake | Why It Fails | Fix |
|---------|--------------|-----|
| SSR project missing environment variables | Runtime errors after deployment | Configure env vars in EdgeOne console after first deploy |
| Wrong deploy target for SSG | Uploads unnecessary files | Use `./out` not `.` |
| Missing EDGEONE_API_TOKEN in CNB | Pipeline fails authentication | Create secret repository with token |
| Using global area with overseas APIs | API calls blocked in China | Use `overseas` area |
| Forgot to build before deploy | No `out/` folder for SSG | Run `bun run build` first |

## Resources

### References
- `references/edgeone-cli-reference.md` - Complete EdgeOne CLI command reference

### Assets
- `assets/ssg-cnb-template.yml` - CNB configuration template for SSG projects
- `assets/ssr-cnb-template.yml` - CNB configuration template for SSR projects
