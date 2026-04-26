/**
 * xorpay 微信 Native 扫码支付实现
 *
 * 下单：POST https://xorpay.com/api/pay/{aid}
 *   签名：MD5(name + pay_type + price + order_id + notify_url + app_secret)
 * 查询：GET https://xorpay.com/api/query/{aoid}
 * 回调验证：MD5(aoid + order_id + pay_price + pay_time + app_secret)
 */
import { createHash } from 'crypto';

import { env } from '@/lib/env';
import type { CreateOrderParams, CreateOrderResult, PaymentGateway, QueryOrderResult } from './gateway';

function md5(s: string): string {
  return createHash('md5').update(s).digest('hex');
}

export class XorpayGateway implements PaymentGateway {
  private aid: string;
  private appSecret: string;
  private baseUrl = 'https://xorpay.com/api';

  constructor() {
    this.aid = env.XORPAY_AID ?? '';
    this.appSecret = env.XORPAY_APP_SECRET ?? '';
    if (!this.aid || !this.appSecret) {
      throw new Error('[xorpay] XORPAY_AID 和 XORPAY_APP_SECRET 必须配置');
    }
  }

  /** 下单签名：MD5(name + pay_type + price + order_id + notify_url + app_secret) */
  private signCreate(
    name: string,
    payType: string,
    price: string,
    orderId: string,
    notifyUrl: string,
  ): string {
    return md5(name + payType + price + orderId + notifyUrl + this.appSecret);
  }

  async createOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
    const payType = 'native'; // 微信 Native 扫码支付
    const sign = this.signCreate(params.name, payType, params.price, params.orderId, params.notifyUrl);

    const body = new URLSearchParams({
      name: params.name,
      pay_type: payType,
      price: params.price,
      order_id: params.orderId,
      notify_url: params.notifyUrl,
      sign,
    });
    if (params.orderUid) body.set('order_uid', params.orderUid);
    if (params.more) body.set('more', params.more);
    if (params.expire) body.set('expire', String(params.expire));

    try {
      const res = await fetch(`${this.baseUrl}/pay/${this.aid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
      const data = (await res.json()) as {
        status?: string;
        info?: { qr?: string };
        aoid?: string;
        expires_in?: number;
      };

      if (data.status === 'ok') {
        const result: CreateOrderResult = { ok: true };
        if (data.aoid) result.gatewayOrderId = data.aoid;
        if (data.info?.qr) result.qrCode = data.info.qr;
        if (data.expires_in) result.expiresIn = data.expires_in;
        return result;
      }

      return { ok: false, error: `xorpay error: ${data.status}` };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async queryOrder(gatewayOrderId: string): Promise<QueryOrderResult> {
    try {
      const res = await fetch(`${this.baseUrl}/query/${gatewayOrderId}`);
      const data = (await res.json()) as { status?: string };
      return { status: (data.status as QueryOrderResult['status']) ?? 'not_exist', gatewayOrderId };
    } catch {
      return { status: 'not_exist' as const };
    }
  }

  /** 回调签名验证：MD5(aoid + order_id + pay_price + pay_time + app_secret) */
  verifyNotify(body: Record<string, string>): boolean {
    const { aoid, order_id, pay_price, pay_time, sign } = body;
    if (!aoid || !order_id || !pay_price || !pay_time || !sign) return false;

    const expected = md5(aoid + order_id + pay_price + pay_time + this.appSecret);
    return expected === sign;
  }
}
