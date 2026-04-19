import { execSync } from 'node:child_process';

// spec-coding §20 #10：prompts/v1/ 不得被 PR 改动（只能新增 prompts/v2/）
//
// 基准分支检测（优先级从高到低）：
//   1. FROZEN_BASE 显式覆盖（本地调试）
//   2. GITHUB_BASE_REF（GitHub Actions PR 事件注入的目标分支名）
//   3. origin/HEAD 符号链接（git clone 时记录的默认分支，main 或 master 皆可）
//   4. origin/main → origin/master 尝试
//   5. HEAD~1（单分支仓库兜底——与上一次提交对比）

function detectBase(): string {
  const explicit = process.env['FROZEN_BASE'];
  if (explicit) return explicit;

  const ghBase = process.env['GITHUB_BASE_REF'];
  if (ghBase) return `origin/${ghBase}`;

  try {
    const head = execSync('git symbolic-ref --short refs/remotes/origin/HEAD', {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (head) return head;
  } catch {
    // origin/HEAD 未设置（git remote set-head origin 未跑过）—— 继续尝试
  }

  for (const candidate of ['origin/main', 'origin/master']) {
    try {
      execSync(`git rev-parse --verify --quiet ${candidate}`, { stdio: 'ignore' });
      return candidate;
    } catch {
      // 该分支不存在，试下一个
    }
  }

  return 'HEAD~1';
}

const BASE = detectBase();

let diff = '';
try {
  diff = execSync(`git diff --name-status ${BASE}...HEAD -- 'prompts/v1/**'`, {
    encoding: 'utf-8',
  }).trim();
} catch (err) {
  console.warn(`[prompt-frozen] 无法取 diff（base=${BASE}，是否首个 commit？）：${String(err)}`);
  process.exit(0);
}

if (!diff) {
  console.log(`[prompt-frozen] OK（prompts/v1/ 未被改动，base=${BASE}）`);
  process.exit(0);
}

const lines = diff.split('\n');
const violations = lines.filter((l) => !l.startsWith('A\t'));

if (violations.length) {
  console.error(
    `[prompt-frozen] ✗ prompts/v1/ 被改动（base=${BASE}；只允许新增，不允许修改/删除）：`,
  );
  for (const v of violations) console.error('  ' + v);
  console.error('');
  console.error('修复：新建 prompts/v2/ 目录，更新 lib/ai/prompts.ts 的 PROMPT_VERSION。');
  process.exit(1);
}

console.log(`[prompt-frozen] OK（仅新增 ${lines.length} 个文件，base=${BASE}）`);
