/**
 * PG 触发器契约测（spec-quality-assurance §4.1）
 *
 * 覆盖 lib/db/migrations/_hand_triggers.sql 的 T-01 ~ T-06 + C-03（status CHECK）：
 *
 *   T-01 trg_report_snapshot_freeze       frozen 后 UPDATE/DELETE 拒
 *   T-02 trg_task_version_stamp_freeze    version_stamp_frozen_at 后 stamp/frozen_at 不可改
 *   T-03 trg_verification_result_immutable 核心字段写入后不可改；raw_response_* 可改
 *   T-04 trg_audit_log_append_only         UPDATE/DELETE 全拒
 *   T-05 trg_agreement_append_only         UPDATE/DELETE 全拒（复用 T-04 函数）
 *   T-06 trg_prompt_version_immutable      UPDATE/DELETE 全拒
 *   C-03 chk_task_status_allowed           status 非法值 INSERT/UPDATE 拒
 *
 * 为什么必须走真实 Postgres：PL/pgSQL 触发器行为无法 mock，且"frozen 后写被拒"是
 * 唯一真实的线上防线（应用层可能绕过）。memory quote-check-contract-tests-testcontainers。
 *
 * 规约漂移提醒（spec §4.1 vs 实际）：
 *   spec §4.1 表格里的触发器名（prevent_verification_result_frozen_fields_update /
 *   cascade_task_frozen_at / forbid_prompt_version_mutation / archive_result_reference_hit）
 *   与实际 _hand_triggers.sql 存在偏差——本测试以**实际 SQL 文件**为权威。
 *   后续应更新 spec §4.1 表格（列为路线图 m1 技术债）。
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let container: StartedPostgreSqlContainer;
let client: Client;

// 容器启动 + 迁移应用需要 30-60s（首次拉镜像更长）
const BOOT_TIMEOUT = 180_000;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('quote_check_test')
    .withUsername('test')
    .withPassword('test')
    .start();

  client = new Client({ connectionString: container.getConnectionUri() });
  await client.connect();

  // 0000 建表（drizzle 生成；`--> statement-breakpoint` 对 pg 是注释，整段一次性执行）
  const initSql = readFileSync(
    resolve(process.cwd(), 'lib/db/migrations/0000_wakeful_kat_farrell.sql'),
    'utf-8',
  );
  await client.query(initSql);

  // 0001 修 session.token drop not null（drizzle 生成）
  const patchSql = readFileSync(
    resolve(process.cwd(), 'lib/db/migrations/0001_solid_domino.sql'),
    'utf-8',
  );
  await client.query(patchSql);

  // 0002 新增 reference_paragraph 表（MAS-2）
  const refParaSql = readFileSync(
    resolve(process.cwd(), 'lib/db/migrations/0002_simple_luckman.sql'),
    'utf-8',
  );
  await client.query(refParaSql);

  // _hand_triggers 触发器 + GIN + CHECK + 视图 + 归档表
  const trigSql = readFileSync(
    resolve(process.cwd(), 'lib/db/migrations/_hand_triggers.sql'),
    'utf-8',
  );
  await client.query(trigSql);
}, BOOT_TIMEOUT);

afterAll(async () => {
  await client?.end();
  await container?.stop();
});

/**
 * 建一个最小合法 user 并返回 id；被多个测试复用作为外键起点
 */
