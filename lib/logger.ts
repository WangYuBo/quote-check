import pino from 'pino';

import { env } from '@/lib/env';

/**
 * 结构化日志（MAS-6 · notes #2）
 *
 * redact 强制脱敏：原文片段绝不落日志，只记任务/引文 ID 和元数据。
 * 生产环境关闭 pino-pretty，直接输出 JSON 供 Vercel Log Drain 或 Logtail 解析。
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      '*.quoteText',
      '*.manuscriptText',
      '*.referenceSnippet',
      '*.snippet',
      '*.context',
      '*.rawOutput',
      'rawOutput',
      'body.text',
      'body.*.quote',
      'body.*.snippet',
    ],
    censor: '[REDACTED]',
  },
  ...(env.NODE_ENV === 'development' && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:HH:MM:ss' },
    },
  }),
});
