/**
 * CRUD 教学示例 - Create（创建）
 *
 * 本文件演示 Drizzle ORM 的插入操作
 * 核心实体：conversations（对话）+ messages（消息）
 *
 * 运行方式：
 *   bun run src/examples/crud/01-create.ts        # 执行所有步骤
 *   bun run src/examples/crud/01-create.ts 1.1   # 只执行 1.1 创建对话
 *   bun run src/examples/crud/01-create.ts help  # 查看可用步骤
 */

import { db, conversations, messages } from '@/db';

// 模拟用户 ID（实际项目中来自 Neon Auth）
const MOCK_USER_ID = 'user_demo_001';

// ============================================================================
// 1.1 创建对话（基础插入）
// ============================================================================

/**
 * 知识点：
 * - insert().values() 插入单条数据
 * - returning() 返回插入后的完整记录（包含自动生成的 id、时间戳）
 */
export async function createConversation() {
  console.log('\n=== 1.1 创建对话（基础插入）===');

  const [newConversation] = await db
    .insert(conversations)
    .values({
      userId: MOCK_USER_ID,
      title: '我的第一个对话1220',
      modelId: 'claude-3-opus',
      searchEnabled: false,
    })
    .returning();

  console.log('创建成功：', newConversation);
  return newConversation;
}

// ==========================================2==================================
// 1.2 创建消息（关联插入）
// ============================================================================

/**
 * 知识点：
 * - 外键关联：conversationId 必须是已存在的对话 ID
 * - jsonb 字段：content 是 JSON 数组，存储多模态内容
 * - 枚举字段：role 只能是 'user' | 'assistant' | 'system'
 */
export async function createMessage(conversationId: string) {
  console.log('\n=== 1.2 创建消息（关联插入）===');

  const [userMessage] = await db
    .insert(messages)
    .values({
      conversationId,
      role: 'user',
      content: [{ type: 'text', text: '你好，请介绍一下你自己' }],
    })
    .returning();

  console.log('用户消息创建成功：', userMessage);

  // 创建 AI 回复消息
  const [assistantMessage] = await db
    .insert(messages)
    .values({
      conversationId,
      role: 'assistant',
      content: [{ type: 'text', text: '你好！我是 AI 助手，很高兴为你服务。' }],
      tokenCount: 42, // 记录 token 消耗
    })
    .returning();

  console.log('助手消息创建成功：', assistantMessage);

  return { userMessage, assistantMessage };
}

// ============================================================================
// 1.3 批量创建消息
// ============================================================================

/**
 * 知识点：
 * - values() 接受数组，一次插入多条记录
 * - 批量插入比循环单条插入性能更好
 */
export async function createMultipleMessages(conversationId: string) {
  console.log('\n=== 1.3 批量创建消息 ===');

  const messagesToInsert = [
    {
      conversationId,
      role: 'user' as const,
      content: [{ type: 'text' as const, text: '什么是 TypeScript？' }],
    },
    {
      conversationId,
      role: 'assistant' as const,
      content: [{ type: 'text' as const, text: 'TypeScript 是 JavaScript 的超集...' }],
      tokenCount: 100,
    },
    {
      conversationId,
      role: 'user' as const,
      content: [{ type: 'text' as const, text: '谢谢解释！' }],
    },
  ];

  const insertedMessages = await db
    .insert(messages)
    .values(messagesToInsert)
    .returning();

  console.log(`批量创建成功，共 ${insertedMessages.length} 条消息`);
  return insertedMessages;
}

// ============================================================================
// 1.4 事务：创建对话 + 首条消息（语法演示）
// ============================================================================

/**
 * 知识点：
 * - db.transaction() 保证原子性：要么全部成功，要么全部回滚
 * - 适用场景：创建对话时必须同时创建首条消息
 * - tx 是事务上下文，所有操作必须用 tx 而非 db
 *
 * 注意：neon-http 驱动不支持事务，需要使用 WebSocket 驱动（Pool）
 * 此示例仅演示语法，不实际执行
 */
