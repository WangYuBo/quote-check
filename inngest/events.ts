/**
 * Inngest 事件契约（v4 · eventType + staticSchema）
 *
 * v4 API：eventType(name, { schema }) 注册事件类型，触发器在 createFunction 的
 * triggers 数组中使用，handler 自动获得类型推导。
 * v4 中 staticSchema 描述的是 event.data 的 payload 形状（不含 data 包装）。
 */
import { eventType, staticSchema } from 'inngest';

export const pingEvent = eventType('system/ping.requested', {
  schema: staticSchema<{
    source: 'dev' | 'prod';
    note?: string;
  }>(),
});

export const proofreadRequestedEvent = eventType('task/proofread.requested', {
  schema: staticSchema<{
    taskId: string;
    userId: string;
    triggeredBy: 'user' | 'retry' | 'admin';
    requestedAt: string;
  }>(),
});

export type AppEventName =
  | typeof pingEvent.name
  | typeof proofreadRequestedEvent.name;
