/**
 * CRUD 教学示例 - Delete（删除）
 *
 * 本文件演示 Drizzle ORM 的删除操作
 * 核心实体：conversations（对话）+ messages（消息）
 *
 * 运行方式：
 *   bun run src/examples/crud/04-delete.ts        # 执行所有步骤
 *   bun run src/examples/crud/04-delete.ts 4.1   # 只执行 4.1 删除单条记录
 *   bun run src/examples/crud/04-delete.ts help  # 查看可用步骤
 */

import { db, conversations, messages, apiKeys } from '@/db';
import { eq, and, lt, isNull, isNotNull } from 'drizzle-orm';

// 模拟用户 ID
const MOCK_USER_ID = 'user_demo_001';

// ============================================================================
// 4.1 删除单条记录
// ============================================================================

/**
 * 知识点：
 * - db.delete(table).where(condition)
 * - returning() 返回被删除的记录
 * - 删除不存在的记录不会报错，returning() 返回空数组
 */
export async function deleteMessage(messageId: string) {
  console.log('\n=== 4.1 删除单条记录 ===');

  const [deleted] = await db
    .delete(messages)
    .where(eq(messages.id, messageId))
    .returning();

  if (deleted) {
    console.log('删除成功：', deleted.id);
  } else {
    console.log('记录不存在');
  }

  return deleted;
}

// ============================================================================
// 4.2 级联删除（删除对话自动删除消息）
// ============================================================================

/**
 * 知识点：
 * - 外键约束 + onDelete: 'cascade'
 * - 删除对话时，所有关联消息自动删除
 * - 由数据库层面保证，无需手动删除消息
 *
 * 参考 schema.ts 中的定义：
 * conversationId: uuid('conversation_id')
 *   .references(() => conversations.id, { onDelete: 'cascade' })
 */
export async function deleteConversationWithCascade(conversationId: string) {
  console.log('\n=== 4.2 级联删除 ===');

  // 先统计消息数量
  const messagesBefore = await db.query.messages.findMany({
    where: eq(messages.conversationId, conversationId),
  });
  console.log(`删除前：对话有 ${messagesBefore.length} 条消息`);

  // 删除对话
  const [deleted] = await db
    .delete(conversations)
    .where(eq(conversations.id, conversationId))
    .returning();

  if (deleted) {
    console.log(`对话 "${deleted.title}" 已删除`);
    console.log('关联消息已自动级联删除');
  }

  return deleted;
}

// ============================================================================
// 4.3 条件批量删除
// ============================================================================

/**
 * 知识点：
 * - where 匹配的所有记录都会被删除
 * - 使用 and() 组合多个条件
 * - 适用场景：清理归档对话、过期数据
 */
export async function deleteArchivedConversations(userId: string) {
  console.log('\n=== 4.3 条件批量删除 ===');

  const deleted = await db
    .delete(conversations)
    .where(
      and(
        eq(conversations.userId, userId),
        eq(conversations.isArchived, true)
      )
    )
    .returning();

  console.log(`已删除 ${deleted.length} 个归档对话`);
  return deleted;
}

// ============================================================================
// 4.4 删除过期数据
// ============================================================================

/**
 * 知识点：
 * - lt() 小于比较
 * - 清理 30 天前的归档对话
 */
export async function deleteOldArchivedConversations(daysOld: number = 30) {
  console.log('\n=== 4.4 删除过期数据 ===');

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const deleted = await db
    .delete(conversations)
    .where(
      and(
        eq(conversations.isArchived, true),
        lt(conversations.updatedAt, cutoffDate)
      )
    )
    .returning();

  console.log(`已删除 ${deleted.length} 个 ${daysOld} 天前的归档对话`);
  return deleted;
}

// ============================================================================
// 4.5 软删除（标记删除）
// ============================================================================

/**
 * 知识点：
 * - 软删除不真正删除数据，只设置 deletedAt 时间戳
 * - 保留数据用于审计追溯
 * - apiKeys 表有 deletedAt 字段，适合演示
 */
export async function softDeleteApiKey(keyId: string) {
  console.log('\n=== 4.5 软删除 ===');

  const [deleted] = await db
    .update(apiKeys)
    .set({ deletedAt: new Date() })
    .where(eq(apiKeys.id, keyId))
    .returning();

  if (deleted) {
    console.log(`API Key ${deleted.maskedKey} 已软删除`);
    console.log(`deletedAt: ${deleted.deletedAt}`);
  }

  return deleted;
}

/**
 * 恢复软删除的记录
 */
export async function restoreSoftDeletedApiKey(keyId: string) {
  console.log('\n=== 恢复软删除 ===');

  const [restored] = await db
    .update(apiKeys)
    .set({ deletedAt: null })
    .where(eq(apiKeys.id, keyId))
    .returning();

  if (restored) {
    console.log(`API Key ${restored.maskedKey} 已恢复`);
  }

  return restored;
}

