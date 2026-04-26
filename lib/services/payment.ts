import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { paymentOrder, task } from '@/lib/db/schema';
import type { PaymentOrder } from '@/lib/db/types';
import { env } from '@/lib/env';
import { getPaymentGateway } from '@/lib/payment';
import { createTask, updateTaskStatus } from './task';

const PAY_NOTIFY_URL = `${env.SITE_DOMAIN}/api/payment/webhook`;

/** 创建任务 + 支付订单，返回 QR 码 */
export async function createPaymentOrder(params: {
  userId: string;
  manuscriptId: string;
  referenceIds?: string[];
  amountFen: number;
  amountYuan: string;
  name: string;
}) {
  // 1. 创建任务（PENDING_PAYMENT）
  const newTask = await createTask({
    userId: params.userId,
    manuscriptId: params.manuscriptId,
    referenceIds: params.referenceIds ?? [],
    costEstimatedFen: params.amountFen,
  });

  const orderId = `${newTask.displayId}_${Date.now()}`;

  // 2. 调用网关下单
  const gateway = getPaymentGateway();
  const result = await gateway.createOrder({
    name: params.name,
    price: params.amountYuan,
    orderId,
    notifyUrl: PAY_NOTIFY_URL,
    orderUid: params.userId,
    more: JSON.stringify({ taskId: newTask.id }),
    expire: 7200,
  });

  if (!result.ok || !result.qrCode) {
    throw new Error(result.error ?? '创建支付订单失败');
  }

  // 3. 写入 payment_order 记录
  await db.insert(paymentOrder).values({
    taskId: newTask.id,
    userId: params.userId,
    amountFen: params.amountFen,
    gateway: gateway.constructor.name === 'XorpayGateway' ? 'xorpay' : 'mock',
    gatewayOrderId: result.gatewayOrderId ?? null,
    gatewayQrCode: result.qrCode ?? null,
    paymentMethod: 'wechat',
    status: 'pending',
    expiresAt: result.expiresIn
      ? new Date(Date.now() + result.expiresIn * 1000)
      : new Date(Date.now() + 7200 * 1000),
  });

  return {
    taskId: newTask.id,
    displayId: newTask.displayId,
    qrCode: result.qrCode,
    paymentOrderId: result.gatewayOrderId,
  };
}

/** 查询支付状态 */
export async function getPaymentStatus(paymentOrderId: string): Promise<{
  status: string;
  taskId?: string;
}> {
  const order = await db
    .select()
    .from(paymentOrder)
    .where(eq(paymentOrder.gatewayOrderId, paymentOrderId))
    .limit(1)
    .then((r) => r[0]);

  if (!order) return { status: 'not_found' };

  // 已确认支付
  if (order.status === 'paid') {
    return { status: 'paid', taskId: order.taskId };
  }

  // 查询网关
  if (order.gatewayOrderId) {
    const gateway = getPaymentGateway();
    const qResult = await gateway.queryOrder(order.gatewayOrderId);

    if (qResult.status === 'success' || qResult.status === 'payed') {
      // 确认支付
      await confirmPayment(order.id);
      return { status: 'paid', taskId: order.taskId };
    }

    if (qResult.status === 'expire') {
      await db.update(paymentOrder).set({ status: 'expired' }).where(eq(paymentOrder.id, order.id));
      return { status: 'expired' };
    }
  }

  return { status: 'pending' };
}

/** 确认支付：更新 payment_order + 推进 task 到 VERIFYING */
export async function confirmPayment(paymentOrderId: string): Promise<void> {
  const order = await db
    .select()
    .from(paymentOrder)
    .where(eq(paymentOrder.id, paymentOrderId))
    .limit(1)
    .then((r) => r[0]);

  if (!order || order.status === 'paid') return; // 幂等

  const now = new Date();
  await db
    .update(paymentOrder)
    .set({ status: 'paid', paidAt: now, updatedAt: now })
    .where(eq(paymentOrder.id, paymentOrderId));

  // 推进任务到 VERIFYING
  await updateTaskStatus(order.taskId, 'VERIFYING');
}

/** 通过网关订单号确认支付（webhook 用） */
export async function confirmPaymentByGatewayOrder(gatewayOrderId: string): Promise<void> {
  const order = await db
    .select()
    .from(paymentOrder)
    .where(eq(paymentOrder.gatewayOrderId, gatewayOrderId))
    .limit(1)
    .then((r) => r[0]);

  if (order) {
    await confirmPayment(order.id);
  }
}
