import { execSync } from 'node:child_process';

// spec-coding §20 #10：prompts/v1/ 不得被 PR 改动（只能新增 prompts/v2/）
// 判定基准：当前工作树相对 origin/main 的 diff
const BASE = process.env['FROZEN_BASE'] ?? 'origin/main';

let diff = '';
try {
  diff = execSync(`git diff --name-status ${BASE}...HEAD -- 'prompts/v1/**'`, {
    encoding: 'utf-8',
  }).trim();
} catch (err) {
  console.warn(`[prompt-frozen] 无法取 diff（是否首个 commit？）：${String(err)}`);
  process.exit(0);
}

if (!diff) {
  console.log('[prompt-frozen] OK（prompts/v1/ 未被改动）');
  process.exit(0);
}

const lines = diff.split('\n');
const violations = lines.filter((l) => !l.startsWith('A\t'));

if (violations.length) {
  console.error('[prompt-frozen] ✗ prompts/v1/ 被改动（只允许新增，不允许修改/删除）：');
  for (const v of violations) console.error('  ' + v);
  console.error('');
  console.error('修复：新建 prompts/v2/ 目录，更新 lib/ai/prompts.ts 的 PROMPT_VERSION。');
  process.exit(1);
}

console.log(`[prompt-frozen] OK（仅新增 ${lines.length} 个文件）`);
