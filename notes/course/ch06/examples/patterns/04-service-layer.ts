/**
 * 架构模式教学示例 - Service + Repository 三层架构
 *
 * Service 层负责业务逻辑，Repository 层负责数据访问
 * 适用于：企业级 / 复杂业务逻辑
 *
 * 运行方式：bunx tsx src/examples/patterns/04-service-layer.ts
 *
 * ============================================================================
 * 核心概念
 * ============================================================================
 *
 * 三层架构：
 * 1. Controller 层（Server Actions / API Routes）：接收请求、返回响应
 * 2. Service 层：处理业务逻辑、事务管理、权限校验
 * 3. Repository 层：数据访问、CRUD 操作
 *
 * ============================================================================
 * 文件组织
 * ============================================================================
 *
 * ```
 * src/
 * ├── services/
 * │   ├── conversation.service.ts    # 业务逻辑
 * │   └── index.ts
 * ├── repositories/
 * │   ├── conversation.repository.ts # 数据访问
 * │   └── index.ts
 * └── app/
 *     ├── actions/
 *     │   └── conversation.ts        # 调用 Service
 *     └── api/
 *         └── conversations/
 *             └── route.ts           # 调用 Service
 * ```
 *
 * ============================================================================
 * 职责划分
 * ============================================================================
 *
 * | 层级 | 职责 | 示例 |
 * |------|------|------|
 * | Controller | 请求/响应处理 | 解析参数、返回 JSON |
 * | Service | 业务逻辑 | 创建对话时自动创建首条消息 |
 * | Repository | 数据访问 | 增删改查 |
 */

import { db, conversations, messages } from '@/db';
import { eq, and, desc, count, sql } from 'drizzle-orm';

import type { Conversation, Message } from '@/db/schema';

// ============================================================================
// 类型定义
// ============================================================================

interface CreateConversationInput {
  title: string;
  modelId: string;
  searchEnabled?: boolean;
  firstMessage?: string; // 可选的首条消息
}

interface UpdateConversationInput {
  title?: string;
  modelId?: string;
  searchEnabled?: boolean;
}

interface SendMessageInput {
  conversationId: string;
  content: string;
}

interface ConversationWithStats extends Conversation {
  messageCount: number;
  totalTokens: number;
}

// ============================================================================
// Repository 层 - 数据访问
// ============================================================================

/**
 * 知识点：Repository 只负责数据存取，不包含业务逻辑
 */
class ConversationRepository {
  async findById(id: string, userId: string): Promise<Conversation | null> {
    const result = await db.query.conversations.findFirst({
      where: and(
        eq(conversations.id, id),
        eq(conversations.userId, userId)
      ),
    });
    return result ?? null;
  }

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

  async findMany(userId: string, limit = 20, offset = 0): Promise<Conversation[]> {
    return db.query.conversations.findMany({
      where: and(
        eq(conversations.userId, userId),
        eq(conversations.isArchived, false)
      ),
      orderBy: desc(conversations.updatedAt),
      limit,
      offset,
    });
  }

  async create(
    data: { userId: string; title: string; modelId: string; searchEnabled?: boolean },
    tx?: typeof db
  ): Promise<Conversation> {
    const database = tx ?? db;
    const [newConv] = await database
      .insert(conversations)
      .values({
        userId: data.userId,
        title: data.title,
        modelId: data.modelId,
        searchEnabled: data.searchEnabled ?? false,
      })
      .returning();
    return newConv;
  }

  async update(
    id: string,
    userId: string,
    data: Partial<Conversation>
  ): Promise<Conversation | null> {
    const [updated] = await db
      .update(conversations)
      .set(data)
      .where(
        and(
          eq(conversations.id, id),
          eq(conversations.userId, userId)
        )
      )
      .returning();
    return updated ?? null;
  }

  async archive(id: string, userId: string): Promise<Conversation | null> {
    return this.update(id, userId, { isArchived: true });
  }
}

class MessageRepository {
  async create(
    data: {
      conversationId: string;
      role: 'user' | 'assistant' | 'system';
      content: Array<{ type: 'text'; text: string }>;
      tokenCount?: number;
    },
    tx?: typeof db
  ): Promise<Message> {
    const database = tx ?? db;
    const [newMsg] = await database
      .insert(messages)
      .values({
        conversationId: data.conversationId,
        role: data.role,
        content: data.content,
        tokenCount: data.tokenCount,
      })
      .returning();
    return newMsg;
  }

  async countByConversationId(conversationId: string): Promise<number> {
    const [result] = await db
      .select({ total: count() })
      .from(messages)
      .where(eq(messages.conversationId, conversationId));
    return result.total;
  }

