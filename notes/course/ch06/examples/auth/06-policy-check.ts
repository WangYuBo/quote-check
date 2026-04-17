/**
 * 06-policy-check.ts - 完整策略检查示例
 *
 * 本示例演示如何：
 * 1. 综合检查用户是否有权操作某资源
 * 2. 结合角色检查 + 资源所有权检查
 * 3. 实际业务场景示例
 * 4. 策略检查的最佳实践
 *
 * 运行：bunx tsx src/examples/auth/06-policy-check.ts
 */

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 用户角色
 */
type UserRole = 'member' | 'group_admin' | 'system_admin';

/**
 * 权限类型
 */
type Permission = 'read' | 'write' | 'delete' | 'admin';

/**
 * 资源类型
 */
type ResourceType = 'conversation' | 'message' | 'api_key' | 'group' | 'template';

/**
 * 策略检查结果
 */
interface PolicyResult {
  allowed: boolean;
  reason?: string;
}

/**
 * 用户信息
 */
interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

/**
 * 对话资源
 */
interface Conversation {
  id: string;
  userId: string; // 所有者
  title: string;
  groupId?: string; // 所属分组（可选）
}

/**
 * 分组成员关系
 */
interface UserGroup {
  userId: string;
  groupId: string;
  role: UserRole;
}

// ============================================================================
// 模拟数据
// ============================================================================

/**
 * 模拟用户数据
 */
const mockUsers: Map<string, User> = new Map([
  [
    'user_alice_456',
    {
      id: 'user_alice_456',
      email: 'alice@example.com',
      name: 'Alice',
      role: 'member',
    },
  ],
  [
    'user_bob_789',
    {
      id: 'user_bob_789',
      email: 'bob@example.com',
      name: 'Bob',
      role: 'group_admin',
    },
  ],
  [
    'user_admin_000',
    {
      id: 'user_admin_000',
      email: 'admin@example.com',
      name: 'Admin',
      role: 'system_admin',
    },
  ],
]);

/**
 * 模拟对话数据
 */
const mockConversations: Map<string, Conversation> = new Map([
  [
    'conv_1',
    {
      id: 'conv_1',
      userId: 'user_alice_456',
      title: 'Alice 的对话',
    },
  ],
  [
    'conv_2',
    {
      id: 'conv_2',
      userId: 'user_bob_789',
      title: 'Bob 的对话',
      groupId: 'group_1',
    },
  ],
  [
    'conv_3',
    {
      id: 'conv_3',
      userId: 'user_alice_456',
      title: '分组对话',
      groupId: 'group_1',
    },
  ],
]);

/**
 * 模拟分组成员关系
 */
const mockUserGroups: UserGroup[] = [
  { userId: 'user_alice_456', groupId: 'group_1', role: 'member' },
  { userId: 'user_bob_789', groupId: 'group_1', role: 'group_admin' },
];

/**
 * 权限规则
 */
const PERMISSION_RULES: Record<UserRole, Record<ResourceType, Permission[]>> = {
  member: {
    conversation: ['read', 'write', 'delete'],
    message: ['read', 'write', 'delete'],
    api_key: ['read', 'write', 'delete'],
    group: ['read'],
    template: ['read', 'write', 'delete'],
  },
  group_admin: {
    conversation: ['read', 'write', 'delete'],
    message: ['read', 'write', 'delete'],
    api_key: ['read', 'write', 'delete', 'admin'],
    group: ['read', 'write', 'admin'],
    template: ['read', 'write', 'delete'],
  },
  system_admin: {
    conversation: ['read', 'write', 'delete', 'admin'],
    message: ['read', 'write', 'delete', 'admin'],
    api_key: ['read', 'write', 'delete', 'admin'],
    group: ['read', 'write', 'delete', 'admin'],
    template: ['read', 'write', 'delete', 'admin'],
  },
};

// ============================================================================
// 基础权限检查
// ============================================================================

/**
 * 检查角色是否有权限
 */
