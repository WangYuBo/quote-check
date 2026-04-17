/**
 * 05-permissions.ts - RBAC 权限检查
 *
 * 本示例演示如何：
 * 1. 定义权限（read、write、delete、admin）
 * 2. 定义资源（conversation、message、api_key、group 等）
 * 3. 建立角色-权限映射
 * 4. 检查用户是否有权执行某操作
 *
 * 运行：bunx tsx src/examples/auth/05-permissions.ts
 */

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 用户角色（来自 schema.ts）
 */
type UserRole = 'member' | 'group_admin' | 'system_admin';

/**
 * 权限类型
 */
type Permission = 'read' | 'write' | 'delete' | 'admin';

/**
 * 资源类型（来自 schema.ts 的 resourceTypeEnum）
 */
type ResourceType =
  | 'api_key'
  | 'user'
  | 'conversation'
  | 'message'
  | 'group'
  | 'template'
  | 'config';

/**
 * 权限规则：角色 → 资源 → 权限集合
 */
type PermissionRules = {
  [role in UserRole]: {
    [resource in ResourceType]?: Permission[];
  };
};

// ============================================================================
// 权限规则定义
// ============================================================================

/**
 * RBAC 权限规则
 *
 * 定义每个角色对每种资源拥有的权限
 */
const PERMISSION_RULES: PermissionRules = {
  /**
   * 普通成员（member）
   * - 可以管理自己的资源
   * - 可以读取所属分组的共享资源
   */
  member: {
    conversation: ['read', 'write', 'delete'], // 自己的对话
    message: ['read', 'write', 'delete'], // 自己对话的消息
    api_key: ['read', 'write', 'delete'], // 自己的 API 密钥
    group: ['read'], // 所属的分组（只读）
    template: ['read', 'write', 'delete'], // 自己的模板
    config: ['read'], // 系统配置（只读）
  },

  /**
   * 分组管理员（group_admin）
   * - 可以管理所属分组的资源
   * - 可以管理分组成员
   */
  group_admin: {
    conversation: ['read', 'write', 'delete'], // 分组内的对话
    message: ['read', 'write', 'delete'], // 分组对话的消息
    api_key: ['read', 'write', 'delete', 'admin'], // 分组的 API 密钥
    group: ['read', 'write', 'admin'], // 管理的分组
    template: ['read', 'write', 'delete'], // 分组的模板
    config: ['read'], // 系统配置（只读）
    user: ['read'], // 分组成员（只读）
  },

  /**
   * 系统管理员（system_admin）
   * - 拥有所有权限
   */
  system_admin: {
    conversation: ['read', 'write', 'delete', 'admin'],
    message: ['read', 'write', 'delete', 'admin'],
    api_key: ['read', 'write', 'delete', 'admin'],
    group: ['read', 'write', 'delete', 'admin'],
    template: ['read', 'write', 'delete', 'admin'],
    config: ['read', 'write', 'admin'],
    user: ['read', 'write', 'delete', 'admin'],
  },
};

/**
 * 权限显示名称
 */
const PERMISSION_NAMES: Record<Permission, string> = {
  read: '读取',
  write: '写入',
  delete: '删除',
  admin: '管理',
};

/**
 * 资源显示名称
 */
const RESOURCE_NAMES: Record<ResourceType, string> = {
  api_key: 'API 密钥',
  user: '用户',
  conversation: '对话',
  message: '消息',
  group: '分组',
  template: '提示词模板',
  config: '系统配置',
};

// ============================================================================
// 权限检查函数
// ============================================================================

/**
 * 检查角色是否有权限执行某操作
 *
 * @param role - 用户角色
 * @param resource - 资源类型
 * @param permission - 权限类型
 * @returns 是否有权限
 */
function hasPermission(role: UserRole, resource: ResourceType, permission: Permission): boolean {
  const rolePermissions = PERMISSION_RULES[role];
  const resourcePermissions = rolePermissions[resource];

  if (!resourcePermissions) {
    return false;
  }

  return resourcePermissions.includes(permission);
}

/**
 * 获取角色对某资源的所有权限
 *
 * @param role - 用户角色
 * @param resource - 资源类型
 * @returns 权限列表
 */
