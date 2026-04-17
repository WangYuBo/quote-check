/**
 * 架构模式教学示例 - Server Actions
 *
 * Server Actions 是 Next.js 14+ 推荐的服务端数据操作方式
 * 适用于：纯网页应用，无需给移动端/第三方调用
 *
 * 运行方式：bunx tsx src/examples/patterns/01-server-actions.ts
 *
 * ============================================================================
 * 核心概念
 * ============================================================================
 *
 * 1. 'use server' 声明：标记函数为服务端执行
 * 2. 可在客户端组件中直接调用，Next.js 自动处理 RPC
 * 3. 自动处理序列化/反序列化
 * 4. 支持渐进式增强（JavaScript 禁用时仍可工作）
 *
 * ============================================================================
 * 文件组织方式
 * ============================================================================
 *
 * 方式 1：独立 actions 文件（推荐）
 * ```
 * app/
 * ├── actions/
 * │   ├── conversation.ts    # 对话相关 actions
 * │   └── message.ts         # 消息相关 actions
 * └── chat/
 *     └── page.tsx           # 页面组件
 * ```
 *
 * 方式 2：组件内定义（简单场景）
 * ```typescript
 * // app/chat/page.tsx
 * async function submitMessage(formData: FormData) {
 *   'use server'
 *   // 服务端逻辑
 * }
 * ```
 */

// ============================================================================
// 模拟 'use server' 环境（实际项目中这些代码在 app/actions/ 目录）
// ============================================================================

import { db, conversations, messages } from '@/db';
import { eq, and, desc } from 'drizzle-orm';

import type { Conversation, Message } from '@/db/schema';

// 模拟用户 ID（实际项目中从 Neon Auth 获取）
const MOCK_USER_ID = 'user_demo_001';

// ============================================================================
// 定义输入类型
// ============================================================================

interface CreateConversationInput {
  title: string;
  modelId: string;
  searchEnabled?: boolean;
}

interface UpdateConversationInput {
  title?: string;
  modelId?: string;
  searchEnabled?: boolean;
}

interface CreateMessageInput {
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: Array<{ type: 'text'; text: string }>;
}

// ============================================================================
// Server Actions 示例
// ============================================================================

/**
 * 知识点：创建对话
 *
 * 实际文件位置：app/actions/conversation.ts
 *
 * ```typescript
 * 'use server'
 *
 * export async function createConversation(input: CreateConversationInput) {
 *   // 这里的代码在服务端执行
 * }
 * ```
 */
async function createConversation(
  input: CreateConversationInput
): Promise<Conversation> {
  // 'use server' 会在这里声明

  console.log('[Server Action] createConversation 被调用');

  const [newConversation] = await db
    .insert(conversations)
    .values({
      userId: MOCK_USER_ID,
      title: input.title,
      modelId: input.modelId,
      searchEnabled: input.searchEnabled ?? false,
    })
    .returning();

  return newConversation;
}

/**
 * 知识点：获取对话列表
 *
 * 注意：查询操作也可以用 Server Actions
 * 但对于纯查询，Server Component 直接获取更简洁
 */
async function getConversations(): Promise<Conversation[]> {
  // 'use server'

  console.log('[Server Action] getConversations 被调用');

  const result = await db.query.conversations.findMany({
    where: and(
      eq(conversations.userId, MOCK_USER_ID),
      eq(conversations.isArchived, false)
    ),
    orderBy: desc(conversations.updatedAt),
    limit: 20,
  });

  return result;
}

/**
 * 知识点：获取单个对话（带消息）
 */
async function getConversationWithMessages(
  conversationId: string
): Promise<(Conversation & { messages: Message[] }) | null> {
  // 'use server'

  console.log('[Server Action] getConversationWithMessages 被调用');

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

  return result ?? null;
}

/**
 * 知识点：更新对话
 */
async function updateConversation(
  conversationId: string,
  input: UpdateConversationInput
): Promise<Conversation | null> {
  // 'use server'

  console.log('[Server Action] updateConversation 被调用');

  const [updated] = await db
    .update(conversations)
    .set({
      title: input.title,
      modelId: input.modelId,
      searchEnabled: input.searchEnabled,
      // updatedAt 会自动更新（schema 中配置了 $onUpdate）
    })
    .where(
      and(
        eq(conversations.id, conversationId),
        eq(conversations.userId, MOCK_USER_ID)
      )
    )
    .returning();

  return updated ?? null;
}

/**
 * 知识点：删除对话（软删除 - 归档）
 */
