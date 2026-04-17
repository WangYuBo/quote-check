/**
 * 架构模式教学示例 - Repository 模式
 *
 * Repository 模式将数据访问逻辑封装到独立的类中
 * 适用于：中型项目 / 查询逻辑复用多
 *
 * 运行方式：bunx tsx src/examples/patterns/03-repository.ts
 *
 * ============================================================================
 * 核心概念
 * ============================================================================
 *
 * 1. 单一职责：Repository 只负责数据存取，不处理业务逻辑
 * 2. 抽象数据源：上层代码不关心具体使用哪个 ORM
 * 3. 便于测试：可以轻松 Mock Repository 进行单元测试
 * 4. 复用查询：相同的查询逻辑可以在 Server Actions 和 API Routes 中复用
 *
 * ============================================================================
 * 文件组织
 * ============================================================================
 *
 * ```
 * src/
 * ├── repositories/
 * │   ├── conversation.repository.ts
 * │   ├── message.repository.ts
 * │   └── index.ts
 * ├── app/
 * │   ├── actions/
 * │   │   └── conversation.ts    # 使用 ConversationRepository
 * │   └── api/
 * │       └── conversations/
 * │           └── route.ts       # 使用 ConversationRepository
 * └── db/
 *     └── index.ts
 * ```
 */

import { db, conversations, messages } from '@/db';
import { eq, and, desc, count } from 'drizzle-orm';

import type { Conversation, Message } from '@/db/schema';

// ============================================================================
// 类型定义
// ============================================================================

interface CreateConversationInput {
  userId: string;
  title: string;
  modelId: string;
  searchEnabled?: boolean;
}

interface UpdateConversationInput {
  title?: string;
  modelId?: string;
  searchEnabled?: boolean;
  isArchived?: boolean;
}

interface FindConversationsOptions {
  userId: string;
  includeArchived?: boolean;
  limit?: number;
  offset?: number;
}

interface CreateMessageInput {
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: Array<{ type: 'text'; text: string }>;
  tokenCount?: number;
}

// ============================================================================
// ConversationRepository - 对话数据访问层
// ============================================================================

/**
 * 知识点：Repository 类封装所有对话相关的数据库操作
 *
 * 实际文件位置：src/repositories/conversation.repository.ts
 */
class ConversationRepository {
  /**
   * 根据 ID 查找对话
   */
  async findById(id: string, userId: string): Promise<Conversation | null> {
    const result = await db.query.conversations.findFirst({
      where: and(
        eq(conversations.id, id),
        eq(conversations.userId, userId)
      ),
    });
    return result ?? null;
  }

  /**
   * 查找对话并包含消息
   */
  async findByIdWithMessages(
    id: string,
    userId: string
  ): Promise<(Conversation & { messages: Message[] }) | null> {
    const result = await db.query.conversations.findFirst({
      where: and(
        eq(conversations.id, id),
        eq(conversations.userId, userId)
      ),
      with: {
        messages: {
          orderBy: (messages, { asc }) => [asc(messages.createdAt)],
        },
      },
    });
    return result ?? null;
  }

  /**
   * 查找用户的所有对话
   */
  async findMany(options: FindConversationsOptions): Promise<Conversation[]> {
    const { userId, includeArchived = false, limit = 20, offset = 0 } = options;

    const conditions = [eq(conversations.userId, userId)];

    if (!includeArchived) {
      conditions.push(eq(conversations.isArchived, false));
    }

    return db.query.conversations.findMany({
      where: and(...conditions),
      orderBy: desc(conversations.updatedAt),
      limit,
      offset,
    });
  }

  /**
   * 统计用户的对话数量
   */
  async countByUserId(userId: string, includeArchived = false): Promise<number> {
    const conditions = [eq(conversations.userId, userId)];

    if (!includeArchived) {
      conditions.push(eq(conversations.isArchived, false));
    }

    const [result] = await db
      .select({ total: count() })
      .from(conversations)
      .where(and(...conditions));

    return result.total;
  }

  /**
   * 创建对话
   */
  async create(input: CreateConversationInput): Promise<Conversation> {
    const [newConversation] = await db
      .insert(conversations)
      .values({
        userId: input.userId,
        title: input.title,
        modelId: input.modelId,
        searchEnabled: input.searchEnabled ?? false,
      })
      .returning();

    return newConversation;
  }

  /**
   * 更新对话
   */
  async update(
    id: string,
    userId: string,
    input: UpdateConversationInput
  ): Promise<Conversation | null> {
    const [updated] = await db
      .update(conversations)
      .set({
        title: input.title,
        modelId: input.modelId,
        searchEnabled: input.searchEnabled,
        isArchived: input.isArchived,
      })
      .where(
        and(
          eq(conversations.id, id),
          eq(conversations.userId, userId)
        )
      )
      .returning();

    return updated ?? null;
  }

  /**
   * 归档对话（软删除）
   */
  async archive(id: string, userId: string): Promise<Conversation | null> {
    return this.update(id, userId, { isArchived: true });
  }

  /**
   * 硬删除对话
   */
  async delete(id: string, userId: string): Promise<boolean> {
    const [deleted] = await db
      .delete(conversations)
      .where(
        and(
          eq(conversations.id, id),
          eq(conversations.userId, userId)
        )
      )
      .returning();

    return !!deleted;
  }
}

// ============================================================================
// MessageRepository - 消息数据访问层
// ============================================================================

/**
 * 知识点：消息 Repository
 */
class MessageRepository {
  /**
   * 根据 ID 查找消息
   */
  async findById(id: string): Promise<Message | null> {
    const result = await db.query.messages.findFirst({
      where: eq(messages.id, id),
    });
    return result ?? null;
  }

