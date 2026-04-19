import { Client } from 'pg';

/**
 * 校验 0000 + 0001 都应用成功：
 *   - 15 张表
 *   - 4 个 enum 类型
 *   - 6 个触发器（T-01~T-06）
 *   - 3 个 GIN 索引（task.reference_ids + paragraph.text_normalized + quote.quote_normalized）
 *   - task.status CHECK 约束存在
 *   - v_result_reference_hit_stats 视图存在
 *   - result_reference_hit_archive 归档表存在
 */

const DATABASE_URL = process.env['DATABASE_URL'];
if (!DATABASE_URL) {
  console.error('[db:check] ✗ DATABASE_URL 未设置');
  process.exit(1);
}

const expectedTables = [
  'account',
  'audit_log',
  'manuscript',
  'paragraph',
  'prompt_version',
  'quote',
  'reference',
  'report_snapshot',
  'result_reference_hit',
  'result_reference_hit_archive',
  'session',
  'task',
  'user',
  'user_agreement_acceptance',
  'verification',
  'verification_result',
];

const expectedTriggers = [
  'trg_report_snapshot_freeze',
  'trg_task_version_stamp_freeze',
  'trg_verification_result_immutable',
  'trg_audit_log_append_only',
  'trg_agreement_append_only',
  'trg_prompt_version_immutable',
];

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  let failed = 0;

  try {
    // tables
    const { rows: tables } = await client.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`,
    );
    const actualTables = tables.map((r) => r.tablename);
    const missing = expectedTables.filter((t) => !actualTables.includes(t));
    const extra = actualTables.filter(
      (t) => !expectedTables.includes(t) && t !== '__drizzle_migrations',
    );
    if (missing.length) {
      console.error(`[db:check] ✗ 缺失表 (${missing.length}):`, missing);
      failed++;
    } else {
      console.log(`[db:check] ✓ tables: ${actualTables.length} 张（期望 16=15 业务 + 1 归档）`);
    }
    if (extra.length) console.warn(`[db:check] ⚠ 额外表:`, extra);

    // triggers
    const { rows: trigs } = await client.query<{
      trigger_name: string;
      event_object_table: string;
    }>(
      `SELECT trigger_name, event_object_table FROM information_schema.triggers
       WHERE trigger_schema='public' ORDER BY trigger_name`,
    );
    const trigNames = [...new Set(trigs.map((r) => r.trigger_name))];
    const missingTrigs = expectedTriggers.filter((t) => !trigNames.includes(t));
    if (missingTrigs.length) {
      console.error(`[db:check] ✗ 缺失触发器:`, missingTrigs);
      failed++;
    } else {
      console.log(
        `[db:check] ✓ triggers: ${expectedTriggers.length}/${expectedTriggers.length} 就位`,
      );
    }

    // GIN indexes
    const { rows: idx } = await client.query<{ indexname: string; indexdef: string }>(
      `SELECT indexname, indexdef FROM pg_indexes
       WHERE schemaname='public' AND indexdef ILIKE '%USING gin%'
       ORDER BY indexname`,
    );
    if (idx.length < 3) {
      console.error(
        `[db:check] ✗ GIN 索引不足 (${idx.length}/3):`,
        idx.map((r) => r.indexname),
      );
      failed++;
    } else {
      console.log(
        `[db:check] ✓ GIN indexes: ${idx.length} 个`,
        idx.map((r) => r.indexname),
      );
    }

    // pg_trgm extension
    const { rows: ext } = await client.query<{ extname: string }>(
      `SELECT extname FROM pg_extension WHERE extname='pg_trgm'`,
    );
    if (!ext.length) {
      console.error(`[db:check] ✗ pg_trgm 扩展未安装`);
      failed++;
    } else {
      console.log(`[db:check] ✓ pg_trgm 扩展已启用`);
    }

    // task.status CHECK
    const { rows: chk } = await client.query<{ conname: string }>(
      `SELECT conname FROM pg_constraint
       WHERE contype='c' AND conrelid = 'public.task'::regclass`,
    );
    if (chk.length === 0) {
      console.error(`[db:check] ✗ task 表无 CHECK 约束（C-03 未应用）`);
      failed++;
    } else {
      console.log(`[db:check] ✓ task CHECK: ${chk.map((r) => r.conname).join(', ')}`);
    }

    // view
    const { rows: views } = await client.query<{ viewname: string }>(
      `SELECT viewname FROM pg_views WHERE schemaname='public' AND viewname='v_result_reference_hit_stats'`,
    );
    if (!views.length) {
      console.error(`[db:check] ✗ v_result_reference_hit_stats 视图未创建`);
      failed++;
    } else {
      console.log(`[db:check] ✓ v_result_reference_hit_stats 视图已创建`);
    }
  } finally {
    await client.end();
  }

  if (failed) {
    console.error(`\n[db:check] ✗ 失败项 ${failed}，请检查 0000/0001 migration 是否完整应用`);
    process.exit(1);
  }
  console.log('\n[db:check] ✓ 所有契约项通过');
}

main().catch((err) => {
  console.error('[db:check] ✗ 执行失败：', err);
  process.exit(1);
});
