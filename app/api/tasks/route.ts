import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { estimateCostFen } from '@/lib/ai/cost';
import { getManuscript } from '@/lib/services/manuscript';

/**
 * POST /api/tasks — 旧接口，已被 /api/payment/create-order 取代
 * 保留以兼容，但不再自动推进 VERIFYING
 */
export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { manuscriptId?: string; referenceIds?: string[] };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: '无效 JSON' }, { status: 400 });
  }

  if (!body.manuscriptId) {
    return NextResponse.json({ error: '缺少 manuscriptId' }, { status: 400 });
  }

  const doc = await getManuscript(body.manuscriptId);
  if (!doc) {
    return NextResponse.json({ error: '书稿不存在' }, { status: 404 });
  }
  if (doc.userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json(
    {
      message: '请使用 /api/payment/create-order 发起支付后创建任务',
      manuscriptId: body.manuscriptId,
    },
    { status: 400 },
  );
}
