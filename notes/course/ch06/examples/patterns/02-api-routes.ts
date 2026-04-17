/**
 * 架构模式教学示例 - API Routes
 *
 * API Routes 是 Next.js 提供的 RESTful API 实现方式
 * 适用于：需要给移动端 App / 第三方系统调用
 *
 * 运行方式：bunx tsx src/examples/patterns/02-api-routes.ts
 *
 * ============================================================================
 * 核心概念
 * ============================================================================
 *
 * 1. 文件即路由：app/api/xxx/route.ts → /api/xxx
 * 2. 导出 HTTP 方法：GET, POST, PATCH, PUT, DELETE
 * 3. 使用 Request/Response Web API
 * 4. 支持动态路由：app/api/xxx/[id]/route.ts
 *
 * ============================================================================
 * 文件组织
 * ============================================================================
 *
 * ```
 * app/api/
 * ├── conversations/
 * │   ├── route.ts           # GET /api/conversations, POST /api/conversations
 * │   └── [id]/
 * │       └── route.ts       # GET/PATCH/DELETE /api/conversations/:id
 * └── messages/
 *     └── route.ts           # POST /api/messages
 * ```
 */

import { db, conversations, messages } from '@/db';
import { eq, and, desc } from 'drizzle-orm';

import type { Conversation, Message } from '@/db/schema';

// 模拟用户 ID（实际项目中从认证中间件获取）
const MOCK_USER_ID = 'user_demo_001';

// ============================================================================
// API Route 代码示例（展示在 route.ts 中的写法）
// ============================================================================

/**
 * 知识点：获取对话列表
 *
 * 实际文件位置：app/api/conversations/route.ts
 *
 * ```typescript
 * // GET /api/conversations
 * export async function GET(request: Request) {
 *   const { searchParams } = new URL(request.url);
 *   const page = parseInt(searchParams.get('page') || '1');
 *   const limit = parseInt(searchParams.get('limit') || '20');
 *   // ...
 * }
 * ```
 */
async function handleGetConversations(
  page: number = 1,
  limit: number = 20
): Promise<Response> {
  console.log('[API Route] GET /api/conversations');

  try {
    const offset = (page - 1) * limit;

    const result = await db.query.conversations.findMany({
      where: and(
        eq(conversations.userId, MOCK_USER_ID),
        eq(conversations.isArchived, false)
      ),
      orderBy: desc(conversations.updatedAt),
      limit,
      offset,
    });

    // 返回 JSON 响应
    return Response.json({
      success: true,
      data: result,
      pagination: { page, limit, total: result.length },
    });
  } catch (error) {
    return Response.json(
      { success: false, error: '获取对话列表失败' },
      { status: 500 }
    );
  }
}

/**
 * 知识点：创建对话
 *
 * ```typescript
 * // POST /api/conversations
 * export async function POST(request: Request) {
 *   const body = await request.json();
 *   // 验证输入...
 *   // 创建记录...
 * }
 * ```
 */
async function handleCreateConversation(
  body: { title: string; modelId: string; searchEnabled?: boolean }
): Promise<Response> {
  console.log('[API Route] POST /api/conversations');

  try {
    // 实际项目中这里应该用 Zod 验证
    if (!body.title || !body.modelId) {
      return Response.json(
        { success: false, error: '缺少必填字段' },
        { status: 400 }
      );
    }

    const [newConversation] = await db
      .insert(conversations)
      .values({
        userId: MOCK_USER_ID,
        title: body.title,
        modelId: body.modelId,
        searchEnabled: body.searchEnabled ?? false,
      })
      .returning();

    return Response.json(
      { success: true, data: newConversation },
      { status: 201 }
    );
  } catch (error) {
    return Response.json(
      { success: false, error: '创建对话失败' },
      { status: 500 }
    );
  }
}

/**
 * 知识点：获取单个对话
 *
 * 实际文件位置：app/api/conversations/[id]/route.ts
 *
 * ```typescript
 * // GET /api/conversations/:id
 * export async function GET(
 *   request: Request,
 *   { params }: { params: { id: string } }
 * ) {
 *   const conversationId = params.id;
 *   // ...
 * }
 * ```
 */