function getPermissions(role: UserRole, resource: ResourceType): Permission[] {
  const rolePermissions = PERMISSION_RULES[role];
  return rolePermissions[resource] || [];
}

/**
 * 获取角色的所有权限（所有资源）
 *
 * @param role - 用户角色
 * @returns 权限映射
 */
function getAllPermissions(role: UserRole): Record<string, Permission[]> {
  return PERMISSION_RULES[role];
}

/**
 * 检查角色是否可以执行操作（更友好的API）
 *
 * @param role - 用户角色
 * @param action - 操作描述
 * @returns 是否可以执行
 */
function can(
  role: UserRole,
  action: {
    resource: ResourceType;
    permission: Permission;
  }
): boolean {
  return hasPermission(role, action.resource, action.permission);
}

/**
 * 获取角色可以执行的所有操作
 *
 * @param role - 用户角色
 * @returns 操作列表
 */
function getAbilities(role: UserRole): string[] {
  const abilities: string[] = [];
  const permissions = PERMISSION_RULES[role];

  for (const [resource, perms] of Object.entries(permissions)) {
    for (const perm of perms) {
      abilities.push(
        `${PERMISSION_NAMES[perm as Permission]}${RESOURCE_NAMES[resource as ResourceType]}`
      );
    }
  }

  return abilities;
}

// ============================================================================
// 使用示例
// ============================================================================

/**
 * 示例 1：基本权限检查
 */
function example1_basicPermission() {
  console.log('\n========== 示例 1：基本权限检查 ==========\n');

  const testCases: {
    role: UserRole;
    resource: ResourceType;
    permission: Permission;
    expected: boolean;
  }[] = [
    { role: 'member', resource: 'conversation', permission: 'read', expected: true },
    { role: 'member', resource: 'conversation', permission: 'write', expected: true },
    { role: 'member', resource: 'conversation', permission: 'delete', expected: true },
    { role: 'member', resource: 'conversation', permission: 'admin', expected: false },
    { role: 'member', resource: 'group', permission: 'write', expected: false },
    { role: 'group_admin', resource: 'group', permission: 'admin', expected: true },
    { role: 'system_admin', resource: 'user', permission: 'admin', expected: true },
  ];

  for (const test of testCases) {
    const result = hasPermission(test.role, test.resource, test.permission);
    const icon = result === test.expected ? '✅' : '❌';
    const roleName = test.role === 'member' ? '普通成员' : test.role === 'group_admin' ? '分组管理员' : '系统管理员';

    console.log(
      `${icon} ${roleName} ${result ? '可以' : '不能'} ${PERMISSION_NAMES[test.permission]}${RESOURCE_NAMES[test.resource]}`
    );
  }
}

/**
 * 示例 2：查询角色对资源的所有权限
 */
function example2_getPermissions() {
  console.log('\n========== 示例 2：查询角色对资源的所有权限 ==========\n');

  const roles: UserRole[] = ['member', 'group_admin', 'system_admin'];
  const resources: ResourceType[] = ['conversation', 'group', 'api_key'];

  for (const role of roles) {
    const roleName = role === 'member' ? '普通成员' : role === 'group_admin' ? '分组管理员' : '系统管理员';
    console.log(`🎭 ${roleName} (${role}):`);

    for (const resource of resources) {
      const perms = getPermissions(role, resource);
      const permNames = perms.map((p) => PERMISSION_NAMES[p]).join('、');
      console.log(`   • ${RESOURCE_NAMES[resource]}: ${permNames || '无权限'}`);
    }
    console.log('');
  }
}

/**
 * 示例 3：使用 can() API
 */