// ============================================================================
// 4.6 查询时排除软删除记录
// ============================================================================

/**
 * 知识点：
 * - isNull() 检查字段是否为 null
 * - 软删除场景下，查询时需要排除 deletedAt 不为 null 的记录
 */
export async function listActiveApiKeys(userId: string) {
  console.log('\n=== 4.6 查询活跃记录（排除软删除）===');

  const activeKeys = await db.query.apiKeys.findMany({
    where: and(
      eq(apiKeys.userId, userId),
      isNull(apiKeys.deletedAt) // 只查询未删除的
    ),
  });

  console.log(`用户有 ${activeKeys.length} 个活跃 API Key`);
  return activeKeys;
}

/**
 * 查询已软删除的记录
 */
export async function listDeletedApiKeys(userId: string) {
  console.log('\n=== 查询已删除记录 ===');

  const deletedKeys = await db.query.apiKeys.findMany({
    where: and(
      eq(apiKeys.userId, userId),
      isNotNull(apiKeys.deletedAt) // 只查询已删除的
    ),
  });

  console.log(`用户有 ${deletedKeys.length} 个已删除 API Key`);
  return deletedKeys;
}

// ============================================================================
// 4.7 事务中删除（语法演示）
// ============================================================================

/**
 * 知识点：
 * - 事务保证多个删除操作的原子性
 * - 适用场景：删除对话前记录日志
 *
 * 注意：neon-http 驱动不支持事务，需要使用 WebSocket 驱动（Pool）
 * 此示例仅演示语法，不实际执行
 */
export async function deleteWithTransaction(_conversationId: string) {
  console.log('\n=== 4.7 事务中删除（语法演示）===');
  console.log('提示：neon-http 驱动不支持事务，需使用 WebSocket 驱动（Pool）');

  const exampleCode = `
  // 事务示例（需要 WebSocket 驱动）
  const result = await db.transaction(async (tx) => {
    // 先获取对话信息（用于日志）
    const conversation = await tx.query.conversations.findFirst({
      where: eq(conversations.id, conversationId),
    });

    if (!conversation) {
      throw new Error('对话不存在');
    }

    // 记录删除日志
    console.log(\`事务中：记录删除日志 - \${conversation.title}\`);

    // 删除对话
    const [deleted] = await tx
      .delete(conversations)
      .where(eq(conversations.id, conversationId))
      .returning();

    return { deleted, loggedTitle: conversation.title };
  });
  `;

  console.log('示例代码：', exampleCode);
}

// ============================================================================
// 4.8 安全删除（先检查再删除）
// ============================================================================

/**
 * 知识点：
 * - 删除前检查记录是否存在
 * - 检查是否有权限删除（验证 userId）
 */
export async function safeDeleteConversation(
  conversationId: string,
  userId: string
) {
  console.log('\n=== 4.8 安全删除 ===');

  // 先检查对话是否存在且属于该用户
  const conversation = await db.query.conversations.findFirst({
    where: and(
      eq(conversations.id, conversationId),
      eq(conversations.userId, userId)
    ),
  });

  if (!conversation) {
    console.log('对话不存在或无权删除');
    return null;
  }

  // 执行删除
  const [deleted] = await db
    .delete(conversations)
    .where(eq(conversations.id, conversationId))
    .returning();

  console.log(`安全删除成功：${deleted.title}`);
  return deleted;
}

// ============================================================================
// 4.9 清空表（危险操作）
// ============================================================================

/**
 * 知识点：
 * - 不带 where 条件会删除所有记录
 * - 生产环境绝对禁止！仅用于测试环境
 *
 * ⚠️ 警告：此操作会删除表中所有数据！
 */
export async function clearAllMessages_DANGER(conversationId: string) {
  console.log('\n=== 4.9 清空对话消息（危险）===');
  console.log('⚠️ 警告：此操作会删除对话的所有消息！');

  const deleted = await db
    .delete(messages)
    .where(eq(messages.conversationId, conversationId))
    .returning();

  console.log(`已清空 ${deleted.length} 条消息`);
  return deleted;
}

// ============================================================================
// 4.10 硬删除 vs 软删除对比
// ============================================================================

/**
 * 知识点总结：
 *
 * 硬删除（Hard Delete）：
 * - 数据真正从数据库中删除
 * - 不可恢复
 * - 适用：临时数据、缓存、无需审计的数据
 *
 * 软删除（Soft Delete）：
 * - 只设置 deletedAt 时间戳
 * - 数据仍保留在数据库中
 * - 可恢复
 * - 适用：重要业务数据、需要审计追溯的数据
 *
 * 级联删除（Cascade Delete）：
 * - 删除主表记录时自动删除关联记录
 * - 由数据库外键约束保证
 * - 适用：强关联数据（如对话-消息）
 */
