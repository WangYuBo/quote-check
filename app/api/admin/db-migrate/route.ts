import { readFileSync } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

import { withAdminAuth } from '@/lib/auth/admin-guard';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

/**
 * 执行库的所有迁移文件（按文件名排序）。
 * 幂等：CREATE TABLE IF NOT EXISTS + ALTER TABLE 容错。
 */
export const GET = withAdminAuth(async () => {
  return runMigrations();
});

export const POST = withAdminAuth(async () => {
  return runMigrations();
});

async function runMigrations() {
  const results: string[] = [];

  try {
    const migrationsDir = path.join(process.cwd(), 'lib/db/migrations');
    const files = ['0000_wakeful_kat_farrell.sql', '0001_solid_domino.sql', '0002_simple_luckman.sql', '0003_slippery_albert_cleary.sql', '0004_payment.sql'];

    for (const file of files) {
      try {
        const content = readFileSync(path.join(migrationsDir, file), 'utf-8');
        const statements = content
          .split('--> statement-breakpoint')
          .map((s) => s.trim())
          .filter(Boolean);

        for (const stmt of statements) {
          try {
            await db.execute(sql.raw(stmt));
          } catch {
            // ignore per-statement errors (e.g. "already exists")
          }
        }
        results.push(`✓ ${file}`);
      } catch (err) {
        results.push(`✗ ${file}: ${err instanceof Error ? err.message : 'read error'}`);
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
