import { createOpenAI } from '@ai-sdk/openai';

import { env } from '@/lib/env';

/**
 * DeepSeek（via 硅基流动）LLM 客户端
 *
 * spec-system-architecture ADR-005 · spec-product-requirements §5
 *
 * 设计要点：
 *   - 硅基流动是 OpenAI 兼容端点；@ai-sdk/openai + baseURL 即可复用全部 generateObject/Text
 *   - 模型名称是"provider/model"形式：'deepseek-ai/DeepSeek-V3.2'（版本戳会序列化进 report_snapshot）
 *   - 默认 temperature = 0，保证同一 prompt + 同一引文复跑结果一致（便于幂等/重放/对账）
 *   - 不在此处做重试/超时——长任务流程由 Inngest step.run 管控（幂等键 {taskId}_{quoteId}_{attemptN}）
 *
 * 不在这里做的（故意）：
 *   - 审核拒绝识别：lib/ai/moderation.ts 的 isModerationRejection()
 *   - 版本戳冻结：lib/ai/prompts.ts 的 PROMPT_VERSION + SHA256
 *   - 置信度打分：lib/ai/confidence.ts（三信号融合，ADR-007，不得依赖 LLM 自评）
 */

// Dev-only 告警：若 shell 存在 http_proxy/https_proxy，本机运行时会被劫持到本地代理
// （ClashX/V2ray 等），导致 ECONNRESET。Vercel 生产环境不会有此问题
if (env.NODE_ENV !== 'production') {
  const proxyVars = ['http_proxy', 'https_proxy', 'HTTP_PROXY', 'HTTPS_PROXY', 'all_proxy'];
  const hit = proxyVars.filter((v) => process.env[v]);
  if (hit.length) {
    console.warn(
      `[ai/client] ⚠ 检测到代理环境变量 (${hit.join(',')})；bun/Node fetch 会经代理转发到硅基流动，可能出现 ECONNRESET。若出错请在启动命令前加 env -u ${hit.join(' -u ')}。`,
    );
  }
}

export const siliconflow = createOpenAI({
  apiKey: env.SILICONFLOW_API_KEY,
  baseURL: 'https://api.siliconflow.cn/v1',
});

/**
 * v1.0 默认模型标识符——进入 version_stamp.modelId，作为报告版本戳的一部分
 * 变更需同步升 report_snapshot.versionStamp.modelId 并在 CHANGELOG 登记
 */
export const MODEL_ID = 'deepseek-ai/DeepSeek-V3.2' as const;
export type ModelId = typeof MODEL_ID;

export const defaultModel = siliconflow(MODEL_ID);

/**
 * 业务默认生成参数（与 generateObject / generateText 组合使用）
 *   - temperature 0：可重放
 *   - maxRetries 0：交给 Inngest 的 step.run 做分布式重试，避免双层重试
 */
export const DEFAULT_GENERATION_OPTIONS = {
  temperature: 0,
  maxRetries: 0,
} as const;