async function seedUser(email = `u-${Date.now()}-${Math.random()}@test`) {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO "user" (email, role) VALUES ($1, 'C') RETURNING id`,
    [email],
  );
  return rows[0]!.id;
}

async function seedTask(userId: string) {
  const {
    rows: [m],
  } = await client.query<{ id: string }>(
    `INSERT INTO "manuscript" (user_id, display_id, filename, mime_type, file_size, blob_url, blob_pathname)
     VALUES ($1, 'M-' || substr(md5(random()::text), 1, 8),
             'x.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
             100, 'blob://x', 'x/x.docx')
     RETURNING id`,
    [userId],
  );
  const {
    rows: [t],
  } = await client.query<{ id: string }>(
    `INSERT INTO "task" (user_id, manuscript_id, display_id, status, ttl_expires_at)
     VALUES ($1, $2, 'T-' || substr(md5(random()::text), 1, 8), 'PENDING_PARSE', now() + interval '7 days')
     RETURNING id`,
    [userId, m!.id],
  );
  return { manuscriptId: m!.id, taskId: t!.id };
}

/* ─────────────────────────────────────────────
 * T-01 report_snapshot 冻结后 UPDATE/DELETE 拒
 * ───────────────────────────────────────────── */

describe('T-01 prevent_frozen_report_mutation', () => {
  it('写入 frozen_at 后，UPDATE 应被拒绝', async () => {
    const u = await seedUser();
    const { taskId } = await seedTask(u);
    const {
      rows: [snap],
    } = await client.query<{ id: string }>(
      `INSERT INTO report_snapshot (task_id, version_stamp_json, results_aggregate, frozen_at)
       VALUES ($1, '{}'::jsonb, '{}'::jsonb, now())
       RETURNING id`,
      [taskId],
    );
    await expect(
      client.query(
        `UPDATE report_snapshot SET results_aggregate = '{"x":1}'::jsonb WHERE id = $1`,
        [snap!.id],
      ),
    ).rejects.toThrow(/frozen.*cannot be modified/i);
  });

  it('frozen 行 DELETE 也应被拒绝', async () => {
    const u = await seedUser();
    const { taskId } = await seedTask(u);
    const {
      rows: [snap],
    } = await client.query<{ id: string }>(
      `INSERT INTO report_snapshot (task_id, version_stamp_json, results_aggregate, frozen_at)
       VALUES ($1, '{}'::jsonb, '{}'::jsonb, now())
       RETURNING id`,
      [taskId],
    );
    await expect(
      client.query(`DELETE FROM report_snapshot WHERE id = $1`, [snap!.id]),
    ).rejects.toThrow(/frozen.*cannot be modified/i);
  });
});

/* ─────────────────────────────────────────────
 * T-02 task.version_stamp 冻结单向写
 * ───────────────────────────────────────────── */

describe('T-02 prevent_version_stamp_mutation', () => {
  it('未冻结时可以随意写 version_stamp', async () => {
    const u = await seedUser();
    const { taskId } = await seedTask(u);
    await expect(
      client.query(`UPDATE task SET version_stamp = '{"modelId":"a"}'::jsonb WHERE id = $1`, [
        taskId,
      ]),
    ).resolves.toBeDefined();
  });

  it('写入 version_stamp_frozen_at 后，改 version_stamp 被拒', async () => {
    const u = await seedUser();
    const { taskId } = await seedTask(u);
    await client.query(
      `UPDATE task SET version_stamp = '{"modelId":"a"}'::jsonb,
                      version_stamp_frozen_at = now() WHERE id = $1`,
      [taskId],
    );
    await expect(
      client.query(`UPDATE task SET version_stamp = '{"modelId":"b"}'::jsonb WHERE id = $1`, [
        taskId,
      ]),
    ).rejects.toThrow(/version_stamp is frozen/i);
  });

  it('frozen_at 本身也不能清回 NULL', async () => {
    const u = await seedUser();
    const { taskId } = await seedTask(u);
    await client.query(
      `UPDATE task SET version_stamp = '{"modelId":"a"}'::jsonb,
                      version_stamp_frozen_at = now() WHERE id = $1`,
      [taskId],
    );
    await expect(
      client.query(`UPDATE task SET version_stamp_frozen_at = NULL WHERE id = $1`, [taskId]),
    ).rejects.toThrow(/one-way/i);
  });
});

/* ─────────────────────────────────────────────
 * T-03 verification_result 核心字段不可改
 * ───────────────────────────────────────────── */

describe('T-03 prevent_result_mutation', () => {
  async function seedResult() {
    const u = await seedUser();
    const { manuscriptId, taskId } = await seedTask(u);
    const {
      rows: [p],
    } = await client.query<{ id: string }>(
      `INSERT INTO paragraph (manuscript_id, seq, display_id, text, text_hash)
       VALUES ($1, 1, 'P-1', '昔者', 'h1') RETURNING id`,
      [manuscriptId],
    );
    const {
      rows: [q],
    } = await client.query<{ id: string }>(
      `INSERT INTO quote (paragraph_id, manuscript_id, seq, display_id, quote_text, kind)
       VALUES ($1, $2, 1, 'Q-1', '昔者', 'DIRECT') RETURNING id`,
      [p!.id, manuscriptId],
    );
    const {
      rows: [r],
    } = await client.query<{ id: string }>(
      `INSERT INTO verification_result
         (task_id, quote_id, match_status,
          verdict_text_accuracy, verdict_interpretation, verdict_context,
          confidence, confidence_breakdown, idempotency_key)
       VALUES ($1, $2, 'MATCH',
         '{"verdict":"MATCH","explanation":"ok"}'::jsonb,
         '{"verdict":"CONSISTENT","explanation":"ok"}'::jsonb,
         '{"verdict":"APPROPRIATE","explanation":"ok"}'::jsonb,
         0.9, '{"refHit":1,"locationValid":1,"crossModel":0,"weights":{"w1":0.5,"w2":0.5,"w3":0},"algoVersion":"v1.0"}'::jsonb,
         'idem-' || substr(md5(random()::text), 1, 12))
       RETURNING id`,
      [taskId, q!.id],
    );
    return r!.id;
  }

  it('改 verdict_text_accuracy 被拒', async () => {
    const id = await seedResult();
    await expect(
      client.query(
        `UPDATE verification_result
         SET verdict_text_accuracy = '{"verdict":"MISMATCH","explanation":"x"}'::jsonb
         WHERE id = $1`,
        [id],
      ),
    ).rejects.toThrow(/core fields are immutable/i);
  });

  it('改 idempotency_key 被拒', async () => {
    const id = await seedResult();
    await expect(
      client.query(`UPDATE verification_result SET idempotency_key = 'hacked' WHERE id = $1`, [id]),
    ).rejects.toThrow(/core fields are immutable/i);
  });

  it('改 raw_response_snapshot（非核心字段）允许（TTL 销毁通道）', async () => {
    const id = await seedResult();
    await expect(
      client.query(
        `UPDATE verification_result
         SET raw_response_snapshot = NULL, raw_response_destroyed_at = now()
         WHERE id = $1`,
        [id],
      ),
    ).resolves.toBeDefined();
  });
});

/* ─────────────────────────────────────────────
 * T-04 audit_log append-only
 * ───────────────────────────────────────────── */

describe('T-04 audit_log append-only', () => {
  it('INSERT 允许', async () => {
    const u = await seedUser();
    await expect(
      client.query(
        `INSERT INTO audit_log (user_id, op, target_type) VALUES ($1, 'TEST', 'user') RETURNING id`,
        [u],
      ),
    ).resolves.toBeDefined();
  });

  it('UPDATE 被拒', async () => {
    const u = await seedUser();
    const {
      rows: [a],
    } = await client.query<{ id: number }>(
      `INSERT INTO audit_log (user_id, op) VALUES ($1, 'X') RETURNING id`,
      [u],
    );
    await expect(
      client.query(`UPDATE audit_log SET op = 'Y' WHERE id = $1`, [a!.id]),
    ).rejects.toThrow(/audit_log is append-only/i);
  });

  it('DELETE 被拒', async () => {
    const u = await seedUser();
    const {
      rows: [a],
    } = await client.query<{ id: number }>(
      `INSERT INTO audit_log (user_id, op) VALUES ($1, 'X') RETURNING id`,
      [u],
    );
    await expect(client.query(`DELETE FROM audit_log WHERE id = $1`, [a!.id])).rejects.toThrow(
      /audit_log is append-only/i,
    );
  });
});

/* ─────────────────────────────────────────────
 * T-05 user_agreement_acceptance append-only
 * ───────────────────────────────────────────── */

describe('T-05 user_agreement_acceptance append-only', () => {
  it('UPDATE 被拒（复用 T-04 函数，错误信息仍为 audit_log）', async () => {
    const u = await seedUser();
    const {
      rows: [a],
    } = await client.query<{ id: number }>(
      `INSERT INTO user_agreement_acceptance (user_id, agreement_version, agreement_role, checksum)
       VALUES ($1, 'v1.0', 'C', 'sum') RETURNING id`,
      [u],
    );
    await expect(
      client.query(`UPDATE user_agreement_acceptance SET checksum = 'x' WHERE id = $1`, [a!.id]),
    ).rejects.toThrow(/append-only/i);
  });

  it('DELETE 被拒', async () => {
    const u = await seedUser();
    const {
      rows: [a],
    } = await client.query<{ id: number }>(
      `INSERT INTO user_agreement_acceptance (user_id, agreement_version, agreement_role, checksum)
       VALUES ($1, 'v1.0', 'C', 'sum') RETURNING id`,
      [u],
    );
    await expect(
      client.query(`DELETE FROM user_agreement_acceptance WHERE id = $1`, [a!.id]),
    ).rejects.toThrow(/append-only/i);
  });
});

/* ─────────────────────────────────────────────
 * T-06 prompt_version 不可改
 * ───────────────────────────────────────────── */

describe('T-06 prompt_version immutable', () => {
  it('INSERT 允许', async () => {
    await expect(
      client.query(
        `INSERT INTO prompt_version (key, name, version_tag, sha256, byte_size)
         VALUES ('k-' || md5(random()::text), 'extract', 'v1', 'sha', 100)`,
      ),
    ).resolves.toBeDefined();
  });

  it('UPDATE 被拒', async () => {
    const key = `k-${Math.random().toString(36).slice(2)}`;
    await client.query(
      `INSERT INTO prompt_version (key, name, version_tag, sha256, byte_size)
       VALUES ($1, 'extract', 'v1', 'sha', 100)`,
      [key],
    );
    await expect(
      client.query(`UPDATE prompt_version SET sha256 = 'new' WHERE key = $1`, [key]),
    ).rejects.toThrow(/prompt_version is immutable/i);
  });

  it('DELETE 被拒', async () => {
    const key = `k-${Math.random().toString(36).slice(2)}`;
    await client.query(
      `INSERT INTO prompt_version (key, name, version_tag, sha256, byte_size)
       VALUES ($1, 'extract', 'v1', 'sha', 100)`,
      [key],
    );
    await expect(client.query(`DELETE FROM prompt_version WHERE key = $1`, [key])).rejects.toThrow(
      /prompt_version is immutable/i,
    );
  });
});

/* ─────────────────────────────────────────────
 * C-03 task.status 值域 CHECK
 * ───────────────────────────────────────────── */

describe('C-03 task.status CHECK constraint', () => {
  it('合法 status（VERIFYING）可 UPDATE', async () => {
    const u = await seedUser();
    const { taskId } = await seedTask(u);
    await expect(
      client.query(`UPDATE task SET status = 'VERIFYING' WHERE id = $1`, [taskId]),
    ).resolves.toBeDefined();
  });

  it('非法 status（FOO）INSERT 被拒', async () => {
    const u = await seedUser();
    const {
      rows: [m],
    } = await client.query<{ id: string }>(
      `INSERT INTO manuscript (user_id, display_id, filename, mime_type, file_size, blob_url, blob_pathname)
       VALUES ($1, 'M-bad', 'x.docx', 'application/x', 1, 'blob://x', 'x')
       RETURNING id`,
      [u],
    );
    await expect(
      client.query(
        `INSERT INTO task (user_id, manuscript_id, display_id, status, ttl_expires_at)
         VALUES ($1, $2, 'T-bad', 'FOO_BAD', now() + interval '7 days')`,
        [u, m!.id],
      ),
    ).rejects.toThrow(/chk_task_status_allowed/);
  });

  it('非法 status UPDATE 被拒', async () => {
    const u = await seedUser();
    const { taskId } = await seedTask(u);
    await expect(
      client.query(`UPDATE task SET status = 'FOO_BAD' WHERE id = $1`, [taskId]),
    ).rejects.toThrow(/chk_task_status_allowed/);
  });
});

/* ─────────────────────────────────────────────
 * 扩展/索引在场性（I-01/I-02 + pg_trgm）
 * ───────────────────────────────────────────── */

describe('扩展与索引', () => {
  it('pg_trgm 扩展存在', async () => {
    const { rows } = await client.query<{ extname: string }>(
      `SELECT extname FROM pg_extension WHERE extname = 'pg_trgm'`,
    );
    expect(rows.length).toBe(1);
  });

  it('3 个 GIN 索引存在', async () => {
    const { rows } = await client.query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes
       WHERE indexname IN ('idx_task_reference_ids_gin', 'idx_paragraph_text_trgm', 'idx_quote_normalized_trgm')`,
    );
    expect(rows.length).toBe(3);
  });
});
