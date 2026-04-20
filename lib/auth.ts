import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';

import { db, schema } from '@/lib/db';
import { env } from '@/lib/env';

/**
 * Better Auth 服务端实例
 *
 * spec-system-architecture ADR-004 · spec-product-requirements MS-L-01/02 · MS-D-01
 *
 * 设计要点：
 *   - emailAndPassword：MVP 阶段启用；requireEmailVerification 先关，避免首次冒烟被邮件阻塞
 *   - drizzleAdapter(db, {provider:'pg', schema})：复用 lib/db/schema.ts 的 user/session/account/verification 四表
 *   - generateId: false：用 PG 的 gen_random_uuid() 作为 id（schema.user.id 已是 uuid + defaultRandom()）
 *   - session.expiresIn: 7d（C 端默认；B 端差异化通过后续 hook 在 signIn 时覆盖 expiresAt）
 *   - user.additionalFields.role：'B' | 'C' | 'admin'，input:false 防止用户自行提升权限
 *
 * 不在这里做的（按 spec 锁定）：
 *   - requireEmailVerification = true：进入正式邀请内测前开启
 *   - RBAC 插件（admin 授权）：MS-D-01 开发时加 plugin
 *   - B 端 4h 会话差异化：进入 MS-L-02 时通过 signIn hook 覆盖
 *   - OAuth provider：v1.0 只做 email + password
 */

export const auth = betterAuth({
  appName: 'quote-check',
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,

  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
    // 让 PG 用 gen_random_uuid() 生成 uuid 主键（schema 已声明 defaultRandom）
    generateId: false,
  }),

  emailAndPassword: {
    enabled: true,
    // MVP 冒烟期暂关；正式内测前改回 true 并配置 sendEmail
    requireEmailVerification: false,
    minPasswordLength: 8,
  },

  session: {
    expiresIn: 7 * 24 * 60 * 60, // 7d
    updateAge: 24 * 60 * 60, // 每 24h 滚动续期一次
  },

  user: {
    additionalFields: {
      role: {
        type: 'string',
        defaultValue: 'C',
        input: false,
      },
      organization: {
        type: 'string',
        required: false,
      },
      agreementVersion: {
        type: 'string',
        required: false,
        input: false,
      },
      agreementAcceptedAt: {
        type: 'date',
        required: false,
        input: false,
      },
      suspendedAt: {
        type: 'date',
        required: false,
        input: false,
      },
    },
  },

  advanced: {
    cookiePrefix: 'qc',
  },
});

export type Auth = typeof auth;
export type Session = typeof auth.$Infer.Session;
