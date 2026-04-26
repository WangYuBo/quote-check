import { NextRequest, NextResponse } from 'next/server';

import { estimateCostFen, formatFenAsYuan } from '@/lib/ai/cost';
import { auth } from '@/lib/auth';
import { getManuscript } from '@/lib/services/manuscript';
import { createPaymentOrder } from '@/lib/services/payment';

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

  const charCount = doc.charCount ?? 0;
  const estimate = estimateCostFen(charCount);
  const amountYuan = (estimate.estimatedFen / 100).toFixed(2);

  try {
    const result = await createPaymentOrder({
      userId: session.user.id,
      manuscriptId: body.manuscriptId,
      referenceIds: body.referenceIds ?? [],
      amountFen: estimate.estimatedFen,
      amountYuan,
      name: `引用核查 - ${doc.filename ?? '书稿'}`,
    });

    return NextResponse.json(
      {
        taskId: result.taskId,
        displayId: result.displayId,
        qrCode: result.qrCode,
        paymentOrderId: result.paymentOrderId,
        estimate: {
          charCount,
          kiloChars: Math.ceil(charCount / 1000),
          unitPrice: '¥3/千字',
          estimatedDisplay: formatFenAsYuan(estimate.estimatedFen),
        },
      },
      { status: 201 },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '创建支付订单失败' },
      { status: 500 },
    );
  }
}
