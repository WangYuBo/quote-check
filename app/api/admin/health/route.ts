import { NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { user } from '@/lib/db/schema';

/**
 * 健康检查（m3 · 观测接入）
 *
 * 检查 Neon DB 连通性。Blob 和 Inngest 在产品使用路径中自验，此处只做 DB check。
 */
export async function GET() {
  const checks: Record<string, 'ok' | 'fail'> = {};

  try {
    await db.select({ n: user.id }).from(user).limit(1);
    checks['neon'] = 'ok';
  } catch {
    checks['neon'] = 'fail';
  }

  const allOk = Object.values(checks).every((v) => v === 'ok');

  return NextResponse.json(
    { status: allOk ? 'ok' : 'degraded', checks, ts: new Date().toISOString() },
    { status: allOk ? 200 : 503 },
  );
}