export async function createConversationWithMessage(_userInput: string) {
  console.log('\n=== 1.4 事务：创建对话 + 首条消息（语法演示）===');
  console.log('提示：neon-http 驱动不支持事务，需使用 WebSocket 驱动（Pool）');

  const exampleCode = `
  // 事务示例（需要 WebSocket 驱动）
  const result = await db.transaction(async (tx) => {
    // 步骤 1：创建对话
    const [conversation] = await tx
      .insert(conversations)
      .values({
        userId: MOCK_USER_ID,
        title: userInput.slice(0, 50) + '...',
        modelId: 'claude-3-sonnet',
      })
      .returning();

    // 步骤 2：创建首条消息
    const [message] = await tx
      .insert(messages)
      .values({
        conversationId: conversation.id,
        role: 'user',
        content: [{ type: 'text', text: userInput }],
      })
      .returning();

    return { conversation, message };
  });
  `;

  console.log('示例代码：', exampleCode);
}

// ============================================================================
// 1.5 插入时处理冲突（upsert）
// ============================================================================

/**
 * 知识点：
 * - onConflictDoNothing() 遇到冲突时忽略
 * - onConflictDoUpdate() 遇到冲突时更新
 * - 需要表有唯一约束才能使用
 *
 * 注意：conversations 表没有唯一约束（除了主键），
 * 此示例仅演示语法，实际场景需根据业务设计
 */
export async function upsertExample() {
  console.log('\n=== 1.5 插入时处理冲突 ===');
  console.log('提示：onConflictDoNothing/onConflictDoUpdate 需要唯一约束支持');
  console.log('conversations 表的 userId 不是唯一的，此处仅演示语法');

  // 示例语法（不实际执行）
  const exampleCode = `
  // 遇到主键冲突时忽略
  await db.insert(someTable)
    .values({ id: 'xxx', name: 'test' })
    .onConflictDoNothing();

  // 遇到冲突时更新指定字段
  await db.insert(someTable)
    .values({ id: 'xxx', name: 'test' })
    .onConflictDoUpdate({
      target: someTable.id,
      set: { name: 'updated' },
    });
  `;

  console.log('示例代码：', exampleCode);
}

// ============================================================================
// 步骤定义
// ============================================================================

const STEPS = {
  '1.1': { name: '创建对话（基础插入）', fn: createConversation, needsConv: false },
  '1.2': { name: '创建消息（关联插入）', fn: createMessage, needsConv: true },
  '1.3': { name: '批量创建消息', fn: createMultipleMessages, needsConv: true },
  '1.4': { name: '事务：创建对话 + 首条消息', fn: () => createConversationWithMessage('请帮我写一段 Python 代码'), needsConv: false },
  '1.5': { name: '插入时处理冲突（upsert）', fn: upsertExample, needsConv: false },
};

function showHelp() {
  console.log('可用步骤：');
  Object.entries(STEPS).forEach(([key, { name }]) => {
    console.log(`  ${key}  ${name}`);
  });
  console.log('\n用法：bun run src/examples/crud/01-create.ts [步骤]');
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
  console.log('CRUD 教学示例 - Create（创建）');
  console.log('========================================');

  try {
    // 执行特定步骤
    if (arg && STEPS[arg as keyof typeof STEPS]) {
      const step = STEPS[arg as keyof typeof STEPS];
      console.log(`\n>>> 执行步骤 ${arg}: ${step.name}`);

      if (step.needsConv) {
        // 需要先创建对话
        console.log('>>> 准备测试数据（创建对话）...');
        const [conv] = await db
          .insert(conversations)
          .values({ userId: MOCK_USER_ID, title: '测试对话', modelId: 'claude-3-opus' })
          .returning();
        await step.fn(conv.id);
      } else {
        await step.fn();
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
    // 1.1 创建对话
    const conversation = await createConversation();

    // 1.2 创建消息
    await createMessage(conversation.id);

    // 1.3 批量创建消息
    await createMultipleMessages(conversation.id);

    // 1.4 事务
    await createConversationWithMessage('请帮我写一段 Python 代码');

    // 1.5 upsert 语法演示
    await upsertExample();

    console.log('\n========================================');
    console.log('所有 Create 示例执行完成！');
    console.log('========================================');
  } catch (error) {
    console.error('执行出错：', error);
    process.exit(1);
  }
}

// 直接运行时执行 main
main();
