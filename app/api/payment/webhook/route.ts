import { NextRequest, NextResponse } from 'next/server';

import { getPaymentGateway } from '@/lib/payment';
import { confirmPaymentByGatewayOrder } from '@/lib/services/payment';

/**
 * xorpay 支付回调 webhook
 * POST，content-type: application/x-www-form-urlencoded
 * 字段：aoid, order_id, pay_price, pay_time, more, detail, sign
 */
export async function POST(req: NextRequest) {
  const text = await req.text();
  const params = Object.fromEntries(new URLSearchParams(text)) as Record<string, string>;

  // 签名校验
  const gateway = getPaymentGateway();
  if (!gateway.verifyNotify(params)) {
    return new NextResponse('sign error', { status: 400 });
  }

  const { aoid } = params;
  if (!aoid) {
    return new NextResponse('missing aoid', { status: 400 });
  }

  try {
    await confirmPaymentByGatewayOrder(aoid);
    return new NextResponse('ok', { status: 200 });
  } catch (err) {
    console.error('[payment] webhook error', err, { aoid });
    return new NextResponse('internal error', { status: 500 });
  }
}
