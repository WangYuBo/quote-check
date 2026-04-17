/**
 * CRUD 教学示例 - Read（查询）
 *
 * 本文件演示 Drizzle ORM 的查询操作
 * 核心实体：conversations（对话）+ messages（消息）
 *
 * 运行方式：
 *   bun run src/examples/crud/02-read.ts        # 执行所有步骤
 *   bun run src/examples/crud/02-read.ts 2.1   # 只执行 2.1 查询单个对话
 *   bun run src/examples/crud/02-read.ts help  # 查看可用步骤
 */

import { db, conversations, messages } from '@/db';
import { eq, and, desc, asc, like, count, sql, isNull, gte, lte } from 'drizzle-orm';

// 模拟用户 ID
const MOCK_USER_ID = 'user_demo_001';

// ============================================================================
// 2.1 查询单个对话（findFirst）
// ============================================================================

/**
 * 知识点：
 * - db.query.xxx.findFirst() 查询单条记录
 * - where 条件使用 eq() 函数
 * - 找不到返回 undefined
 */
export async function findConversationById(conversationId: string) {
  console.log('\n=== 2.1 查询单个对话 ===');

  const conversation = await db.query.conversations.findFirst({
    where: eq(conversations.id, conversationId),
  });

  if (conversation) {
    console.log('找到对话：', conversation);
  } else {
    console.log('对话不存在');
  }

  return conversation;
}

// ============================================================================
// 2.2 查询用户的对话列表（findMany）
// ============================================================================

/**
 * 知识点：
 * - db.query.xxx.findMany() 查询多条记录
 * - and() 组合多个条件
 * - orderBy 排序（desc 降序，asc 升序）
 * - limit + offset 实现分页
 */
export async function listUserConversations(
  userId: string,
  page: number = 1,
  pageSize: number = 10
) {
  console.log('\n=== 2.2 查询用户的对话列表 ===');

  const offset = (page - 1) * pageSize;

  const userConversations = await db.query.conversations.findMany({
    where: and(
      eq(conversations.userId, userId),
      eq(conversations.isArchived, false) // 排除已归档
    ),
    orderBy: desc(conversations.updatedAt), // 最近更新的在前
    limit: pageSize,
    offset: offset,
  });

  console.log(`第 ${page} 页，共 ${userConversations.length} 条：`);
  userConversations.forEach((conv, i) => {
    console.log(`  ${i + 1}. ${conv.title} (${conv.id})`);
  });

  return userConversations;
}

// ============================================================================
// 2.3 关联查询：对话 + 消息
// ============================================================================

/**
 * 知识点：
 * - with 关联加载（需要在 schema 中定义 relations）
 * - 一次查询获取对话及其所有消息
 * - 可以对关联数据排序、过滤
 */
export async function findConversationWithMessages(conversationId: string) {
  console.log('\n=== 2.3 关联查询：对话 + 消息 ===');

  const result = await db.query.conversations.findFirst({
    where: eq(conversations.id, conversationId),
    with: {
      messages: {
        orderBy: asc(messages.createdAt), // 消息按时间升序
      },
    },
  });

  if (result) {
    console.log('对话标题：', result.title);
    console.log('消息数量：', result.messages.length);
    result.messages.forEach((msg, i) => {
      const preview = JSON.stringify(msg.content).slice(0, 50);
      console.log(`  ${i + 1}. [${msg.role}] ${preview}...`);
    });
  }

  return result;
}

// ============================================================================
// 2.4 查询对话的消息（带分页）
// ============================================================================

/**
 * 知识点：
 * - 单独查询 messages 表
 * - 分页加载消息（聊天记录可能很长）
 */
export async function listConversationMessages(
  conversationId: string,
  page: number = 1,
  pageSize: number = 20
) {
  console.log('\n=== 2.4 查询对话的消息 ===');

  const offset = (page - 1) * pageSize;

  const messageList = await db.query.messages.findMany({
    where: eq(messages.conversationId, conversationId),
    orderBy: desc(messages.createdAt), // 最新消息在前
    limit: pageSize,
    offset: offset,
  });

  console.log(`消息列表（第 ${page} 页）：`);
  messageList.forEach((msg) => {
    console.log(`  [${msg.role}] ${msg.createdAt}`);
  });

  return messageList;
}

