/**
 * Inngest 事件契约（AppEventMap）
 *
 * - 键：事件名，统一 kebab + dot-namespace（'task/proofread.requested'）
 * - 值：{ data: PayloadT }（Inngest 约定）
 * - 未来添加 proofread-run / ttl-destroy / cost-guard 相关事件时在此注册；
 *   client.send() 会自动获得类型推导
 *
 * 当前仅 system/ping.requested 一条，作为 Inngest Cloud 握手验证
 */

// 使用 type 而非 interface：Inngest EventSchemas.fromRecord<T> 要求 T 满足
// { [key: string]: { data: unknown } } 的隐式索引签名约束；TS 中 interface
// 不自动满足（允许声明合并），type alias 才能直接通过校验。
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type AppEventMap = {
  'system/ping.requested': {
    data: {
      source: 'dev' | 'prod';
      note?: string;
    };
  };
};

export type AppEventName = keyof AppEventMap;
