import { serve } from 'inngest/next';

import { inngest } from '@/inngest/client';
import { costGuardFn } from '@/inngest/functions/cost-guard';
import { pingFn } from '@/inngest/functions/ping';
import { proofreadRunFn } from '@/inngest/functions/proofread-run';
import { ttlDestroyFn } from '@/inngest/functions/ttl-destroy';

/**
 * Inngest serve handler（GET/POST/PUT）
 *
 * v4 变更：signingKey 已从 ServeHandlerOptions 移除，SDK 自动从
 * INNGEST_SIGNING_KEY 环境变量读取，无需手动传入。
 */
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [pingFn, proofreadRunFn, costGuardFn, ttlDestroyFn],
});
