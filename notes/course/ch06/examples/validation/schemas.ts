/**
 * Zod 校验教学示例
 *
 * Zod 是 TypeScript-first 的数据校验库
 * 用于验证 API 请求、表单数据、环境变量等
 *
 * 运行方式：bunx tsx src/examples/validation/schemas.ts
 *
 * ============================================================================
 * 核心概念
 * ============================================================================
 *
 * 1. Schema 定义：描述数据结构和校验规则
 * 2. .parse()：校验数据，失败抛出 ZodError
 * 3. .safeParse()：校验数据，返回 { success, data/error }
 * 4. 类型推断：从 Schema 自动推断 TypeScript 类型
 *
 * ============================================================================
 * 为什么需要 Zod？
 * ============================================================================
 *
 * 1. TypeScript 类型只在编译时检查，运行时不检查
 * 2. 用户输入、API 响应、环境变量都是"不可信"的
 * 3. Zod 在运行时验证数据，提供安全保障
 *
 * ```
 * 编译时类型检查（TypeScript）
 *      ↓
 * 运行时数据校验（Zod）← 补充这一环
 *      ↓
 * 安全使用数据
 * ```
 */

import { z } from 'zod';

// ============================================================================
// 1. 基础 Schema 定义
// ============================================================================

/**
 * 知识点：对话创建 Schema
 *
 * 用于验证 POST /api/conversations 请求体
 */
export const createConversationSchema = z.object({
  title: z
    .string()
    .min(1, '标题不能为空')
    .max(200, '标题不能超过 200 个字符'),
  modelId: z
    .string()
    .min(1, '模型 ID 不能为空'),
  searchEnabled: z
    .boolean()
    .optional()
    .default(false),
});

// 从 Schema 推断类型
export type CreateConversationInput = z.infer<typeof createConversationSchema>;

/**
 * 知识点：对话更新 Schema
 *
 * 用于验证 PATCH /api/conversations/:id 请求体
 * 所有字段都是可选的
 */
export const updateConversationSchema = z.object({
  title: z
    .string()
    .min(1, '标题不能为空')
    .max(200, '标题不能超过 200 个字符')
    .optional(),
  modelId: z
    .string()
    .min(1, '模型 ID 不能为空')
    .optional(),
  searchEnabled: z
    .boolean()
    .optional(),
});

export type UpdateConversationInput = z.infer<typeof updateConversationSchema>;

/**
 * 知识点：消息内容 Schema
 *
 * 支持多模态内容（文本、图片等）
 */
const messageContentSchema = z.array(
  z.discriminatedUnion('type', [
    z.object({
      type: z.literal('text'),
      text: z.string().min(1, '文本内容不能为空'),
    }),
    z.object({
      type: z.literal('image'),
      imageUrl: z.string().url('图片 URL 格式不正确'),
    }),
  ])
).min(1, '消息内容不能为空');

/**
 * 知识点：消息创建 Schema
 */
export const createMessageSchema = z.object({
  conversationId: z
    .string()
    .uuid('对话 ID 格式不正确'),
  role: z
    .enum(['user', 'assistant', 'system'], {
      errorMap: () => ({ message: '角色只能是 user、assistant 或 system' }),
    }),
  content: messageContentSchema,
});

export type CreateMessageInput = z.infer<typeof createMessageSchema>;

// ============================================================================
// 2. 高级校验技巧
// ============================================================================

/**
 * 知识点：URL 参数校验
 *
 * 用于验证 GET /api/conversations?page=1&limit=20
 */
export const paginationSchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => parseInt(val || '1', 10))
    .refine((val) => val >= 1, '页码必须大于 0'),
  limit: z
    .string()
    .optional()
    .transform((val) => parseInt(val || '20', 10))
    .refine((val) => val >= 1 && val <= 100, '每页数量必须在 1-100 之间'),
});

export type PaginationParams = z.infer<typeof paginationSchema>;

/**
 * 知识点：ID 参数校验
 */
export const idParamSchema = z.object({
  id: z.string().uuid('ID 格式不正确'),
});

/**
 * 知识点：复杂业务规则校验
 *
 * 使用 .refine() 添加自定义校验逻辑
 */
export const searchConversationSchema = z.object({
  keyword: z
    .string()
    .min(2, '搜索关键词至少 2 个字符')
    .max(50, '搜索关键词不能超过 50 个字符'),
  startDate: z
    .string()
    .datetime()
    .optional(),
  endDate: z
    .string()
    .datetime()
    .optional(),
}).refine(
  (data) => {
    // 自定义规则：如果有结束日期，开始日期必须早于结束日期
    if (data.startDate && data.endDate) {
      return new Date(data.startDate) <= new Date(data.endDate);
    }
    return true;
  },
  { message: '开始日期必须早于结束日期' }
);

// ============================================================================
// 3. 在 Server Actions 中使用 Zod
// ============================================================================

/**
 * 知识点：Server Actions + Zod
 *
 * ```typescript
 * // app/actions/conversation.ts
 * 'use server'
 *
 * import { createConversationSchema } from '@/schemas';
 *
 * export async function createConversation(formData: FormData) {
 *   // 1. 从 FormData 提取数据
 *   const rawData = {
 *     title: formData.get('title'),
 *     modelId: formData.get('modelId'),
 *   };
 *
 *   // 2. 用 Zod 校验
 *   const result = createConversationSchema.safeParse(rawData);
 *
 *   if (!result.success) {
 *     // 3. 校验失败，返回错误信息
 *     return {
 *       success: false,
 *       errors: result.error.flatten().fieldErrors,
 *     };
 *   }
 *
 *   // 4. 校验通过，result.data 有完整类型
 *   const conversation = await db.insert(conversations)
 *     .values({
 *       userId: user.id,
 *       title: result.data.title,      // string
 *       modelId: result.data.modelId,  // string
 *       searchEnabled: result.data.searchEnabled, // boolean (默认 false)
 *     })
 *     .returning();
 *
 *   return { success: true, data: conversation[0] };
 * }
 * ```
 */

