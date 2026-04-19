import { EventSchemas, Inngest } from 'inngest';

import { env } from '@/lib/env';

import type { AppEventMap } from './events';

/**
 * Inngest 客户端单例
 *
 * - spec-system-architecture ADR-002：所有长任务走 Inngest，幂等键 {taskId}_{quoteId}_{attemptN}
 * - 事件键（INNGEST_EVENT_KEY）由 env.ts 已校验；未设置时应用侧 send() 会在本地 dev
 *   回退到"仅本地投递"模式（需同时跑 inngest-cli dev）
 * - 类型：AppEventMap 注册所有事件的 payload schema，send() 自带类型推导
 */
export const inngest = new Inngest({
  id: 'quote-check',
  eventKey: env.INNGEST_EVENT_KEY,
  schemas: new EventSchemas().fromRecord<AppEventMap>(),
});
