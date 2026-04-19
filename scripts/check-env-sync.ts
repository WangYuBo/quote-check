import { readFileSync } from 'node:fs';
import path from 'node:path';

const envExamplePath = path.join(process.cwd(), '.env.example');
const envTs = path.join(process.cwd(), 'lib', 'env.ts');

const exampleKeys = readFileSync(envExamplePath, 'utf-8')
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'))
  .map((l) => l.split('=')[0] ?? '')
  .filter(Boolean)
  .sort();

const envTsContent = readFileSync(envTs, 'utf-8');
const schemaKeyRegex = /^\s*([A-Z][A-Z0-9_]*)\s*:/gm;
const schemaKeys = Array.from(envTsContent.matchAll(schemaKeyRegex))
  .map((m) => m[1] ?? '')
  .filter(Boolean)
  .sort();

const missingInTs = exampleKeys.filter((k) => !schemaKeys.includes(k));
const missingInExample = schemaKeys.filter((k) => !exampleKeys.includes(k));

if (missingInTs.length || missingInExample.length) {
  console.error('[env-sync] .env.example 与 lib/env.ts 不同步');
  if (missingInTs.length) {
    console.error('  .env.example 有但 envSchema 缺：', missingInTs.join(', '));
  }
  if (missingInExample.length) {
    console.error('  envSchema 有但 .env.example 缺：', missingInExample.join(', '));
  }
  process.exit(1);
}

console.log(`[env-sync] OK（${exampleKeys.length} 个变量一致）`);