// ============================================================================
// 2.5 条件查询：模糊搜索
// ============================================================================

/**
 * 知识点：
 * - like() 模糊匹配（% 通配符）
 * - 搜索对话标题
 */
export async function searchConversations(userId: string, keyword: string) {
  console.log('\n=== 2.5 模糊搜索 ===');

  const results = await db.query.conversations.findMany({
    where: and(
      eq(conversations.userId, userId),
      like(conversations.title, `%${keyword}%`) // 标题包含关键词
    ),
    orderBy: desc(conversations.updatedAt),
    limit: 10,
  });

  console.log(`搜索 "${keyword}"，找到 ${results.length} 条：`);
  results.forEach((conv) => {
    console.log(`  - ${conv.title}`);
  });

  return results;
}

// ============================================================================
// 2.6 聚合查询：统计消息数量
// ============================================================================

/**
 * 知识点：
 * - count() 统计记录数
 * - db.select() 用于复杂查询
 * - 与 findFirst/findMany 不同，select 返回原始结果
 */
export async function countMessages(conversationId: string) {
  console.log('\n=== 2.6 统计消息数量 ===');

  const [result] = await db
    .select({ total: count() })
    .from(messages)
    .where(eq(messages.conversationId, conversationId));

  console.log(`对话共有 ${result.total} 条消息`);
  return result.total;
}

// ============================================================================
// 2.7 聚合查询：统计 Token 消耗
// ============================================================================

/**
 * 知识点：
 * - sql`SUM(...)` 自定义 SQL 表达式
 * - 统计对话的总 Token 消耗
 */
export async function sumTokens(conversationId: string) {
  console.log('\n=== 2.7 统计 Token 消耗 ===');

  const [result] = await db
    .select({
      totalTokens: sql<number>`COALESCE(SUM(${messages.tokenCount}), 0)`,
    })
    .from(messages)
    .where(eq(messages.conversationId, conversationId));

  console.log(`对话共消耗 ${result.totalTokens} tokens`);
  return result.totalTokens;
}

// ============================================================================
// 2.8 时间范围查询
// ============================================================================

/**
 * 知识点：
 * - gte() 大于等于
 * - lte() 小于等于
 * - 查询指定时间范围内的对话
 */
export async function findConversationsByDateRange(
  userId: string,
  startDate: Date,
  endDate: Date
) {
  console.log('\n=== 2.8 时间范围查询 ===');

  const results = await db.query.conversations.findMany({
    where: and(
      eq(conversations.userId, userId),
      gte(conversations.createdAt, startDate),
      lte(conversations.createdAt, endDate)
    ),
    orderBy: desc(conversations.createdAt),
  });

  console.log(
    `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()} 期间创建了 ${results.length} 个对话`
  );

  return results;
}

// ============================================================================
// 2.9 使用 select 构建自定义查询
// ============================================================================

/**
 * 知识点：
 * - db.select() 可选择返回的字段
 * - 减少数据传输量，提高性能
 */
export async function selectSpecificFields(userId: string) {
  console.log('\n=== 2.9 选择特定字段 ===');

  const results = await db
    .select({
      id: conversations.id,
      title: conversations.title,
      createdAt: conversations.createdAt,
    })
    .from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.createdAt))
    .limit(5);

  console.log('只返回 id, title, createdAt：');
  results.forEach((conv) => {
    console.log(`  ${conv.title} (${conv.createdAt})`);
  });

  return results;
}

// ============================================================================
// 2.10 检查记录是否存在
// ============================================================================

/**
 * 知识点：
 * - 只需要判断是否存在，不需要完整数据
 * - 使用 limit(1) 优化性能
 */
export async function conversationExists(conversationId: string): Promise<boolean> {
  console.log('\n=== 2.10 检查记录是否存在 ===');

  const result = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);

  const exists = result.length > 0;
  console.log(`对话 ${conversationId} ${exists ? '存在' : '不存在'}`);

  return exists;
}