export function deletePatternSummary() {
  console.log('\n=== 4.10 删除模式总结 ===');

  const summary = `
  | 模式 | 实现方式 | 可恢复 | 适用场景 |
  |------|----------|--------|----------|
  | 硬删除 | DELETE FROM table | ❌ | 临时数据 |
  | 软删除 | SET deletedAt = now() | ✅ | 重要数据 |
  | 级联删除 | 外键 ON DELETE CASCADE | ❌ | 关联数据 |
  `;

  console.log(summary);
}

// ============================================================================
// 步骤定义
// ============================================================================

interface TestData { convId: string; messageId: string; keyId: string }

const STEPS: Record<string, { name: string; fn: (data: TestData) => Promise<unknown> }> = {
  '4.1': { name: '删除单条记录', fn: (d) => deleteMessage(d.messageId) },
  '4.3': { name: '条件批量删除', fn: () => deleteArchivedConversations(MOCK_USER_ID) },
  '4.5': { name: '软删除', fn: async (d) => {
    await softDeleteApiKey(d.keyId);
    await listActiveApiKeys(MOCK_USER_ID);
    await listDeletedApiKeys(MOCK_USER_ID);
    await restoreSoftDeletedApiKey(d.keyId);
  }},
  '4.6': { name: '查询活跃记录', fn: () => listActiveApiKeys(MOCK_USER_ID) },
  '4.8': { name: '安全删除', fn: async (d) => {
    await safeDeleteConversation(d.convId, MOCK_USER_ID);
    await safeDeleteConversation(d.convId, 'wrong_user');
  }},
  '4.10': { name: '删除模式总结', fn: async () => deletePatternSummary() },
};

function showHelp() {
  console.log('可用步骤：');
  Object.entries(STEPS).forEach(([key, { name }]) => {
    console.log(`  ${key}  ${name}`);
  });
  console.log('\n用法：bun run src/examples/crud/04-delete.ts [步骤]');
}

async function prepareTestData(): Promise<TestData> {
  console.log('\n>>> 准备测试数据...');

  const [testConv] = await db
    .insert(conversations)
    .values({ userId: MOCK_USER_ID, title: '待删除的测试对话', modelId: 'claude-3-opus' })
    .returning();

  const testMessages = await db
    .insert(messages)
    .values([
      { conversationId: testConv.id, role: 'user', content: [{ type: 'text', text: '消息 1' }] },
      { conversationId: testConv.id, role: 'assistant', content: [{ type: 'text', text: '消息 2' }] },
    ])
    .returning();

  await db.insert(conversations).values({ userId: MOCK_USER_ID, title: '已归档的对话', isArchived: true });

  const [testKey] = await db
    .insert(apiKeys)
    .values({ userId: MOCK_USER_ID, provider: 'anthropic', encryptedKey: 'encrypted_xxx', maskedKey: 'sk-...abc' })
    .returning();

  console.log('测试数据创建完成');
  return { convId: testConv.id, messageId: testMessages[0].id, keyId: testKey.id };
}

// ============================================================================
// 主函数：运行所有示例
// ============================================================================

async function main() {
  const arg = process.argv[2];

  // 显示帮助
  if (arg === 'help' || arg === '--help' || arg === '-h') {
    showHelp();
    return;
  }

  console.log('========================================');
  console.log('CRUD 教学示例 - Delete（删除）');
  console.log('========================================');

  try {
    // 执行特定步骤
    if (arg && STEPS[arg]) {
      const step = STEPS[arg];
      console.log(`\n>>> 执行步骤 ${arg}: ${step.name}`);
      const data = await prepareTestData();
      await step.fn(data);
      return;
    }

    // 如果参数无效
    if (arg) {
      console.log(`未知步骤：${arg}`);
      showHelp();
      process.exit(1);
    }

    // 执行所有步骤
    const { convId, messageId, keyId } = await prepareTestData();

    await deleteMessage(messageId);
    await softDeleteApiKey(keyId);
    await listActiveApiKeys(MOCK_USER_ID);
    await listDeletedApiKeys(MOCK_USER_ID);
    await restoreSoftDeletedApiKey(keyId);
    await deleteArchivedConversations(MOCK_USER_ID);
    await safeDeleteConversation(convId, MOCK_USER_ID);
    await safeDeleteConversation(convId, 'wrong_user');
    deletePatternSummary();

    console.log('\n========================================');
    console.log('所有 Delete 示例执行完成！');
    console.log('========================================');
  } catch (error) {
    console.error('执行出错：', error);
    process.exit(1);
  }
}

// 直接运行时执行 main
main();
