/**
 * CRUD 教学示例 - Update（更新）
 *
 * 本文件演示 Drizzle ORM 的更新操作
 * 核心实体：conversations（对话）+ messages（消息）
 *
 * 运行方式：
 *   bun run src/examples/crud/03-update.ts        # 执行所有步骤
 *   bun run src/examples/crud/03-update.ts 3.1   # 只执行 3.1 更新单个字段
 *   bun run src/examples/crud/03-update.ts help  # 查看可用步骤
 */

import { db, conversations, messages, groups } from '@/db';
import { eq, and, sql } from 'drizzle-orm';

// 模拟用户 ID
const MOCK_USER_ID = 'user_demo_001';

// ============================================================================
// 3.1 更新单个字段
// ============================================================================

/**
 * 知识点：
 * - db.update(table).set({ field: value })
 * - where 条件限定更新范围
 * - returning() 返回更新后的记录
 */
export async function updateConversationTitle(
  conversationId: string,
  newTitle: string
) {
  console.log('\n=== 3.1 更新单个字段 ===');

  const [updated] = await db
    .update(conversations)
    .set({ title: newTitle })
    .where(eq(conversations.id, conversationId))
    .returning();

  console.log('更新后的对话：', updated);
  return updated;
}

// ============================================================================
// 3.2 更新多个字段
// ============================================================================

/**
 * 知识点：
 * - set() 可同时更新多个字段
 * - updatedAt 会自动更新（schema 中配置了 $onUpdate）
 */
export async function updateConversationSettings(
  conversationId: string,
  settings: {
    modelId?: string;
    searchEnabled?: boolean;
  }
) {
  console.log('\n=== 3.2 更新多个字段 ===');

  const [updated] = await db
    .update(conversations)
    .set({
      modelId: settings.modelId,
      searchEnabled: settings.searchEnabled,
      // updatedAt 会自动更新
    })
    .where(eq(conversations.id, conversationId))
    .returning();

  console.log('更新后：', {
    modelId: updated.modelId,
    searchEnabled: updated.searchEnabled,
    updatedAt: updated.updatedAt,
  });

  return updated;
}

// ============================================================================
// 3.3 归档对话（软删除模式）
// ============================================================================

/**
 * 知识点：
 * - 软删除：不真正删除数据，只标记状态
 * - isArchived 字段实现归档功能
 * - 保留历史数据，可恢复
 */
export async function archiveConversation(conversationId: string) {
  console.log('\n=== 3.3 归档对话（软删除）===');

  const [archived] = await db
    .update(conversations)
    .set({ isArchived: true })
    .where(eq(conversations.id, conversationId))
    .returning();

  console.log(`对话 ${archived.title} 已归档`);
  return archived;
}

/**
 * 恢复已归档的对话
 */
export async function restoreConversation(conversationId: string) {
  console.log('\n=== 恢复归档对话 ===');

  const [restored] = await db
    .update(conversations)
    .set({ isArchived: false })
    .where(eq(conversations.id, conversationId))
    .returning();

  console.log(`对话 ${restored.title} 已恢复`);
  return restored;
}

// ============================================================================
// 3.4 批量更新
// ============================================================================

/**
 * 知识点：
 * - 没有 limit，where 匹配的所有记录都会更新
 * - 适用场景：用户设置变更、批量状态更新
 */
export async function enableSearchForAllConversations(userId: string) {
  console.log('\n=== 3.4 批量更新 ===');

  const result = await db
    .update(conversations)
    .set({ searchEnabled: true })
    .where(eq(conversations.userId, userId))
    .returning();

  console.log(`已为用户 ${userId} 的 ${result.length} 个对话启用搜索`);
  return result;
}

// ============================================================================
// 3.5 条件更新
// ============================================================================

/**
 * 知识点：
 * - and() 组合多个条件
 * - 只更新满足所有条件的记录
 */
