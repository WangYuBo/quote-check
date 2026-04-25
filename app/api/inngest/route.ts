import { serve } from 'inngest/next';

import { inngest } from '@/inngest/client';
import { costGuardFn } from '@/inngest/functions/cost-guard';
import { pingFn } from '@/inngest/functions/ping';
import { proofreadRunFn } from '@/inngest/functions/proofread-run';
import { ttlDestroyFn } from '@/inngest/functions/ttl-destroy';
import { env } from '@/lib/env';

/**
 * Inngest serve handler（GET/POST/PUT）
 *
 * - 路径：/api/inngest（Inngest Cloud 注册时的默认 URL）
 * - GET：返回函数清单 + 版本，供 Inngest dev server & Cloud dashboard 自省
 * - POST：接收 Inngest Cloud 投递的事件，调用对应函数
 * - PUT：sync 端点，Inngest Cloud 推送"重新注册函数清单"请求
 * - signingKey：生产环境强校验 HMAC 签名（env.INNGEST_SIGNING_KEY）；
 *   本地 dev 可留空，inngest-cli 会跳过签名
 */
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [pingFn, proofreadRunFn, costGuardFn, ttlDestroyFn],
  signingKey: env.INNGEST_SIGNING_KEY,
});
