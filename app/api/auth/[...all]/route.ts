import { toNextJsHandler } from 'better-auth/next-js';

import { auth } from '@/lib/auth';

/**
 * Better Auth catch-all 路由
 *
 * - 路径：/api/auth/**（signup / signin / signout / session / verify-email ...）
 * - better-auth 所有内置端点由此接管；新增 plugin 时无需改路由
 * - 对接的 UI：app/(auth)/login · register（MS-L-01/02，后续实装）
 */
export const { GET, POST } = toNextJsHandler(auth.handler);