export async function updateUnarchived(userId: string, newModelId: string) {
  console.log('\n=== 3.5 条件更新 ===');

  const result = await db
    .update(conversations)
    .set({ modelId: newModelId })
    .where(
      and(
        eq(conversations.userId, userId),
        eq(conversations.isArchived, false) // 只更新未归档的
      )
    )
    .returning();

  console.log(`更新了 ${result.length} 个活跃对话的模型`);
  return result;
}

// ============================================================================
// 3.6 更新消息的 Token 计数
// ============================================================================

/**
 * 知识点：
 * - 更新 jsonb 字段需要传完整对象
 * - 更新数值字段
 */
export async function updateMessageTokenCount(
  messageId: string,
  tokenCount: number
) {
  console.log('\n=== 3.6 更新消息 Token 计数 ===');

  const [updated] = await db
    .update(messages)
    .set({ tokenCount })
    .where(eq(messages.id, messageId))
    .returning();

  console.log(`消息 ${messageId} 的 token 计数更新为 ${updated.tokenCount}`);
  return updated;
}

// ============================================================================
// 3.7 使用 SQL 表达式更新
// ============================================================================

/**
 * 知识点：
 * - sql`...` 可以写原始 SQL 表达式
 * - 适用于自增、计算等场景
 *
 * 注意：messages 表没有 tokenCount 自增场景，
 * 此处用 groups.version 演示乐观锁
 */
export async function incrementVersion(groupId: string) {
  console.log('\n=== 3.7 SQL 表达式更新（版本自增）===');

  const [updated] = await db
    .update(groups)
    .set({
      version: sql`${groups.version} + 1`,
    })
    .where(eq(groups.id, groupId))
    .returning();

  console.log(`分组版本号更新为 ${updated.version}`);
  return updated;
}

// ============================================================================
// 3.8 乐观锁更新
// ============================================================================

/**
 * 知识点：
 * - 乐观锁防止并发冲突
 * - 更新时检查 version 字段
 * - 如果 version 不匹配，说明被其他操作修改过
 */
export async function optimisticUpdate(
  groupId: string,
  newName: string,
  expectedVersion: number
) {
  console.log('\n=== 3.8 乐观锁更新 ===');

  const result = await db
    .update(groups)
    .set({
      name: newName,
      version: sql`${groups.version} + 1`,
    })
    .where(
      and(
        eq(groups.id, groupId),
        eq(groups.version, expectedVersion) // 检查版本号
      )
    )
    .returning();

  if (result.length === 0) {
    console.log('更新失败：版本号不匹配（可能被其他操作修改）');
    throw new Error('Optimistic lock conflict');
  }

  console.log('乐观锁更新成功：', result[0]);
  return result[0];
}

// ============================================================================
// 3.9 事务中更新（语法演示）
// ============================================================================

/**
 * 知识点：
 * - 事务保证多个更新的原子性
 * - 适用场景：更新对话标题并记录日志
 *
 * 注意：neon-http 驱动不支持事务，需要使用 WebSocket 驱动（Pool）
 * 此示例仅演示语法，不实际执行
 */
export async function updateWithTransaction(
  _conversationId: string,
  _newTitle: string
) {
  console.log('\n=== 3.9 事务中更新（语法演示）===');
  console.log('提示：neon-http 驱动不支持事务，需使用 WebSocket 驱动（Pool）');

  const exampleCode = `
  // 事务示例（需要 WebSocket 驱动）
  const result = await db.transaction(async (tx) => {
    // 更新对话标题
    const [updated] = await tx
      .update(conversations)
      .set({ title: newTitle })
      .where(eq(conversations.id, conversationId))
      .returning();

    // 这里可以添加日志记录等其他操作
    // await tx.insert(operationLogs).values({...});

    return updated;
  });
  `;

  console.log('示例代码：', exampleCode);
}

// ============================================================================
// 3.10 更新不存在的记录
// ============================================================================

/**
 * 知识点：
 * - 如果 where 条件匹配不到记录，returning() 返回空数组
 * - 可以通过检查返回值判断是否更新成功
 */