// ============================================================================
// 4. 在 API Routes 中使用 Zod
// ============================================================================

/**
 * 知识点：API Routes + Zod
 *
 * ```typescript
 * // app/api/conversations/route.ts
 * import { createConversationSchema } from '@/schemas';
 *
 * export async function POST(request: Request) {
 *   const body = await request.json();
 *
 *   // 使用 safeParse 避免抛出异常
 *   const result = createConversationSchema.safeParse(body);
 *
 *   if (!result.success) {
 *     return Response.json(
 *       {
 *         success: false,
 *         error: '请求参数错误',
 *         details: result.error.flatten().fieldErrors,
 *       },
 *       { status: 400 }
 *     );
 *   }
 *
 *   // result.data 是类型安全的
 *   const conversation = await createConversation(user.id, result.data);
 *   return Response.json({ success: true, data: conversation });
 * }
 * ```
 */

/**
 * 知识点：URL 参数校验
 *
 * ```typescript
 * // app/api/conversations/route.ts
 * import { paginationSchema } from '@/schemas';
 *
 * export async function GET(request: Request) {
 *   const { searchParams } = new URL(request.url);
 *
 *   const result = paginationSchema.safeParse({
 *     page: searchParams.get('page'),
 *     limit: searchParams.get('limit'),
 *   });
 *
 *   if (!result.success) {
 *     return Response.json(
 *       { success: false, error: '分页参数错误' },
 *       { status: 400 }
 *     );
 *   }
 *
 *   const { page, limit } = result.data; // number, number
 *   // ...
 * }
 * ```
 */

// ============================================================================
// 5. 错误处理最佳实践
// ============================================================================

/**
 * 知识点：格式化 Zod 错误信息
 */
function formatZodError(error: z.ZodError): Record<string, string[]> {
  return error.flatten().fieldErrors as Record<string, string[]>;
}

/**
 * 知识点：通用的校验辅助函数
 */
function validateInput<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: Record<string, string[]> } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    errors: formatZodError(result.error),
  };
}

// ============================================================================
// 主函数：运行示例
// ============================================================================

async function main(): Promise<void> {
  console.log('========================================');
  console.log('Zod 校验教学示例');
  console.log('========================================');

  // 1. 基础校验 - 成功
  console.log('\n--- 1. 基础校验（成功）---');
  const validInput = {
    title: '测试对话',
    modelId: 'claude-sonnet-4',
  };
  const result1 = createConversationSchema.safeParse(validInput);
  console.log('输入:', validInput);
  console.log('校验结果:', result1.success);
  if (result1.success) {
    console.log('解析后数据:', result1.data);
    console.log('searchEnabled 默认值:', result1.data.searchEnabled);
  }

  // 2. 基础校验 - 失败
  console.log('\n--- 2. 基础校验（失败）---');
  const invalidInput = {
    title: '', // 空标题
    // modelId 缺失
  };
  const result2 = createConversationSchema.safeParse(invalidInput);
  console.log('输入:', invalidInput);
  console.log('校验结果:', result2.success);
  if (!result2.success) {
    console.log('错误信息:', formatZodError(result2.error));
  }

  // 3. 消息校验
  console.log('\n--- 3. 消息内容校验 ---');
  const validMessage = {
    conversationId: '550e8400-e29b-41d4-a716-446655440000',
    role: 'user',
    content: [{ type: 'text', text: '你好' }],
  };
  const result3 = createMessageSchema.safeParse(validMessage);
  console.log('输入:', JSON.stringify(validMessage));
  console.log('校验结果:', result3.success);

  // 4. 无效的消息
  console.log('\n--- 4. 无效的消息 ---');
  const invalidMessage = {
    conversationId: 'not-a-uuid', // 无效 UUID
    role: 'invalid-role', // 无效角色
    content: [], // 空内容
  };
  const result4 = createMessageSchema.safeParse(invalidMessage);
  console.log('输入:', JSON.stringify(invalidMessage));
  console.log('校验结果:', result4.success);
  if (!result4.success) {
    console.log('错误信息:', formatZodError(result4.error));
  }

  // 5. 分页参数校验
  console.log('\n--- 5. 分页参数校验（带类型转换）---');
  const paginationInput = {
    page: '2',
    limit: '50',
  };
  const result5 = paginationSchema.safeParse(paginationInput);
  console.log('输入:', paginationInput);
  console.log('校验结果:', result5.success);
  if (result5.success) {
    console.log('解析后数据:', result5.data);
    console.log('page 类型:', typeof result5.data.page); // number
  }

  // 6. 使用通用校验函数
  console.log('\n--- 6. 通用校验函数 ---');
  const validation = validateInput(createConversationSchema, {
    title: '有效的标题',
    modelId: 'gpt-4',
    searchEnabled: true,
  });
  console.log('校验结果:', validation);

  // 7. parse vs safeParse
  console.log('\n--- 7. parse vs safeParse ---');
  console.log('safeParse: 返回 { success, data/error }，不抛异常');
  console.log('parse: 校验失败时抛出 ZodError，需要 try-catch');

  try {
    createConversationSchema.parse({ title: '' }); // 会抛出异常
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.log('捕获到 ZodError:', error.errors[0].message);
    }
  }

  console.log('\n========================================');
  console.log('Zod 校验示例执行完成！');
  console.log('========================================');
}

main();