function hasPermission(role: UserRole, resource: ResourceType, permission: Permission): boolean {
  const resourcePermissions = PERMISSION_RULES[role][resource];
  return resourcePermissions?.includes(permission) ?? false;
}

/**
 * 检查用户是否是资源所有者
 */
function isOwner(userId: string, resource: { userId: string }): boolean {
  return userId === resource.userId;
}

/**
 * 检查用户是否是分组成员
 */
function isGroupMember(userId: string, groupId: string): boolean {
  return mockUserGroups.some((ug) => ug.userId === userId && ug.groupId === groupId);
}

/**
 * 获取用户在分组中的角色
 */
function getUserGroupRole(userId: string, groupId: string): UserRole | null {
  const userGroup = mockUserGroups.find((ug) => ug.userId === userId && ug.groupId === groupId);
  return userGroup?.role ?? null;
}

// ============================================================================
// 策略检查函数
// ============================================================================

/**
 * 完整的策略检查：检查用户是否有权对资源执行操作
 *
 * @param userId - 用户 ID
 * @param resource - 资源对象
 * @param resourceType - 资源类型
 * @param permission - 权限类型
 * @returns 策略检查结果
 */
function checkPolicy(
  userId: string,
  resource: { id: string; userId: string; groupId?: string },
  resourceType: ResourceType,
  permission: Permission
): PolicyResult {
  // 1. 获取用户信息
  const user = mockUsers.get(userId);
  if (!user) {
    return { allowed: false, reason: 'User not found' };
  }

  // 2. 系统管理员拥有所有权限
  if (user.role === 'system_admin') {
    return { allowed: true, reason: 'System admin has all permissions' };
  }

  // 3. 检查角色是否有该权限
  if (!hasPermission(user.role, resourceType, permission)) {
    return {
      allowed: false,
      reason: `Role ${user.role} does not have ${permission} permission on ${resourceType}`,
    };
  }

  // 4. 检查资源所有权
  if (isOwner(userId, resource)) {
    return { allowed: true, reason: 'User is the owner' };
  }

  // 5. 检查分组权限（如果资源属于分组）
  if (resource.groupId) {
    const groupRole = getUserGroupRole(userId, resource.groupId);

    if (!groupRole) {
      return { allowed: false, reason: 'User is not a member of the group' };
    }

    // 分组管理员可以管理分组资源
    if (groupRole === 'group_admin') {
      return { allowed: true, reason: 'User is group admin' };
    }

    // 普通成员只能读取分组资源
    if (permission === 'read') {
      return { allowed: true, reason: 'User can read group resources' };
    }

    return {
      allowed: false,
      reason: 'User does not have permission on group resource',
    };
  }

  // 6. 不是所有者，也不是分组资源
  return { allowed: false, reason: 'User does not own the resource' };
}

/**
 * 简化的策略检查包装器
 *
 * @param userId - 用户 ID
 * @param conversationId - 对话 ID
 * @param permission - 权限类型
 * @returns 是否允许
 */
function canAccessConversation(
  userId: string,
  conversationId: string,
  permission: Permission
): PolicyResult {
  const conversation = mockConversations.get(conversationId);

  if (!conversation) {
    return { allowed: false, reason: 'Conversation not found' };
  }

  return checkPolicy(userId, conversation, 'conversation', permission);
}

// ============================================================================
// 使用示例
// ============================================================================

/**
 * 示例 1：基础策略检查
 */
function example1_basicPolicy() {
  console.log('\n========== 示例 1：基础策略检查 ==========\n');

  const testCases = [
    {
      desc: 'Alice 读取自己的对话',
      userId: 'user_alice_456',
      conversationId: 'conv_1',
      permission: 'read' as Permission,
    },
    {
      desc: 'Alice 删除自己的对话',
      userId: 'user_alice_456',
      conversationId: 'conv_1',
      permission: 'delete' as Permission,
    },
    {
      desc: 'Alice 读取 Bob 的对话',
      userId: 'user_alice_456',
      conversationId: 'conv_2',
      permission: 'read' as Permission,
    },
    {
      desc: 'Alice 删除 Bob 的对话',
      userId: 'user_alice_456',
      conversationId: 'conv_2',
      permission: 'delete' as Permission,
    },
  ];

  for (const test of testCases) {
    const result = canAccessConversation(test.userId, test.conversationId, test.permission);
    const icon = result.allowed ? '✅' : '❌';
    console.log(`${icon} ${test.desc}`);
    console.log(`   结果: ${result.allowed ? '允许' : '拒绝'}`);
    console.log(`   原因: ${result.reason}`);
    console.log('');
  }
}