// ============================================================================
// 步骤定义
// ============================================================================

type StepFn = (convId: string) => Promise<unknown>;

const STEPS: Record<string, { name: string; fn: StepFn; needsConv: boolean }> = {
  '2.1': { name: '查询单个对话', fn: findConversationById, needsConv: true },
  '2.2': { name: '查询用户的对话列表', fn: () => listUserConversations(MOCK_USER_ID, 1, 10), needsConv: false },
  '2.3': { name: '关联查询：对话 + 消息', fn: findConversationWithMessages, needsConv: true },
  '2.4': { name: '查询对话的消息', fn: (id) => listConversationMessages(id, 1, 20), needsConv: true },
  '2.5': { name: '模糊搜索', fn: () => searchConversations(MOCK_USER_ID, '测试'), needsConv: false },
  '2.6': { name: '统计消息数量', fn: countMessages, needsConv: true },
  '2.7': { name: '统计 Token 消耗', fn: sumTokens, needsConv: true },
  '2.8': { name: '时间范围查询', fn: () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return findConversationsByDateRange(MOCK_USER_ID, yesterday, now);
  }, needsConv: false },
  '2.9': { name: '选择特定字段', fn: () => selectSpecificFields(MOCK_USER_ID), needsConv: false },
  '2.10': { name: '检查记录是否存在', fn: conversationExists, needsConv: true },
};

function showHelp() {
  console.log('可用步骤：');
  Object.entries(STEPS).forEach(([key, { name }]) => {
    console.log(`  ${key}  ${name}`);
  });
  console.log('\n用法：bun run src/examples/crud/02-read.ts [步骤]');
}

async function prepareTestData() {
  console.log('\n>>> 准备测试数据...');
  const [testConv] = await db
    .insert(conversations)
    .values({
      userId: MOCK_USER_ID,
      title: '测试对话 - Read 示例',
      modelId: 'claude-3-opus',
    })
    .returning();

  await db.insert(messages).values([
    { conversationId: testConv.id, role: 'user', content: [{ type: 'text', text: '这是测试消息 1' }] },
    { conversationId: testConv.id, role: 'assistant', content: [{ type: 'text', text: '这是回复消息 1' }], tokenCount: 50 },
    { conversationId: testConv.id, role: 'user', content: [{ type: 'text', text: '这是测试消息 2' }] },
  ]);
  console.log('测试数据创建完成');
  return testConv;
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
  console.log('CRUD 教学示例 - Read（查询）');
  console.log('========================================');

  try {
    // 执行特定步骤
    if (arg && STEPS[arg]) {
      const step = STEPS[arg];
      console.log(`\n>>> 执行步骤 ${arg}: ${step.name}`);

      if (step.needsConv) {
        const testConv = await prepareTestData();
        await step.fn(testConv.id);
      } else {
        await step.fn('');
      }
      return;
    }

    // 如果参数无效
    if (arg) {
      console.log(`未知步骤：${arg}`);
      showHelp();
      process.exit(1);
    }

    // 执行所有步骤
    const testConv = await prepareTestData();

    await findConversationById(testConv.id);
    await listUserConversations(MOCK_USER_ID, 1, 10);
    await findConversationWithMessages(testConv.id);
    await listConversationMessages(testConv.id, 1, 20);
    await searchConversations(MOCK_USER_ID, '测试');
    await countMessages(testConv.id);
    await sumTokens(testConv.id);

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    await findConversationsByDateRange(MOCK_USER_ID, yesterday, now);

    await selectSpecificFields(MOCK_USER_ID);
    await conversationExists(testConv.id);
    await conversationExists('00000000-0000-0000-0000-000000000000');

    console.log('\n========================================');
    console.log('所有 Read 示例执行完成！');
    console.log('========================================');
  } catch (error) {
    console.error('执行出错：', error);
    process.exit(1);
  }
}

// 直接运行时执行 main
main();