function example3_canAPI() {
  console.log('\n========== 示例 3：使用 can() API ==========\n');

  // 模拟用户角色
  const alice: { role: UserRole; name: string } = { role: 'member', name: 'Alice' };
  const bob: { role: UserRole; name: string } = { role: 'group_admin', name: 'Bob' };
  const admin: { role: UserRole; name: string } = { role: 'system_admin', name: 'Admin' };

  // 测试场景
  console.log('场景 1: 删除对话');
  console.log(
    `  ${alice.name} (普通成员): ${can(alice.role, { resource: 'conversation', permission: 'delete' }) ? '✅ 可以' : '❌ 不能'}`
  );
  console.log(
    `  ${bob.name} (分组管理员): ${can(bob.role, { resource: 'conversation', permission: 'delete' }) ? '✅ 可以' : '❌ 不能'}`
  );
  console.log(
    `  ${admin.name} (系统管理员): ${can(admin.role, { resource: 'conversation', permission: 'delete' }) ? '✅ 可以' : '❌ 不能'}`
  );

  console.log('\n场景 2: 管理分组');
  console.log(
    `  ${alice.name} (普通成员): ${can(alice.role, { resource: 'group', permission: 'admin' }) ? '✅ 可以' : '❌ 不能'}`
  );
  console.log(
    `  ${bob.name} (分组管理员): ${can(bob.role, { resource: 'group', permission: 'admin' }) ? '✅ 可以' : '❌ 不能'}`
  );
  console.log(
    `  ${admin.name} (系统管理员): ${can(admin.role, { resource: 'group', permission: 'admin' }) ? '✅ 可以' : '❌ 不能'}`
  );

  console.log('\n场景 3: 修改系统配置');
  console.log(
    `  ${alice.name} (普通成员): ${can(alice.role, { resource: 'config', permission: 'write' }) ? '✅ 可以' : '❌ 不能'}`
  );
  console.log(
    `  ${bob.name} (分组管理员): ${can(bob.role, { resource: 'config', permission: 'write' }) ? '✅ 可以' : '❌ 不能'}`
  );
  console.log(
    `  ${admin.name} (系统管理员): ${can(admin.role, { resource: 'config', permission: 'write' }) ? '✅ 可以' : '❌ 不能'}`
  );
}

/**
 * 示例 4：列出角色的所有能力
 */
function example4_listAbilities() {
  console.log('\n========== 示例 4：列出角色的所有能力 ==========\n');

  const roles: UserRole[] = ['member', 'group_admin', 'system_admin'];

  for (const role of roles) {
    const roleName = role === 'member' ? '普通成员' : role === 'group_admin' ? '分组管理员' : '系统管理员';
    const abilities = getAbilities(role);

    console.log(`🎭 ${roleName} (${role}) 可以:`);
    abilities.forEach((ability, index) => {
      console.log(`   ${index + 1}. ${ability}`);
    });
    console.log('');
  }
}

/**
 * 示例 5：权限矩阵
 */
function example5_permissionMatrix() {
  console.log('\n========== 示例 5：权限矩阵 ==========\n');

  const roles: UserRole[] = ['member', 'group_admin', 'system_admin'];
  const resources: ResourceType[] = [
    'conversation',
    'message',
    'api_key',
    'group',
    'template',
    'config',
  ];
  const permissions: Permission[] = ['read', 'write', 'delete', 'admin'];

  // 表头
  console.log('资源类型'.padEnd(20) + roles.map((r) => r.padEnd(18)).join(''));
  console.log('-'.repeat(74));

  // 每个资源
  for (const resource of resources) {
    console.log(`\n${RESOURCE_NAMES[resource]}:`);

    for (const permission of permissions) {
      const row =
        `  ${PERMISSION_NAMES[permission]}`.padEnd(20) +
        roles
          .map((role) => {
            const has = hasPermission(role, resource, permission);
            return (has ? '✅' : '❌').padEnd(18);
          })
          .join('');

      console.log(row);
    }
  }
}

// ============================================================================
// 真实应用示例
// ============================================================================

/**
 * 真实应用中的权限检查
 */
