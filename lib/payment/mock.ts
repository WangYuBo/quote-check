/**
 * Mock 支付网关 —— 开发/测试用
 * 创建订单后自动在 3 秒后将状态变为 paid
 */
import type { CreateOrderParams, CreateOrderResult, PaymentGateway, QueryOrderResult } from './gateway';

// 模拟已支付的订单
const mockPaid = new Set<string>();

export class MockPaymentGateway implements PaymentGateway {
  async createOrder(_params: CreateOrderParams): Promise<CreateOrderResult> {
    const gatewayOrderId = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // 3 秒后自动标记为已支付
    setTimeout(() => mockPaid.add(gatewayOrderId), 3000);

    return {
      ok: true,
      gatewayOrderId,
      qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=mock-order-${gatewayOrderId}`,
      expiresIn: 7200,
    };
  }

  async queryOrder(gatewayOrderId: string): Promise<QueryOrderResult> {
    if (mockPaid.has(gatewayOrderId)) {
      return { status: 'success', gatewayOrderId };
    }
    return { status: 'new', gatewayOrderId };
  }

  verifyNotify(_body: Record<string, string>): boolean {
    return true;
  }
}
