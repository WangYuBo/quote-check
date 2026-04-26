/**
 * 支付网关工厂
 * MOCK_PAYMENT=true 时使用 mock，否则使用 xorpay
 */
import { env } from '@/lib/env';
import type { PaymentGateway } from './gateway';
import { MockPaymentGateway } from './mock';
import { XorpayGateway } from './xorpay';

let gateway: PaymentGateway | null = null;

export function getPaymentGateway(): PaymentGateway {
  if (gateway) return gateway;
  if (env.MOCK_PAYMENT) {
    gateway = new MockPaymentGateway();
  } else {
    gateway = new XorpayGateway();
  }
  return gateway;
}

export type { PaymentGateway } from './gateway';
export type { CreateOrderParams, CreateOrderResult, QueryOrderResult } from './gateway';