async function handleGetConversation(
  conversationId: string
): Promise<Response> {
  console.log(`[API Route] GET /api/conversations/${conversationId}`);

  try {
    const result = await db.query.conversations.findFirst({
      where: and(
        eq(conversations.id, conversationId),
        eq(conversations.userId, MOCK_USER_ID)
      ),
      with: {
        messages: {
          orderBy: (messages, { asc }) => [asc(messages.createdAt)],
        },
      },
    });

    if (!result) {
      return Response.json(
        { success: false, error: '对话不存在' },
        { status: 404 }
      );
    }

    return Response.json({ success: true, data: result });
  } catch (error) {
    return Response.json(
      { success: false, error: '获取对话失败' },
      { status: 500 }
    );
  }
}

/**
 * 知识点：更新对话
 *
 * ```typescript
 * // PATCH /api/conversations/:id
 * export async function PATCH(
 *   request: Request,
 *   { params }: { params: { id: string } }
 * ) {
 *   const body = await request.json();
 *   // ...
 * }
 * ```
 */
async function handleUpdateConversation(
  conversationId: string,
  body: { title?: string; modelId?: string; searchEnabled?: boolean }
): Promise<Response> {
  console.log(`[API Route] PATCH /api/conversations/${conversationId}`);

  try {
    const [updated] = await db
      .update(conversations)
      .set({
        title: body.title,
        modelId: body.modelId,
        searchEnabled: body.searchEnabled,
      })
      .where(
        and(
          eq(conversations.id, conversationId),
          eq(conversations.userId, MOCK_USER_ID)
        )
      )
      .returning();

    if (!updated) {
      return Response.json(
        { success: false, error: '对话不存在或无权限' },
        { status: 404 }
      );
    }

    return Response.json({ success: true, data: updated });
  } catch (error) {
    return Response.json(
      { success: false, error: '更新对话失败' },
      { status: 500 }
    );
  }
}

/**
 * 知识点：删除对话
 *
 * ```typescript
 * // DELETE /api/conversations/:id
 * export async function DELETE(
 *   request: Request,
 *   { params }: { params: { id: string } }
 * ) {
 *   // ...
 * }
 * ```
 */
async function handleDeleteConversation(
  conversationId: string
): Promise<Response> {
  console.log(`[API Route] DELETE /api/conversations/${conversationId}`);

  try {
    // 软删除（归档）
    const [deleted] = await db
      .update(conversations)
      .set({ isArchived: true })
      .where(
        and(
          eq(conversations.id, conversationId),
          eq(conversations.userId, MOCK_USER_ID)
        )
      )
      .returning();

    if (!deleted) {
      return Response.json(
        { success: false, error: '对话不存在或无权限' },
        { status: 404 }
      );
    }

    return Response.json({ success: true, data: { id: conversationId } });
  } catch (error) {
    return Response.json(
      { success: false, error: '删除对话失败' },
      { status: 500 }
    );
  }
}

/**
 * 知识点：创建消息
 *
 * 实际文件位置：app/api/messages/route.ts
 */
async function handleCreateMessage(
  body: {
    conversationId: string;
    role: 'user' | 'assistant' | 'system';
    content: Array<{ type: 'text'; text: string }>;
  }
): Promise<Response> {
  console.log('[API Route] POST /api/messages');

  try {
    // 验证对话存在且属于当前用户
    const conversation = await db.query.conversations.findFirst({
      where: and(
        eq(conversations.id, body.conversationId),
        eq(conversations.userId, MOCK_USER_ID)
      ),
    });

    if (!conversation) {
      return Response.json(
        { success: false, error: '对话不存在或无权限' },
        { status: 404 }
      );
    }

    const [newMessage] = await db
      .insert(messages)
      .values({
        conversationId: body.conversationId,
        role: body.role,
        content: body.content,
      })
      .returning();

    return Response.json(
      { success: true, data: newMessage },
      { status: 201 }
    );
  } catch (error) {
    return Response.json(
      { success: false, error: '创建消息失败' },
      { status: 500 }
    );
  }
}

// ============================================================================
// 客户端调用示例
// ============================================================================

