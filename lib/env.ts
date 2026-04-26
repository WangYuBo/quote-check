import { z } from 'zod';

// spec-coding §19 单一校验出口
// 应用代码禁止直接 process.env.X；必须从此文件 import env
//
// 严格模式：非 test 环境下启动失败 = 真失败（不给静默占位）
// test 环境允许占位，便于 CI 在不配 DB 的前提下跑 typecheck/lint

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  SILICONFLOW_API_KEY: z.string().min(20),
  INNGEST_EVENT_KEY: z.string().min(10),
  INNGEST_SIGNING_KEY: z.string().min(10),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
  COST_CAP_CNY: z.coerce.number().positive().default(50),
  TTL_DAYS: z.coerce.number().int().positive().default(7),
  DEMO_MODE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  XORPAY_AID: z.string().optional(),
  XORPAY_APP_SECRET: z.string().optional(),
  MOCK_PAYMENT: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  COS_SECRET_ID: z.string().min(1),
  COS_SECRET_KEY: z.string().min(1),
  COS_BUCKET_REGION: z.string().min(1),
  COS_BUCKET: z.string().min(1),
  SITE_DOMAIN: z.string().url(),
});

type Env = z.infer<typeof envSchema>;

function parseEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (result.success) return result.data;

  const isTest = process.env['NODE_ENV'] === 'test';
  const issues = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');

  if (isTest) {
    console.warn(`[env] 测试环境缺失字段（已占位）：\n${issues}`);
    return envSchema.parse({
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      BETTER_AUTH_SECRET: 'test-secret-at-least-thirty-two-chars-long',
      BETTER_AUTH_URL: 'http://localhost:3000',
      SILICONFLOW_API_KEY: 'sk-test-placeholder-xxxxxxxxxxxxxxxxxxx',
      INNGEST_EVENT_KEY: 'test-event-key',
      INNGEST_SIGNING_KEY: 'signkey-test',
      XORPAY_AID: 'test',
      XORPAY_APP_SECRET: 'test-secret',
      MOCK_PAYMENT: 'true',
      COS_SECRET_ID: 'test-cos-secret-id',
      COS_SECRET_KEY: 'test-cos-secret-key',
      COS_BUCKET_REGION: 'ap-guangzhou',
      COS_BUCKET: 'test-bucket',
      SITE_DOMAIN: 'http://localhost:3000',
      ...process.env,
      NODE_ENV: 'test',
    });
  }

  throw new Error(`[env] 环境变量校验失败：\n${issues}`);
}

export const env = parseEnv();
export type { Env };
