import { inngest } from '@/inngest/client';
import { pingEvent } from '@/inngest/events';

/**
 * 最小可工作 Inngest 函数——仅用于 Cloud 握手 / 部署冒烟
 */
export const pingFn = inngest.createFunction(
  {
    id: 'system-ping',
    name: 'system · ping（握手冒烟）',
    triggers: [pingEvent],
  },
  async ({ event, step }) => {
    const startedAt = await step.run('record-start', () => new Date().toISOString());
    return {
      ok: true,
      source: event.data['source'],
      note: event.data['note'] ?? null,
      startedAt,
    };
  },
);