  async sumTokensByConversationId(conversationId: string): Promise<number> {
    const [result] = await db
      .select({
        total: sql<number>`COALESCE(SUM(${messages.tokenCount}), 0)`,
      })
      .from(messages)
      .where(eq(messages.conversationId, conversationId));
    return result.total;
  }
}

// ============================================================================
// Service 层 - 业务逻辑
// ============================================================================

/**
 * 知识点：Service 层封装业务逻辑
 *
 * 实际文件位置：src/services/conversation.service.ts
 */
class ConversationService {
  constructor(
    private conversationRepo: ConversationRepository,
    private messageRepo: MessageRepository
  ) {}

  /**
   * 获取对话详情
   */
  async getConversation(
    conversationId: string,
    userId: string
  ): Promise<Conversation | null> {
    return this.conversationRepo.findById(conversationId, userId);
  }

  /**
   * 获取对话列表
   */
  async getConversations(
    userId: string,
    page = 1,
    pageSize = 20
  ): Promise<{ data: Conversation[]; total: number }> {
    const offset = (page - 1) * pageSize;
    const data = await this.conversationRepo.findMany(userId, pageSize, offset);

    return { data, total: data.length };
  }

  /**
   * 知识点：业务逻辑 - 创建对话并自动创建首条消息
   *
   * 这里体现 Service 层的价值：
   * - 封装"创建对话 + 首条消息"的复合业务逻辑
   * - 使用事务保证原子性
   * - Repository 层不需要知道这个业务规则
   */
  async createConversation(
    userId: string,
    input: CreateConversationInput
  ): Promise<Conversation & { firstMessage?: Message }> {
    // 如果没有首条消息，直接创建对话
    if (!input.firstMessage) {
      const conversation = await this.conversationRepo.create({
        userId,
        title: input.title,
        modelId: input.modelId,
        searchEnabled: input.searchEnabled,
      });
      return conversation;
    }

    // 有首条消息时，使用事务保证原子性
    const result = await db.transaction(async (tx) => {
      // 1. 创建对话
      const conversation = await this.conversationRepo.create(
        {
          userId,
          title: input.title,
          modelId: input.modelId,
          searchEnabled: input.searchEnabled,
        },
        tx as typeof db
      );

      // 2. 创建首条消息
      const firstMessage = await this.messageRepo.create(
        {
          conversationId: conversation.id,
          role: 'user',
          content: [{ type: 'text', text: input.firstMessage! }],
        },
        tx as typeof db
      );

      return { ...conversation, firstMessage };
    });

    return result;
  }

  /**
   * 知识点：业务逻辑 - 更新对话（带权限检查）
   */
  async updateConversation(
    conversationId: string,
    userId: string,
    input: UpdateConversationInput
  ): Promise<Conversation | null> {
    // 业务规则：先检查对话是否存在
    const existing = await this.conversationRepo.findById(conversationId, userId);

    if (!existing) {
      return null;
    }

    return this.conversationRepo.update(conversationId, userId, {
      title: input.title,
      modelId: input.modelId,
      searchEnabled: input.searchEnabled,
    });
  }

  /**
   * 知识点：业务逻辑 - 发送消息（带业务校验）
   */
  async sendMessage(
    userId: string,
    input: SendMessageInput
  ): Promise<{ userMessage: Message; conversation: Conversation }> {
    // 1. 验证对话存在且属于当前用户
    const conversation = await this.conversationRepo.findById(
      input.conversationId,
      userId
    );

    if (!conversation) {
      throw new Error('对话不存在或无权限');
    }

    // 2. 业务规则：已归档的对话不能发送消息
    if (conversation.isArchived) {
      throw new Error('已归档的对话不能发送消息');
    }

    // 3. 创建用户消息
    const userMessage = await this.messageRepo.create({
      conversationId: input.conversationId,
      role: 'user',
      content: [{ type: 'text', text: input.content }],
    });

    return { userMessage, conversation };
  }

  /**
   * 知识点：业务逻辑 - 获取对话统计信息
   *
   * 聚合多个 Repository 查询，返回复合数据
   */
  async getConversationWithStats(
    conversationId: string,
    userId: string
  ): Promise<ConversationWithStats | null> {
    const conversation = await this.conversationRepo.findById(conversationId, userId);

    if (!conversation) {
      return null;
    }

    const [messageCount, totalTokens] = await Promise.all([
      this.messageRepo.countByConversationId(conversationId),
      this.messageRepo.sumTokensByConversationId(conversationId),
    ]);

    return {
      ...conversation,
      messageCount,
      totalTokens,
    };
  }