/**
 * 示例 2：分组权限检查
 */
function example2_groupPolicy() {
  console.log('\n========== 示例 2：分组权限检查 ==========\n');

  const testCases = [
    {
      desc: 'Alice 读取分组对话（自己创建的）',
      userId: 'user_alice_456',
      conversationId: 'conv_3',
      permission: 'read' as Permission,
    },
    {
      desc: 'Alice 删除分组对话（自己创建的）',
      userId: 'user_alice_456',
      conversationId: 'conv_3',
      permission: 'delete' as Permission,
    },
    {
      desc: 'Bob（分组管理员）读取分组对话',
      userId: 'user_bob_789',
      conversationId: 'conv_3',
      permission: 'read' as Permission,
    },
    {
      desc: 'Bob（分组管理员）删除分组对话',
      userId: 'user_bob_789',
      conversationId: 'conv_3',
      permission: 'delete' as Permission,
    },
  ];

  for (const test of testCases) {
    const result = canAccessConversation(test.userId, test.conversationId, test.permission);
    const icon = result.allowed ? '✅' : '❌';
    console.log(`${icon} ${test.desc}`);
    console.log(`   结果: ${result.allowed ? '允许' : '拒绝'}`);
    console.log(`   原因: ${result.reason}`);
    console.log('');
  }
}

/**
 * 示例 3：系统管理员权限
 */
function example3_adminPolicy() {
  console.log('\n========== 示例 3：系统管理员权限 ==========\n');

  const conversations = ['conv_1', 'conv_2', 'conv_3'];
  const permissions: Permission[] = ['read', 'write', 'delete', 'admin'];

  console.log('Admin 对所有对话的权限:\n');

  for (const convId of conversations) {
    const conv = mockConversations.get(convId);
    console.log(`📄 ${conv?.title} (${convId}):`);

    for (const perm of permissions) {
      const result = canAccessConversation('user_admin_000', convId, perm);
      const icon = result.allowed ? '✅' : '❌';
      console.log(`   ${icon} ${perm}: ${result.allowed ? '允许' : '拒绝'}`);
    }
    console.log('');
  }
}

/**
 * 示例 4：实际业务场景
 */
function example4_realScenarios() {
  console.log('\n========== 示例 4：实际业务场景 ==========\n');

  // 场景 1：删除对话
  console.log('场景 1: Alice 尝试删除对话\n');

  function deleteConversation(userId: string, conversationId: string): void {
    console.log(`🗑️  删除对话: ${conversationId}`);

    const result = canAccessConversation(userId, conversationId, 'delete');

    if (!result.allowed) {
      console.log(`❌ 删除失败: ${result.reason}\n`);
      return;
    }

    console.log(`✅ 删除成功: ${result.reason}`);
    mockConversations.delete(conversationId);
    console.log('');
  }

  deleteConversation('user_alice_456', 'conv_1'); // 成功：自己的对话
  deleteConversation('user_alice_456', 'conv_2'); // 失败：不是所有者

  // 场景 2：查看对话列表
  console.log('场景 2: Bob 查看可访问的对话列表\n');

  function getAccessibleConversations(userId: string): Conversation[] {
    const accessible: Conversation[] = [];

    for (const [id, conv] of mockConversations.entries()) {
      const result = canAccessConversation(userId, id, 'read');
      if (result.allowed) {
        accessible.push(conv);
      }
    }

    return accessible;
  }

  const bobConversations = getAccessibleConversations('user_bob_789');
  console.log(`📋 Bob 可以访问 ${bobConversations.length} 个对话:`);
  bobConversations.forEach((conv) => {
    console.log(`   • ${conv.title} (${conv.id})`);
  });
  console.log('');

  // 场景 3：分组管理
  console.log('场景 3: Bob（分组管理员）管理分组对话\n');

  function manageGroupConversation(userId: string, conversationId: string): void {
    const result = canAccessConversation(userId, conversationId, 'admin');

    if (!result.allowed) {
      console.log(`❌ 管理失败: ${result.reason}`);
      return;
    }

    console.log(`✅ 可以管理: ${result.reason}`);
  }

  manageGroupConversation('user_bob_789', 'conv_2'); // Bob 自己的对话
  manageGroupConversation('user_bob_789', 'conv_3'); // 分组对话（Bob 是管理员）
  console.log('');
}

