/**
 * TTL 销毁（MAS-6 · MS-D-05 · real.md #3）
 *
 * 每 10 分钟扫描 ttl_expires_at 已过期且 destroyedAt=null 的任务，
 * 删除 Vercel Blob 上的书稿 + 参考文件，标记 destroyed_at。
 *
 * 不删除 verification_result / report_snapshot（real.md #7 版本冻结原则）。
 */
import { and, eq, isNull, lt } from 'drizzle-orm';

import { inngest } from '@/inngest/client';
import { logger } from '@/lib/logger';
import { db } from '@/lib/db';
import { manuscript, reference, task } from '@/lib/db/schema';
import { deleteBlobByUrl } from '@/lib/storage/blob';

export const ttlDestroyFn = inngest.createFunction(
  {
    id: 'ttl-destroy',
    name: 'TTL 销毁 · 过期书稿清理',
    concurrency: { limit: 1 },
    triggers: [{ cron: '*/10 * * * *' }],
  },
  async ({ step }) => {
    const expired = await step.run('scan-expired', async () => {
      return db
        .select({ id: task.id, manuscriptId: task.manuscriptId })
        .from(task)
        .where(and(lt(task.ttlExpiresAt, new Date()), isNull(task.destroyedAt)));
    });

    if (expired.length === 0) {
      logger.info('[ttl-destroy] 无过期任务');
      return { destroyed: 0 };
    }

    logger.info({ count: expired.length }, '[ttl-destroy] 发现过期任务');

    let destroyed = 0;
    for (const t of expired) {
      await step.run(`destroy-${t.id}`, async () => {
        // 1. 删书稿 Blob
        const msRow = await db
          .select({ blobUrl: manuscript.blobUrl })
          .from(manuscript)
          .where(eq(manuscript.id, t.manuscriptId))
          .then((rows) => rows[0]);

        if (msRow?.blobUrl) {
          try { await deleteBlobByUrl(msRow.blobUrl); } catch { /* 已删或不存在 */ }
        }

        // 2. 删此书稿关联的参考文件 Blob（通过 task.referenceIds）
        const taskRow = await db
          .select({ referenceIds: task.referenceIds })
          .from(task)
          .where(eq(task.id, t.id))
          .then((rows) => rows[0]);

        if (taskRow?.referenceIds?.length) {
          const refs = await db
            .select({ blobUrl: reference.blobUrl })
            .from(reference)
            .where(and(isNull(reference.deletedAt)));

          for (const ref of refs) {
            if (ref.blobUrl) {
              try { await deleteBlobByUrl(ref.blobUrl); } catch { /* 忽略 */ }
            }
          }
        }

        // 3. 标记 task.destroyedAt + manuscript.destroyedAt
        await db.update(task).set({ destroyedAt: new Date() }).where(eq(task.id, t.id));
        await db.update(manuscript).set({ destroyedAt: new Date() }).where(eq(manuscript.id, t.manuscriptId));
      });
      destroyed++;
    }

    logger.info({ destroyed }, '[ttl-destroy] 完成');
    return { destroyed };
  },
);
