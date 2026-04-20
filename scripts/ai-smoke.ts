// 本机代理（ClashX/V2ray）会劫持 HTTPS 到硅基流动 → ECONNRESET
// 脚本内显式清空，避免用户每次 env -u。生产 Vercel 无此问题
const PROXY_VARS = [
  'http_proxy',
  'https_proxy',
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'all_proxy',
  'ALL_PROXY',
];
const cleared: string[] = [];
for (const v of PROXY_VARS) {
  const existing = process.env[v];
  if (existing) {
    cleared.push(`${v}=${existing}`);
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete process.env[v];
  }
}
if (cleared.length) {
  console.log(`[ai:smoke] 已清除代理环境变量（仅本进程）：${cleared.join(', ')}`);
}

import { generateText } from 'ai';

import { DEFAULT_GENERATION_OPTIONS, defaultModel, MODEL_ID } from '@/lib/ai/client';

/**
 * DeepSeek（via 硅基流动）最小冒烟
 *
 * 运行：bun run ai:smoke
 *
 * 目的：
 *   - 验证 env.SILICONFLOW_API_KEY + baseURL 能跑通
 *   - 不进 vitest 套件（每次跑会消耗 token，且需要真实外网）
 *   - CI 不跑；人工变更 client.ts / 模型名称时手动跑
 *
 * 期望输出：
 *   [ai:smoke] model = deepseek-ai/DeepSeek-V3.2
 *   [ai:smoke] reply = OK
 *   [ai:smoke] usage = { promptTokens: N, completionTokens: N, totalTokens: N }
 *   [ai:smoke] ✓ 握手成功，耗时 XXXms
 */

async function main() {
  const started = Date.now();
  console.log(`[ai:smoke] model = ${MODEL_ID}`);
  console.log('[ai:smoke] → 发起最小调用（prompt=Reply with OK only）');

  const { text, usage } = await generateText({
    model: defaultModel,
    prompt: 'Reply with "OK" only. No other output.',
    ...DEFAULT_GENERATION_OPTIONS,
  });

  console.log(`[ai:smoke] reply = ${JSON.stringify(text.trim())}`);
  console.log(`[ai:smoke] usage =`, usage);
  console.log(`[ai:smoke] ✓ 握手成功，耗时 ${Date.now() - started}ms`);
}

main().catch((err) => {
  console.error('[ai:smoke] ✗ 失败：', err);
  process.exit(1);
});