/**
 * 示例 5：批量操作权限检查
 */
function example5_batchOperations() {
  console.log('\n========== 示例 5：批量操作权限检查 ==========\n');

  /**
   * 批量删除对话（只删除有权限的）
   */
  function batchDeleteConversations(
    userId: string,
    conversationIds: string[]
  ): {
    success: string[];
    failed: { id: string; reason: string }[];
  } {
    const success: string[] = [];
    const failed: { id: string; reason: string }[] = [];

    for (const id of conversationIds) {
      const result = canAccessConversation(userId, id, 'delete');

      if (result.allowed) {
        success.push(id);
        mockConversations.delete(id);
      } else {
        failed.push({ id, reason: result.reason || 'Unknown error' });
      }
    }

    return { success, failed };
  }

  // Alice 尝试批量删除
  const result = batchDeleteConversations('user_alice_456', ['conv_1', 'conv_2', 'conv_3']);

  console.log('📊 批量删除结果:\n');
  console.log(`✅ 成功删除 ${result.success.length} 个对话:`);
  result.success.forEach((id) => console.log(`   • ${id}`));

  console.log(`\n❌ 删除失败 ${result.failed.length} 个对话:`);
  result.failed.forEach(({ id, reason }) => console.log(`   • ${id}: ${reason}`));
  console.log('');
}

// ============================================================================
// 真实应用示例
// ============================================================================

/**
 * 真实应用中的策略检查
 */