/**
 * 知识点：使用 fetch 调用 API
 *
 * ```typescript
 * // 在客户端或移动端调用
 * const response = await fetch('/api/conversations', {
 *   method: 'POST',
 *   headers: {
 *     'Content-Type': 'application/json',
 *     'Authorization': `Bearer ${token}`,  // 认证令牌
 *   },
 *   body: JSON.stringify({
 *     title: '新对话',
 *     modelId: 'claude-sonnet-4',
 *   }),
 * });
 *
 * const result = await response.json();
 * if (result.success) {
 *   console.log('创建成功:', result.data);
 * } else {
 *   console.error('创建失败:', result.error);
 * }
 * ```
 */

/**
 * 知识点：API 响应格式规范
 *
 * ```typescript
 * // 成功响应
 * {
 *   success: true,
 *   data: { ... },           // 实际数据
 *   pagination?: { ... },    // 分页信息（列表接口）
 * }
 *
 * // 失败响应
 * {
 *   success: false,
 *   error: '错误信息',       // 用户友好的错误信息
 *   code?: 'ERROR_CODE',     // 可选的错误代码
 * }
 * ```
 */

// ============================================================================
// 主函数：运行示例
// ============================================================================

async function main(): Promise<void> {
  console.log('========================================');
  console.log('架构模式示例 - API Routes');
  console.log('========================================');

  try {
    // 1. POST /api/conversations - 创建对话
    console.log('\n--- 1. POST /api/conversations ---');
    const createRes = await handleCreateConversation({
      title: 'API Routes 测试对话',
      modelId: 'claude-sonnet-4',
    });
    const createData = await createRes.json();
    console.log('状态码:', createRes.status);
    console.log('响应:', JSON.stringify(createData, null, 2));

    const conversationId = createData.data?.id;

    // 2. GET /api/conversations - 获取列表
    console.log('\n--- 2. GET /api/conversations ---');
    const listRes = await handleGetConversations(1, 10);
    const listData = await listRes.json();
    console.log('状态码:', listRes.status);
    console.log(`共 ${listData.data?.length} 个对话`);

    // 3. POST /api/messages - 创建消息
    console.log('\n--- 3. POST /api/messages ---');
    const msgRes = await handleCreateMessage({
      conversationId,
      role: 'user',
      content: [{ type: 'text', text: '你好，这是 API 测试' }],
    });
    const msgData = await msgRes.json();
    console.log('状态码:', msgRes.status);
    console.log('消息 ID:', msgData.data?.id);

    // 4. GET /api/conversations/:id - 获取单个对话
    console.log('\n--- 4. GET /api/conversations/:id ---');
    const getRes = await handleGetConversation(conversationId);
    const getData = await getRes.json();
    console.log('状态码:', getRes.status);
    console.log(`对话 "${getData.data?.title}" 有 ${getData.data?.messages?.length} 条消息`);

    // 5. PATCH /api/conversations/:id - 更新对话
    console.log('\n--- 5. PATCH /api/conversations/:id ---');
    const updateRes = await handleUpdateConversation(conversationId, {
      title: '更新后的标题',
      searchEnabled: true,
    });
    const updateData = await updateRes.json();
    console.log('状态码:', updateRes.status);
    console.log('更新后:', updateData.data?.title);

    // 6. DELETE /api/conversations/:id - 删除对话
    console.log('\n--- 6. DELETE /api/conversations/:id ---');
    const deleteRes = await handleDeleteConversation(conversationId);
    const deleteData = await deleteRes.json();
    console.log('状态码:', deleteRes.status);
    console.log('删除成功:', deleteData.success);

    // 7. 测试 404 - 获取不存在的对话
    console.log('\n--- 7. GET /api/conversations/:id (404) ---');
    const notFoundRes = await handleGetConversation('non-existent-id');
    const notFoundData = await notFoundRes.json();
    console.log('状态码:', notFoundRes.status);
    console.log('错误:', notFoundData.error);

    console.log('\n========================================');
    console.log('API Routes 示例执行完成！');
    console.log('========================================');
  } catch (error) {
    console.error('执行出错:', error);
    process.exit(1);
  }
}

main();
