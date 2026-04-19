import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

// spec-coding §10.1 · real.md #7 · ADR-012
// prompts/v1/ 是版本冻结资产，启动时 SHA256 校验
// PROMPT_VERSION 在此升级时同步建 prompts/v2/，不得原地改 v1/

export type PromptKey = 'extract' | 'verify' | 'map';

export const PROMPT_VERSION = 'v1' as const;

export interface PromptRecord {
  readonly text: string;
  readonly sha256: string;
  readonly version: typeof PROMPT_VERSION;
  readonly key: PromptKey;
}

const cache = new Map<PromptKey, PromptRecord>();

export function loadPromptRaw(key: PromptKey): PromptRecord {
  const cached = cache.get(key);
  if (cached) return cached;

  const filePath = path.join(process.cwd(), 'prompts', PROMPT_VERSION, `${key}.txt`);
  const text = readFileSync(filePath, 'utf-8');
  const sha256 = createHash('sha256').update(text).digest('hex');
  const record: PromptRecord = { text, sha256, version: PROMPT_VERSION, key };
  cache.set(key, record);
  return record;
}

export function clearPromptCache(): void {
  cache.clear();
}