function realWorldExample() {
  console.log('\n========== 真实应用中的策略检查 ==========\n');

  console.log(`
在真实的应用中，策略检查是这样实现的：

1. 定义策略检查函数（src/lib/auth/policy.ts）：

   import { db } from '@/db';
   import { conversations, userGroups, userProfiles } from '@/db/schema';
   import { eq, and } from 'drizzle-orm';

   export async function checkConversationPolicy(
     userId: string,
     conversationId: string,
     permission: Permission
   ): Promise<PolicyResult> {
     // 1. 获取用户角色
     const userProfile = await db.query.userProfiles.findFirst({
       where: eq(userProfiles.userId, userId),
     });

     if (!userProfile) {
       return { allowed: false, reason: 'User not found' };
     }

     // 2. 系统管理员拥有所有权限
     if (userProfile.role === 'system_admin') {
       return { allowed: true, reason: 'System admin' };
     }

     // 3. 检查角色是否有该权限
     if (!hasPermission(userProfile.role, 'conversation', permission)) {
       return { allowed: false, reason: 'No permission' };
     }

     // 4. 获取对话信息
     const conversation = await db.query.conversations.findFirst({
       where: eq(conversations.id, conversationId),
     });

     if (!conversation) {
       return { allowed: false, reason: 'Conversation not found' };
     }

     // 5. 检查所有权
     if (conversation.userId === userId) {
       return { allowed: true, reason: 'Owner' };
     }

     // 6. 检查分组权限（如果对话属于分组）
     if (conversation.groupId) {
       const userGroup = await db.query.userGroups.findFirst({
         where: and(
           eq(userGroups.userId, userId),
           eq(userGroups.groupId, conversation.groupId)
         ),
       });

       if (!userGroup) {
         return { allowed: false, reason: 'Not group member' };
       }

       // 分组管理员可以管理分组对话
       if (userGroup.role === 'group_admin') {
         return { allowed: true, reason: 'Group admin' };
       }

       // 普通成员只能读取
       if (permission === 'read') {
         return { allowed: true, reason: 'Group member' };
       }

       return { allowed: false, reason: 'No permission on group resource' };
     }

     return { allowed: false, reason: 'Not owner' };
   }

2. 在 Server Action 中使用：

   'use server';

   import { neonAuth } from '@neondatabase/neon-js/auth/next';
   import { checkConversationPolicy } from '@/lib/auth/policy';

   export async function deleteConversation(conversationId: string) {
     const { session, user } = await neonAuth();
     if (!session || !user) {
       throw new Error('Unauthorized');
     }

     const result = await checkConversationPolicy(
       user.id,
       conversationId,
       'delete'
     );

     if (!result.allowed) {
       throw new Error(\`Forbidden: \${result.reason}\`);
     }

     await db.delete(conversations).where(eq(conversations.id, conversationId));

     // 记录操作日志
     await db.insert(operationLogs).values({
       operatorId: user.id,
       operationType: 'delete',
       resourceType: 'conversation',
       resourceId: conversationId,
     });

     return { success: true };
   }

3. 在 API 路由中使用：

   import { neonAuth } from '@neondatabase/neon-js/auth/next';
   import { checkConversationPolicy } from '@/lib/auth/policy';

   export async function DELETE(
     request: Request,
     { params }: { params: { id: string } }
   ) {
     const { session, user } = await neonAuth();
     if (!session || !user) {
       return Response.json({ error: 'Unauthorized' }, { status: 401 });
     }

     const result = await checkConversationPolicy(
       user.id,
       params.id,
       'delete'
     );

     if (!result.allowed) {
       return Response.json(
         { error: 'Forbidden', reason: result.reason },
         { status: 403 }
       );
     }

     await db.delete(conversations).where(eq(conversations.id, params.id));

     return Response.json({ success: true });
   }

4. 使用策略守卫装饰器：

   function withPolicy<T extends unknown[], R>(
     resourceType: ResourceType,
     permission: Permission,
     getResourceId: (...args: T) => string,
     handler: (userId: string, ...args: T) => Promise<R>
   ) {
     return async (userId: string, ...args: T): Promise<R> => {
       const resourceId = getResourceId(...args);

       const result = await checkConversationPolicy(
         userId,
         resourceId,
         permission
       );

       if (!result.allowed) {
         throw new Error(\`Forbidden: \${result.reason}\`);
       }

       return handler(userId, ...args);
     };
   }

   // 使用
   const deleteConversationWithPolicy = withPolicy(
     'conversation',
     'delete',
     (conversationId) => conversationId,
     async (userId, conversationId) => {
       await db.delete(conversations).where(eq(conversations.id, conversationId));
     }
   );
  `);
}

// ============================================================================
// 主函数
// ============================================================================

function main() {
  console.log('🛡️  完整策略检查示例\n');
  console.log('═'.repeat(60));

  example1_basicPolicy();
  example2_groupPolicy();
  example3_adminPolicy();
  example4_realScenarios();
  example5_batchOperations();
  realWorldExample();

  console.log('\n' + '═'.repeat(60));
  console.log('\n✅ 所有示例运行完成！\n');
  console.log('💡 关键要点：');
  console.log('   1. 策略检查 = 认证 + 角色权限 + 资源所有权');
  console.log('   2. 系统管理员拥有所有权限，跳过所有权检查');
  console.log('   3. 分组管理员可以管理分组资源');
  console.log('   4. 普通成员只能管理自己的资源');
  console.log('   5. 策略检查应该在服务端执行，返回详细的拒绝原因');
  console.log('   6. 批量操作需要对每个资源单独检查权限');
  console.log('');
}

// 运行主函数
main();
