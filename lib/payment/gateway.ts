/**
 * 支付网关抽象接口
 * 支持 xorpay 和 mock 两种实现，通过 lib/payment/index.ts 工厂切换
 */

export interface CreateOrderParams {
  /** 商品名称 */
  name: string;
  /** 支付金额（元，如 "3.00"） */
  price: string;
  /** 商户侧唯一订单号 */
  orderId: string;
  /** 用户标识（邮箱等） */
  orderUid?: string;
  /** 异步回调地址 */
  notifyUrl: string;
  /** 附加信息，回调时原样返回 */
  more?: string;
  /** 过期秒数 */
  expire?: number;
}

export interface CreateOrderResult {
  /** 网关是否成功 */
  ok: boolean;
  /** 网关侧订单号（aoid） */
  gatewayOrderId?: string;
  /** 二维码链接（用于生成支付二维码） */
  qrCode?: string;
  /** 剩余过期秒数 */
  expiresIn?: number;
  /** 错误信息 */
  error?: string;
}

export interface QueryOrderResult {
  /** 订单状态 */
  status: 'not_exist' | 'new' | 'payed' | 'fee_error' | 'success' | 'expire';
  /** 网关侧订单号 */
  gatewayOrderId?: string;
}

export interface PaymentGateway {
  /** 创建支付订单（返回二维码） */
  createOrder(params: CreateOrderParams): Promise<CreateOrderResult>;
  /** 查询订单状态 */
  queryOrder(gatewayOrderId: string): Promise<QueryOrderResult>;
  /** 验证回调签名 */
  verifyNotify(body: Record<string, string>): boolean;
}
