import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { getPaymentStatus } from '@/lib/services/payment';

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const paymentOrderId = new URL(req.url).searchParams.get('id');
  if (!paymentOrderId) {
    return NextResponse.json({ error: '缺少 id 参数' }, { status: 400 });
  }

  try {
    const result = await getPaymentStatus(paymentOrderId);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '查询失败' },
      { status: 500 },
    );
  }
}