  /**
   * 归档对话
   */
  async archiveConversation(
    conversationId: string,
    userId: string
  ): Promise<Conversation | null> {
    return this.conversationRepo.archive(conversationId, userId);
  }
}

// ============================================================================
// 实例化
// ============================================================================

const conversationRepo = new ConversationRepository();
const messageRepo = new MessageRepository();
const conversationService = new ConversationService(conversationRepo, messageRepo);

// ============================================================================
// Controller 层调用示例
// ============================================================================

/**
 * 知识点：Server Actions 调用 Service
 *
 * ```typescript
 * // app/actions/conversation.ts
 * 'use server'
 *
 * import { conversationService } from '@/services';
 * import { getCurrentUser } from '@/lib/auth';
 *
 * export async function createConversation(input: CreateInput) {
 *   const user = await getCurrentUser();
 *
 *   // Controller 层只负责：获取用户、调用 Service、返回结果
 *   return conversationService.createConversation(user.id, input);
 * }
 * ```
 */

/**
 * 知识点：API Routes 调用 Service
 *
 * ```typescript
 * // app/api/conversations/route.ts
 * import { conversationService } from '@/services';
 * import { getCurrentUser } from '@/lib/auth';
 *
 * export async function POST(request: Request) {
 *   const user = await getCurrentUser();
 *   const body = await request.json();
 *
 *   try {
 *     const result = await conversationService.createConversation(user.id, body);
 *     return Response.json({ success: true, data: result });
 *   } catch (error) {
 *     return Response.json(
 *       { success: false, error: error.message },
 *       { status: 400 }
 *     );
 *   }
 * }
 * ```
 */

// ============================================================================
// 主函数：运行示例
// ============================================================================

async function main(): Promise<void> {
  console.log('========================================');
  console.log('架构模式示例 - Service + Repository');
  console.log('========================================');

  const MOCK_USER_ID = 'user_demo_001';

  try {
    // 1. 创建对话（不带首条消息）
    console.log('\n--- 1. 创建对话（不带首条消息）---');
    const conv1 = await conversationService.createConversation(MOCK_USER_ID, {
      title: 'Service 层测试对话',
      modelId: 'claude-sonnet-4',
    });
    console.log('创建成功:', conv1.id);

    // 2. 创建对话（带首条消息 - 事务）
    console.log('\n--- 2. 创建对话（带首条消息 - 事务）---');
    const conv2 = await conversationService.createConversation(MOCK_USER_ID, {
      title: '事务测试对话',
      modelId: 'claude-sonnet-4',
      firstMessage: '你好，这是首条消息',
    });
    console.log('对话 ID:', conv2.id);
    console.log('首条消息 ID:', conv2.firstMessage?.id);

    // 3. 发送消息
    console.log('\n--- 3. 发送消息 ---');
    const { userMessage } = await conversationService.sendMessage(MOCK_USER_ID, {
      conversationId: conv2.id,
      content: '这是第二条消息',
    });
    console.log('消息发送成功:', userMessage.id);

    // 4. 获取对话统计
    console.log('\n--- 4. 获取对话统计 ---');
    const stats = await conversationService.getConversationWithStats(
      conv2.id,
      MOCK_USER_ID
    );
    console.log('对话标题:', stats?.title);
    console.log('消息数量:', stats?.messageCount);
    console.log('总 Token:', stats?.totalTokens);

    // 5. 更新对话
    console.log('\n--- 5. 更新对话 ---');
    const updated = await conversationService.updateConversation(
      conv2.id,
      MOCK_USER_ID,
      { title: '更新后的标题', searchEnabled: true }
    );
    console.log('更新后:', updated?.title);

    // 6. 获取对话列表
    console.log('\n--- 6. 获取对话列表 ---');
    const { data: convList } = await conversationService.getConversations(
      MOCK_USER_ID,
      1,
      10
    );
    console.log(`共 ${convList.length} 个对话`);

    // 7. 归档对话
    console.log('\n--- 7. 归档对话 ---');
    const archived = await conversationService.archiveConversation(
      conv2.id,
      MOCK_USER_ID
    );
    console.log('归档状态:', archived?.isArchived);

    // 8. 测试业务规则：已归档对话不能发送消息
    console.log('\n--- 8. 测试业务规则 ---');
    try {
      await conversationService.sendMessage(MOCK_USER_ID, {
        conversationId: conv2.id,
        content: '尝试给已归档对话发消息',
      });
    } catch (error) {
      console.log('业务规则生效:', (error as Error).message);
    }

    console.log('\n========================================');
    console.log('Service + Repository 示例执行完成！');
    console.log('========================================');
  } catch (error) {
    console.error('执行出错:', error);
    process.exit(1);
  }
}

main();