  /**
   * 查找对话的所有消息
   */
  async findByConversationId(
    conversationId: string,
    limit = 100,
    offset = 0
  ): Promise<Message[]> {
    return db.query.messages.findMany({
      where: eq(messages.conversationId, conversationId),
      orderBy: (messages, { asc }) => [asc(messages.createdAt)],
      limit,
      offset,
    });
  }

  /**
   * 统计对话的消息数量
   */
  async countByConversationId(conversationId: string): Promise<number> {
    const [result] = await db
      .select({ total: count() })
      .from(messages)
      .where(eq(messages.conversationId, conversationId));

    return result.total;
  }

  /**
   * 创建消息
   */
  async create(input: CreateMessageInput): Promise<Message> {
    const [newMessage] = await db
      .insert(messages)
      .values({
        conversationId: input.conversationId,
        role: input.role,
        content: input.content,
        tokenCount: input.tokenCount,
      })
      .returning();

    return newMessage;
  }

  /**
   * 删除消息
   */
  async delete(id: string): Promise<boolean> {
    const [deleted] = await db
      .delete(messages)
      .where(eq(messages.id, id))
      .returning();

    return !!deleted;
  }
}

// ============================================================================
// 导出单例实例
// ============================================================================

/**
 * 知识点：导出单例
 *
 * 实际项目中在 src/repositories/index.ts：
 *
 * ```typescript
 * export const conversationRepo = new ConversationRepository();
 * export const messageRepo = new MessageRepository();
 * ```
 */
const conversationRepo = new ConversationRepository();
const messageRepo = new MessageRepository();

// ============================================================================
// 在 Server Actions 中使用 Repository
// ============================================================================

/**
 * 知识点：Server Actions 调用 Repository
 *
 * ```typescript
 * // app/actions/conversation.ts
 * 'use server'
 *
 * import { conversationRepo } from '@/repositories';
 * import { getCurrentUser } from '@/lib/auth';
 *
 * export async function createConversation(input: CreateInput) {
 *   const user = await getCurrentUser();
 *   return conversationRepo.create({
 *     userId: user.id,
 *     title: input.title,
 *     modelId: input.modelId,
 *   });
 * }
 * ```
 */

// ============================================================================
// 在 API Routes 中使用 Repository
// ============================================================================

/**
 * 知识点：API Routes 调用 Repository
 *
 * ```typescript
 * // app/api/conversations/route.ts
 * import { conversationRepo } from '@/repositories';
 * import { getCurrentUser } from '@/lib/auth';
 *
 * export async function GET(request: Request) {
 *   const user = await getCurrentUser();
 *   const conversations = await conversationRepo.findMany({
 *     userId: user.id,
 *     limit: 20,
 *   });
 *   return Response.json({ success: true, data: conversations });
 * }
 * ```
 */

// ============================================================================
// 主函数：运行示例
// ============================================================================

async function main(): Promise<void> {
  console.log('========================================');
  console.log('架构模式示例 - Repository 模式');
  console.log('========================================');

  const MOCK_USER_ID = 'user_demo_001';

  try {
    // 1. 创建对话
    console.log('\n--- 1. conversationRepo.create() ---');
    const newConv = await conversationRepo.create({
      userId: MOCK_USER_ID,
      title: 'Repository 测试对话',
      modelId: 'claude-sonnet-4',
    });
    console.log('创建成功:', newConv.id);

    // 2. 查找对话
    console.log('\n--- 2. conversationRepo.findById() ---');
    const found = await conversationRepo.findById(newConv.id, MOCK_USER_ID);
    console.log('查找结果:', found?.title);

    // 3. 创建消息
    console.log('\n--- 3. messageRepo.create() ---');
    const msg1 = await messageRepo.create({
      conversationId: newConv.id,
      role: 'user',
      content: [{ type: 'text', text: '你好' }],
    });
    const msg2 = await messageRepo.create({
      conversationId: newConv.id,
      role: 'assistant',
      content: [{ type: 'text', text: '你好！有什么可以帮你的？' }],
      tokenCount: 20,
    });
    console.log('创建了 2 条消息');

    // 4. 查找对话（带消息）
    console.log('\n--- 4. conversationRepo.findByIdWithMessages() ---');
    const convWithMsgs = await conversationRepo.findByIdWithMessages(
      newConv.id,
      MOCK_USER_ID
    );
    console.log(`对话有 ${convWithMsgs?.messages.length} 条消息`);

    // 5. 统计
    console.log('\n--- 5. 统计查询 ---');
    const convCount = await conversationRepo.countByUserId(MOCK_USER_ID);
    const msgCount = await messageRepo.countByConversationId(newConv.id);
    console.log(`用户有 ${convCount} 个对话`);
    console.log(`当前对话有 ${msgCount} 条消息`);

    // 6. 查找用户的对话列表
    console.log('\n--- 6. conversationRepo.findMany() ---');
    const convList = await conversationRepo.findMany({
      userId: MOCK_USER_ID,
      limit: 5,
    });
    console.log(`查询到 ${convList.length} 个对话`);

    // 7. 更新对话
    console.log('\n--- 7. conversationRepo.update() ---');
    const updated = await conversationRepo.update(newConv.id, MOCK_USER_ID, {
      title: '更新后的标题',
      searchEnabled: true,
    });
    console.log('更新后:', updated?.title);

    // 8. 归档对话
    console.log('\n--- 8. conversationRepo.archive() ---');
    const archived = await conversationRepo.archive(newConv.id, MOCK_USER_ID);
    console.log('归档状态:', archived?.isArchived);

    console.log('\n========================================');
    console.log('Repository 模式示例执行完成！');
    console.log('========================================');
  } catch (error) {
    console.error('执行出错:', error);
    process.exit(1);
  }
}

main();
