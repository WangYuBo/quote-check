import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { and, desc, eq, gte, lte } from 'drizzle-orm';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { auditLog } from '@/lib/db/schema';

/**
 * 审计日志查询（m3 · 观测接入）
 *
 * GET /api/admin/audit?userId=&op=&from=&to=&limit=
 *
 * 仅限本人查询自己的日志；日志内容不含原文片段（notes #2）。
 */
export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const op = sp.get('op') ?? undefined;
  const fromStr = sp.get('from');
  const toStr = sp.get('to');
  const from = fromStr ? new Date(fromStr) : undefined;
  const to = toStr ? new Date(toStr) : undefined;
  const limit = Math.min(Number(sp.get('limit') ?? '50'), 200);

  const conditions = [eq(auditLog.userId, session.user.id)];
  if (op) conditions.push(eq(auditLog.op, op));
  if (from) conditions.push(gte(auditLog.createdAt, from));
  if (to) conditions.push(lte(auditLog.createdAt, to));

  const rows = await db
    .select({
      id: auditLog.id,
      op: auditLog.op,
      targetType: auditLog.targetType,
      targetId: auditLog.targetId,
      metadataJson: auditLog.metadataJson,
      createdAt: auditLog.createdAt,
    })
    .from(auditLog)
    .where(and(...conditions))
    .orderBy(desc(auditLog.createdAt))
    .limit(limit);

  return NextResponse.json({ logs: rows, count: rows.length });
}