export async function safeUpdate(conversationId: string, newTitle: string) {
  console.log('\n=== 3.10 安全更新（检查是否存在）===');

  const result = await db
    .update(conversations)
    .set({ title: newTitle })
    .where(eq(conversations.id, conversationId))
    .returning();

  if (result.length === 0) {
    console.log(`对话 ${conversationId} 不存在，更新失败`);
    return null;
  }

  console.log('更新成功：', result[0]);
  return result[0];
}

// ============================================================================
// 步骤定义
// ============================================================================

interface TestData { convId: string; groupId: string }

const STEPS: Record<string, { name: string; fn: (data: TestData) => Promise<unknown> }> = {
  '3.1': { name: '更新单个字段', fn: (d) => updateConversationTitle(d.convId, '新标题') },
  '3.2': { name: '更新多个字段', fn: (d) => updateConversationSettings(d.convId, { modelId: 'claude-3-opus', searchEnabled: true }) },
  '3.3': { name: '归档对话（软删除）', fn: async (d) => { await archiveConversation(d.convId); await restoreConversation(d.convId); } },
  '3.4': { name: '批量更新', fn: () => enableSearchForAllConversations(MOCK_USER_ID) },
  '3.5': { name: '条件更新', fn: () => updateUnarchived(MOCK_USER_ID, 'claude-3-sonnet') },
  '3.7': { name: 'SQL 表达式更新', fn: (d) => incrementVersion(d.groupId) },
  '3.8': { name: '乐观锁更新', fn: async (d) => {
    await incrementVersion(d.groupId); // 先增加版本
    try { await optimisticUpdate(d.groupId, '新分组名', 2); } catch { console.log('捕获到乐观锁冲突（预期行为）'); }
  }},
  '3.9': { name: '事务中更新（语法演示）', fn: (d) => updateWithTransaction(d.convId, '事务更新的标题') },
  '3.10': { name: '安全更新', fn: async (d) => { await safeUpdate(d.convId, '最终标题'); await safeUpdate('00000000-0000-0000-0000-000000000000', '不存在'); } },
};

function showHelp() {
  console.log('可用步骤：');
  Object.entries(STEPS).forEach(([key, { name }]) => {
    console.log(`  ${key}  ${name}`);
  });
  console.log('\n用法：bun run src/examples/crud/03-update.ts [步骤]');
}

async function prepareTestData(): Promise<TestData> {
  console.log('\n>>> 准备测试数据...');
  const [testConv] = await db
    .insert(conversations)
    .values({ userId: MOCK_USER_ID, title: '原始标题', modelId: 'claude-3-haiku', searchEnabled: false })
    .returning();

  const [testGroup] = await db
    .insert(groups)
    .values({ name: '测试分组', creatorId: MOCK_USER_ID, version: 1 })
    .returning();

  console.log('测试数据创建完成');
  return { convId: testConv.id, groupId: testGroup.id };
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
  console.log('CRUD 教学示例 - Update（更新）');
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
    const { convId: testConvId, groupId: testGroupId } = await prepareTestData();

    await updateConversationTitle(testConvId, '新标题');
    await updateConversationSettings(testConvId, { modelId: 'claude-3-opus', searchEnabled: true });
    await archiveConversation(testConvId);
    await restoreConversation(testConvId);
    await enableSearchForAllConversations(MOCK_USER_ID);
    await updateUnarchived(MOCK_USER_ID, 'claude-3-sonnet');
    await incrementVersion(testGroupId);

    try {
      await optimisticUpdate(testGroupId, '新分组名', 2);
    } catch {
      console.log('捕获到乐观锁冲突（预期行为）');
    }

    await updateWithTransaction(testConvId, '事务更新的标题');
    await safeUpdate(testConvId, '最终标题');
    await safeUpdate('00000000-0000-0000-0000-000000000000', '不存在');

    console.log('\n========================================');
    console.log('所有 Update 示例执行完成！');
    console.log('========================================');
  } catch (error) {
    console.error('执行出错：', error);
    process.exit(1);
  }
}

// 直接运行时执行 main
main();
