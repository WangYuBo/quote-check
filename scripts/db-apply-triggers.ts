import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { Client } from 'pg';

/**
 * 独立应用 lib/db/migrations/0001_triggers.sql
 *
 * 为什么不走 drizzle-kit migrate：
 *   drizzle-kit 以 meta/_journal.json 为准，不扫描目录；0001 是手写文件、
 *   drizzle 生成器无法回填 snapshot，硬登记进 journal 会在下次 generate 冲突。
 *   故将触发器/CHECK/GIN/归档表独立成此脚本，幂等可重复跑。
 *
 * 执行顺序：
 *   bun run db:migrate   → 应用 drizzle 生成的 0000_*.sql（建表）
 *   bun run db:triggers  → 应用本脚本（补触发器 + 索引 + 视图 + 归档表）
 *
 * 安全：0001 内全是 CREATE OR REPLACE FUNCTION / DROP TRIGGER IF EXISTS / IF NOT EXISTS，
 *       重复执行不会破坏已有状态。
 */

const DATABASE_URL = process.env['DATABASE_URL'];
if (!DATABASE_URL) {
  console.error('[db:triggers] ✗ DATABASE_URL 未设置');
  process.exit(1);
}

const sqlPath = resolve(process.cwd(), 'lib/db/migrations/0001_triggers.sql');
const sql = readFileSync(sqlPath, 'utf-8');

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
  });

  const started = Date.now();
  console.log(`[db:triggers] → 连接 ${redactUrl(DATABASE_URL as string)}`);
  await client.connect();

  try {
    console.log(`[db:triggers] → 执行 ${sqlPath}（${sql.length} 字节）`);
    await client.query(sql);
    console.log(`[db:triggers] ✓ 完成，耗时 ${Date.now() - started}ms`);
  } finally {
    await client.end();
  }
}

function redactUrl(u: string): string {
  try {
    const url = new URL(u);
    if (url.password) url.password = '***';
    return url.toString();
  } catch {
    return '<invalid url>';
  }
}

main().catch((err) => {
  console.error('[db:triggers] ✗ 失败：', err);
  process.exit(1);
});
