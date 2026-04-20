import { Client } from 'pg';

/**
 * 清理 smoke 测试残留用户（email 以 smoke 开头）
 *
 * 使用：bun run db:cleanup-smoke
 *
 * 场景：auth / ai 冒烟测试后残留的 user + 级联 session/account 数据
 * 约束：只删 email like 'smoke%' 的用户；绝不清真实数据
 */
const DATABASE_URL = process.env['DATABASE_URL'];
if (!DATABASE_URL) {
  console.error('[db:cleanup-smoke] ✗ DATABASE_URL 未设置');
  process.exit(1);
}

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    const result = await client.query(
      `DELETE FROM "user" WHERE email LIKE 'smoke%@example.com' RETURNING email`,
    );
    const deleted = (result.rows as { email: string }[]).map((r) => r.email);
    if (deleted.length) {
      console.log(`[db:cleanup-smoke] ✓ 删除 ${deleted.length} 个冒烟用户: ${deleted.join(', ')}`);
    } else {
      console.log('[db:cleanup-smoke] ✓ 无冒烟用户可清理');
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('[db:cleanup-smoke] ✗ 失败：', err);
  process.exit(1);
});