function realWorldExample() {
  console.log('\n========== 真实应用中的权限检查 ==========\n');

  console.log(`
在真实的应用中，权限检查结合角色和资源所有权：

1. 定义权限检查函数（src/lib/auth/permissions.ts）：

   import { getUserRole } from './roles';

   export async function checkPermission(
     userId: string,
     resource: ResourceType,
     permission: Permission
   ): Promise<boolean> {
     const role = await getUserRole(userId);
     return hasPermission(role, resource, permission);
   }

2. 在 Server Action 中使用：

   'use server';

   import { neonAuth } from '@neondatabase/neon-js/auth/next';
   import { checkPermission } from '@/lib/auth/permissions';

   export async function deleteConversation(conversationId: string) {
     const { session, user } = await neonAuth();
     if (!session || !user) {
       throw new Error('Unauthorized');
     }

     // 检查是否有删除权限
     const canDelete = await checkPermission(
       user.id,
       'conversation',
       'delete'
     );

     if (!canDelete) {
       throw new Error('Forbidden: No permission to delete');
     }

     // 检查资源所有权（除非是系统管理员）
     const role = await getUserRole(user.id);
     if (role !== 'system_admin') {
       const conversation = await db.query.conversations.findFirst({
         where: eq(conversations.id, conversationId),
       });

       if (conversation?.userId !== user.id) {
         throw new Error('Forbidden: Not the owner');
       }
     }

     // 执行删除
     await db.delete(conversations).where(eq(conversations.id, conversationId));
   }

3. 在 API 路由中使用：

   import { neonAuth } from '@neondatabase/neon-js/auth/next';
   import { checkPermission } from '@/lib/auth/permissions';

   export async function POST(request: Request) {
     const { session, user } = await neonAuth();
     if (!session || !user) {
       return Response.json({ error: 'Unauthorized' }, { status: 401 });
     }

     // 检查是否有写入权限
     const canWrite = await checkPermission(
       user.id,
       'conversation',
       'write'
     );

     if (!canWrite) {
       return Response.json({ error: 'Forbidden' }, { status: 403 });
     }

     // 创建对话
     const { title } = await request.json();
     const conversation = await db.insert(conversations).values({
       userId: user.id,
       title,
     });

     return Response.json({ conversation });
   }

4. 在客户端组件中使用（权限检查应在服务端）：

   'use client';

   import { createAuthClient } from '@neondatabase/neon-js/auth/next';
   import { useState, useEffect } from 'react';

   const authClient = createAuthClient();

   export function ConversationActions({ conversationId }: { conversationId: string }) {
     const [user, setUser] = useState(null);

     useEffect(() => {
       authClient.getSession().then((result) => {
         if (result.data?.user) {
           setUser(result.data.user);
         }
       });
     }, []);

     // 注意：这里只是 UI 层面的隐藏，实际权限检查在服务端
     const canDelete = user?.role !== 'member';

     return (
       <div>
         {canDelete && (
           <button onClick={() => handleDelete(conversationId)}>
             删除对话
           </button>
         )}
       </div>
     );
   }

5. 使用权限守卫（Higher-Order Function）：

   export function withPermission<T extends unknown[], R>(
     resource: ResourceType,
     permission: Permission,
     handler: (userId: string, ...args: T) => Promise<R>
   ) {
     return async (userId: string, ...args: T): Promise<R> => {
       const canAccess = await checkPermission(userId, resource, permission);

       if (!canAccess) {
         throw new Error(\`Forbidden: No \${permission} permission on \${resource}\`);
       }

       return handler(userId, ...args);
     };
   }

   // 使用
   const deleteConversationWithPermission = withPermission(
     'conversation',
     'delete',
     async (userId, conversationId) => {
       // ... 删除逻辑
     }
   );
  `);
}

// ============================================================================
// 主函数
// ============================================================================

function main() {
  console.log('🔐 RBAC 权限检查示例\n');
  console.log('═'.repeat(60));

  example1_basicPermission();
  example2_getPermissions();
  example3_canAPI();
  example4_listAbilities();
  example5_permissionMatrix();
  realWorldExample();

  console.log('\n' + '═'.repeat(60));
  console.log('\n✅ 所有示例运行完成！\n');
  console.log('💡 关键要点：');
  console.log('   1. 权限定义为 read/write/delete/admin');
  console.log('   2. 资源定义为 conversation/message/api_key/group 等');
  console.log('   3. 角色-权限映射定义在 PERMISSION_RULES 中');
  console.log('   4. 系统管理员拥有所有权限');
  console.log('   5. 权限检查需要结合资源所有权验证');
  console.log('');
}

// 运行主函数
main();
