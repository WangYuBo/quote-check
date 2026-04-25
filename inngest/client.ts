import { Inngest } from 'inngest';

import { env } from '@/lib/env';

/**
 * Inngest 客户端单例（v4 · no EventSchemas）
 *
 * v4 移除了 EventSchemas.fromRecord()，事件类型由 eventType() helper 承载。
 * 事件键（INNGEST_EVENT_KEY）由 env.ts 已校验；签名键（INNGEST_SIGNING_KEY）
 * 由 inngest SDK 自动从同名环境变量读取，无需在 serve() 手动传入。
 */
export const inngest = new Inngest({
  id: 'quote-check',
  eventKey: env.INNGEST_EVENT_KEY,
});
