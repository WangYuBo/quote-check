import { inngest } from '@/inngest/client';

/**
 * 最小可工作 Inngest 函数——仅用于 Cloud 握手 / 部署冒烟
 *
 * 作用：
 *   1. 让 app/api/inngest 的 serve() 有一个注册项，Inngest Cloud 能完成 sync
 *   2. 生产环境可手动发 'system/ping.requested' 验证 event → function 链路
 *   3. 非业务逻辑；不落 DB，不调外部 API
 *
 * 替代它的是真实三函数（待 MAS 实装时加入）：
 *   - proofread-run（MS-L-05/06/07 · 主工作流 · ADR-002 幂等键三要素）
 *   - ttl-destroy（MS-G-05 · 每 10 分钟扫 task.ttl_expires_at）
 *   - cost-guard（MS-D-04 · 预算越界暂停）
 */
export const pingFn = inngest.createFunction(
  { id: 'system-ping', name: 'system · ping（握手冒烟）' },
  { event: 'system/ping.requested' },
  async ({ event, step }) => {
    const startedAt = await step.run('record-start', () => new Date().toISOString());
    return {
      ok: true,
      source: event.data.source,
      note: event.data.note ?? null,
      startedAt,
    };
  },
);