async function archiveConversation(
  conversationId: string
): Promise<Conversation | null> {
  // 'use server'

  console.log('[Server Action] archiveConversation 被调用');

  const [archived] = await db
    .update(conversations)
    .set({ isArchived: true })
    .where(
      and(
        eq(conversations.id, conversationId),
        eq(conversations.userId, MOCK_USER_ID)
      )
    )
    .returning();

  return archived ?? null;
}

/**
 * 知识点：创建消息
 */
async function createMessage(input: CreateMessageInput): Promise<Message> {
  // 'use server'

  console.log('[Server Action] createMessage 被调用');

  // 先验证对话存在且属于当前用户
  const conversation = await db.query.conversations.findFirst({
    where: and(
      eq(conversations.id, input.conversationId),
      eq(conversations.userId, MOCK_USER_ID)
    ),
  });

  if (!conversation) {
    throw new Error('对话不存在或无权限');
  }

  const [newMessage] = await db
    .insert(messages)
    .values({
      conversationId: input.conversationId,
      role: input.role,
      content: input.content,
    })
    .returning();

  return newMessage;
}

// ============================================================================
// 客户端调用示例（React 组件中的用法）
// ============================================================================

/**
 * 知识点：在客户端组件中调用 Server Actions
 *
 * ```tsx
 * // app/chat/NewConversationButton.tsx
 * 'use client'
 *
 * import { createConversation } from '@/app/actions/conversation'
 *
 * export function NewConversationButton() {
 *   const handleClick = async () => {
 *     // 直接调用 Server Action，就像调用本地函数一样
 *     const newConv = await createConversation({
 *       title: '新对话',
 *       modelId: 'claude-sonnet-4',
 *     })
 *     // 跳转到新对话
 *     router.push(`/chat/${newConv.id}`)
 *   }
 *
 *   return <Button onClick={handleClick}>新建对话</Button>
 * }
 * ```
 */

/**
 * 知识点：配合 Form 使用（支持渐进式增强）
 *
 * ```tsx
 * // app/chat/ConversationForm.tsx
 * import { createConversation } from '@/app/actions/conversation'
 *
 * export function ConversationForm() {
 *   return (
 *     <form action={createConversation}>
 *       <input name="title" placeholder="对话标题" />
 *       <input name="modelId" value="claude-sonnet-4" type="hidden" />
 *       <button type="submit">创建</button>
 *     </form>
 *   )
 * }
 * ```
 */

/**
 * 知识点：使用 useFormState 处理表单状态
 *
 * ```tsx
 * 'use client'
 *
 * import { useFormState } from 'react-dom'
 * import { createConversation } from '@/app/actions/conversation'
 *
 * export function ConversationForm() {
 *   const [state, formAction] = useFormState(createConversation, null)
 *
 *   return (
 *     <form action={formAction}>
 *       {state?.error && <p className="text-red-500">{state.error}</p>}
 *       <input name="title" />
 *       <button type="submit">创建</button>
 *     </form>
 *   )
 * }
 * ```
 */

// ============================================================================
// 主函数：运行示例
// ============================================================================

async function main(): Promise<void> {
  console.log('========================================');
  console.log('架构模式示例 - Server Actions');
  console.log('========================================');

  try {
    // 1. 创建对话
    console.log('\n--- 1. 创建对话 ---');
    const newConv = await createConversation({
      title: 'Server Actions 测试对话',
      modelId: 'claude-sonnet-4',
    });
    console.log('创建成功:', newConv.id);

    // 2. 获取对话列表
    console.log('\n--- 2. 获取对话列表 ---');
    const convList = await getConversations();
    console.log(`共 ${convList.length} 个对话`);

    // 3. 创建消息
    console.log('\n--- 3. 创建消息 ---');
    const userMsg = await createMessage({
      conversationId: newConv.id,
      role: 'user',
      content: [{ type: 'text', text: '你好，这是 Server Actions 测试' }],
    });
    console.log('消息创建成功:', userMsg.id);

    // 4. 获取对话详情（带消息）
    console.log('\n--- 4. 获取对话详情 ---');
    const convWithMsgs = await getConversationWithMessages(newConv.id);
    console.log(`对话 "${convWithMsgs?.title}" 有 ${convWithMsgs?.messages.length} 条消息`);

    // 5. 更新对话
    console.log('\n--- 5. 更新对话 ---');
    const updated = await updateConversation(newConv.id, {
      title: '已更新的标题',
      searchEnabled: true,
    });
    console.log('更新后标题:', updated?.title);

    // 6. 归档对话
    console.log('\n--- 6. 归档对话 ---');
    const archived = await archiveConversation(newConv.id);
    console.log('归档状态:', archived?.isArchived);

    console.log('\n========================================');
    console.log('Server Actions 示例执行完成！');
    console.log('========================================');
  } catch (error) {
    console.error('执行出错:', error);
    process.exit(1);
  }
}

main();
