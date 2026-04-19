/**
 * DB 客户端（Neon HTTP 驱动）
 *
 * - ADR-003：Neon + Drizzle + HTTP 驱动（无需管理连接池）
 * - env.ts 已校验 DATABASE_URL；此处不再兜底
 * - 单例导出，避免 RSC / Route Handler / Inngest 多处重复建连
 */
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

import { env } from '@/lib/env';

import * as schema from './schema';

const sql = neon(env.DATABASE_URL);

export const db = drizzle(sql, { schema });

export type DB = typeof db;

// 便捷再导出（避免业务代码重复 import schema 文件）
export { schema };
