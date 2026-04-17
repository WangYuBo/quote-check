/**
 * 04-roles.ts - RBAC 角色定义和获取
 *
 * 本示例演示如何：
 * 1. 定义角色枚举（member、group_admin、system_admin）
 * 2. 获取用户角色
 * 3. 理解角色层级关系
 * 4. 角色继承机制
 *
 * 运行：bunx tsx src/examples/auth/04-roles.ts
 */

// ============================================================================
// 角色枚举定义（来自 schema.ts）
// ============================================================================

/**
 * 用户角色
 *
 * 这个枚举定义在 src/db/schema.ts 中：
 * export const userRoleEnum = pgEnum('user_role', ['member', 'group_admin', 'system_admin']);
 */
type UserRole = 'member' | 'group_admin' | 'system_admin';

/**
 * 角色显示名称
 */
const ROLE_NAMES: Record<UserRole, string> = {
  member: '普通成员',
  group_admin: '分组管理员',
  system_admin: '系统管理员',
};

/**
 * 角色描述
 */
const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  member: '可以管理自己的对话、消息和 API 密钥',
  group_admin: '可以管理所属分组的资源和成员',
  system_admin: '拥有所有权限，可以管理整个系统',
};

// ============================================================================
// 角色层级定义
// ============================================================================

/**
 * 角色层级（数字越大权限越高）
 */
const ROLE_HIERARCHY: Record<UserRole, number> = {
  member: 1,
  group_admin: 2,
  system_admin: 3,
};

/**
 * 检查角色 A 是否包含角色 B 的权限
 *
 * @param roleA - 角色 A
 * @param roleB - 角色 B
 * @returns 角色 A 是否包含角色 B
 */
function roleIncludes(roleA: UserRole, roleB: UserRole): boolean {
  return ROLE_HIERARCHY[roleA] >= ROLE_HIERARCHY[roleB];
}

/**
 * 获取角色的所有父角色（包含自己）
 *
 * @param role - 当前角色
 * @returns 角色数组（从低到高）
 */
function getRoleHierarchy(role: UserRole): UserRole[] {
  const level = ROLE_HIERARCHY[role];
  const roles: UserRole[] = [];

  for (const [r, l] of Object.entries(ROLE_HIERARCHY)) {
    if (l <= level) {
      roles.push(r as UserRole);
    }
  }

  // 按层级排序
  return roles.sort((a, b) => ROLE_HIERARCHY[a] - ROLE_HIERARCHY[b]);
}

// ============================================================================
// 模拟数据
// ============================================================================

/**
 * 用户扩展信息（来自 user_profiles 表）
 */
interface UserProfile {
  id: string;
  userId: string; // Neon Auth 用户 ID
  role: UserRole;
  preferences?: {
    defaultModel?: string;
    searchEnabled?: boolean;
    theme?: 'light' | 'dark' | 'system';
  };
}

/**
 * 分组成员关系（来自 user_groups 表）
 */
interface UserGroup {
  id: string;
  userId: string;
  groupId: string;
  role: UserRole; // 在分组中的角色
}

/**
 * 模拟用户数据
 */
const mockUserProfiles: Map<string, UserProfile> = new Map();
const mockUserGroups: Map<string, UserGroup[]> = new Map();

// 初始化测试数据
mockUserProfiles.set('user_alice_456', {
  id: 'profile_1',
  userId: 'user_alice_456',
  role: 'member', // Alice 是普通成员
});

mockUserProfiles.set('user_bob_789', {
  id: 'profile_2',
  userId: 'user_bob_789',
  role: 'group_admin', // Bob 是分组管理员
});

mockUserProfiles.set('user_admin_000', {
  id: 'profile_3',
  userId: 'user_admin_000',
  role: 'system_admin', // Admin 是系统管理员
});

// 分组成员关系
mockUserGroups.set('user_alice_456', [
  {
    id: 'ug_1',
    userId: 'user_alice_456',
    groupId: 'group_1',
    role: 'member', // Alice 在 group_1 中是普通成员
  },
]);

mockUserGroups.set('user_bob_789', [
  {
    id: 'ug_2',
    userId: 'user_bob_789',
    groupId: 'group_1',
    role: 'group_admin', // Bob 在 group_1 中是管理员
  },
  {
    id: 'ug_3',
    userId: 'user_bob_789',
    groupId: 'group_2',
    role: 'member', // Bob 在 group_2 中是普通成员
  },
]);

// ============================================================================
// 角色查询函数
// ============================================================================

/**
 * 获取用户的全局角色（来自 user_profiles 表）
 *
 * @param userId - 用户 ID
 * @returns 用户角色
 */
function getUserRole(userId: string): UserRole {
  const profile = mockUserProfiles.get(userId);
  return profile?.role || 'member'; // 默认为 member
}

/**
 * 获取用户在特定分组中的角色
 *
 * @param userId - 用户 ID
 * @param groupId - 分组 ID
 * @returns 用户在分组中的角色或 null
 */
function getUserRoleInGroup(userId: string, groupId: string): UserRole | null {
  const userGroups = mockUserGroups.get(userId) || [];
  const userGroup = userGroups.find((ug) => ug.groupId === groupId);
  return userGroup?.role || null;
}

/**
 * 获取用户的所有角色（全局 + 各分组）
 *
 * @param userId - 用户 ID
 * @returns 角色信息数组
 */
function getAllUserRoles(userId: string): {
  scope: 'global' | 'group';
  role: UserRole;
  groupId?: string;
}[] {
  const roles: { scope: 'global' | 'group'; role: UserRole; groupId?: string }[] = [];

  // 全局角色
  const globalRole = getUserRole(userId);
  roles.push({
    scope: 'global',
    role: globalRole,
  });

  // 分组角色
  const userGroups = mockUserGroups.get(userId) || [];
  for (const ug of userGroups) {
    roles.push({
      scope: 'group',
      role: ug.role,
      groupId: ug.groupId,
    });
  }

  return roles;
}

/**
 * 检查用户是否拥有某个角色（全局或分组）
 *
 * @param userId - 用户 ID
 * @param role - 角色
 * @param groupId - 分组 ID（可选）
 * @returns 是否拥有该角色
 */
function hasRole(userId: string, role: UserRole, groupId?: string): boolean {
  // 系统管理员拥有所有角色
  const globalRole = getUserRole(userId);
  if (globalRole === 'system_admin') {
    return true;
  }

  // 检查全局角色
  if (!groupId) {
    return roleIncludes(globalRole, role);
  }

  // 检查分组角色
  const groupRole = getUserRoleInGroup(userId, groupId);
  if (!groupRole) {
    return false;
  }

  return roleIncludes(groupRole, role);
}

// ============================================================================
// 使用示例
// ============================================================================

/**
 * 示例 1：查询用户角色
 */
function example1_getUserRole() {
  console.log('\n========== 示例 1：查询用户角色 ==========\n');

  const users = [
    { id: 'user_alice_456', name: 'Alice' },
    { id: 'user_bob_789', name: 'Bob' },
    { id: 'user_admin_000', name: 'Admin' },
  ];

  for (const user of users) {
    const role = getUserRole(user.id);
    console.log(`👤 ${user.name}:`);
    console.log(`   角色: ${ROLE_NAMES[role]} (${role})`);
    console.log(`   描述: ${ROLE_DESCRIPTIONS[role]}`);
    console.log('');
  }
}

/**
 * 示例 2：查询分组角色
 */
function example2_getGroupRole() {
  console.log('\n========== 示例 2：查询分组角色 ==========\n');

  const testCases = [
    { userId: 'user_alice_456', userName: 'Alice', groupId: 'group_1' },
    { userId: 'user_bob_789', userName: 'Bob', groupId: 'group_1' },
    { userId: 'user_bob_789', userName: 'Bob', groupId: 'group_2' },
    { userId: 'user_admin_000', userName: 'Admin', groupId: 'group_1' },
  ];

  for (const test of testCases) {
    const role = getUserRoleInGroup(test.userId, test.groupId);
    console.log(`👥 ${test.userName} 在 ${test.groupId} 中:`);
    if (role) {
      console.log(`   角色: ${ROLE_NAMES[role]} (${role})`);
    } else {
      console.log('   ❌ 不是该分组成员');
    }
    console.log('');
  }
}

/**
 * 示例 3：查询所有角色
 */
function example3_getAllRoles() {
  console.log('\n========== 示例 3：查询所有角色 ==========\n');

  const users = [
    { id: 'user_alice_456', name: 'Alice' },
    { id: 'user_bob_789', name: 'Bob' },
  ];

  for (const user of users) {
    const roles = getAllUserRoles(user.id);
    console.log(`👤 ${user.name} 的所有角色:`);

    for (const roleInfo of roles) {
      if (roleInfo.scope === 'global') {
        console.log(`   • 全局: ${ROLE_NAMES[roleInfo.role]}`);
      } else {
        console.log(`   • ${roleInfo.groupId}: ${ROLE_NAMES[roleInfo.role]}`);
      }
    }
    console.log('');
  }
}

/**
 * 示例 4：角色层级检查
 */
function example4_roleHierarchy() {
  console.log('\n========== 示例 4：角色层级检查 ==========\n');

  const roles: UserRole[] = ['member', 'group_admin', 'system_admin'];

  console.log('角色层级:');
  for (const role of roles) {
    console.log(`${ROLE_HIERARCHY[role]}. ${ROLE_NAMES[role]} (${role})`);
  }

  console.log('\n角色包含关系:');

  const testCases: [UserRole, UserRole, boolean][] = [
    ['system_admin', 'member', true], // 系统管理员包含普通成员的权限
    ['system_admin', 'group_admin', true], // 系统管理员包含分组管理员的权限
    ['group_admin', 'member', true], // 分组管理员包含普通成员的权限
    ['member', 'group_admin', false], // 普通成员不包含分组管理员的权限
    ['member', 'member', true], // 普通成员包含自己的权限
  ];

  for (const [roleA, roleB, expected] of testCases) {
    const result = roleIncludes(roleA, roleB);
    const icon = result === expected ? '✅' : '❌';
    console.log(
      `${icon} ${ROLE_NAMES[roleA]} ${result ? '包含' : '不包含'} ${ROLE_NAMES[roleB]} 的权限`
    );
  }

  console.log('\n角色继承链:');
  for (const role of roles) {
    const hierarchy = getRoleHierarchy(role);
    console.log(`${ROLE_NAMES[role]}: ${hierarchy.map((r) => ROLE_NAMES[r]).join(' → ')}`);
  }
}

/**
 * 示例 5：hasRole 检查
 */
function example5_hasRole() {
  console.log('\n========== 示例 5：hasRole 检查 ==========\n');

  const testCases = [
    {
      userId: 'user_alice_456',
      userName: 'Alice',
      role: 'member' as UserRole,
      description: 'Alice 是否是普通成员',
    },
    {
      userId: 'user_alice_456',
      userName: 'Alice',
      role: 'group_admin' as UserRole,
      description: 'Alice 是否是分组管理员',
    },
    {
      userId: 'user_bob_789',
      userName: 'Bob',
      role: 'group_admin' as UserRole,
      description: 'Bob 是否是分组管理员',
    },
    {
      userId: 'user_admin_000',
      userName: 'Admin',
      role: 'member' as UserRole,
      description: 'Admin 是否拥有普通成员权限（继承）',
    },
  ];

  for (const test of testCases) {
    const result = hasRole(test.userId, test.role);
    const icon = result ? '✅' : '❌';
    console.log(`${icon} ${test.description}: ${result ? '是' : '否'}`);
  }

  console.log('\n分组角色检查:');

  const groupTestCases = [
    {
      userId: 'user_alice_456',
      userName: 'Alice',
      groupId: 'group_1',
      role: 'member' as UserRole,
      description: 'Alice 在 group_1 中是否是成员',
    },
    {
      userId: 'user_bob_789',
      userName: 'Bob',
      groupId: 'group_1',
      role: 'group_admin' as UserRole,
      description: 'Bob 在 group_1 中是否是管理员',
    },
    {
      userId: 'user_bob_789',
      userName: 'Bob',
      groupId: 'group_2',
      role: 'group_admin' as UserRole,
      description: 'Bob 在 group_2 中是否是管理员',
    },
  ];

  for (const test of groupTestCases) {
    const result = hasRole(test.userId, test.role, test.groupId);
    const icon = result ? '✅' : '❌';
    console.log(`${icon} ${test.description}: ${result ? '是' : '否'}`);
  }
}

// ============================================================================
// 真实应用示例
// ============================================================================

/**
 * 真实应用中的角色查询
 */
function realWorldExample() {
  console.log('\n========== 真实应用中的角色查询 ==========\n');

  console.log(`
在真实的应用中，角色查询通过数据库：

1. 获取用户全局角色（src/lib/auth/roles.ts）：

   import { db } from '@/db';
   import { userProfiles } from '@/db/schema';
   import { eq } from 'drizzle-orm';

   export async function getUserRole(userId: string): Promise<UserRole> {
     const profile = await db.query.userProfiles.findFirst({
       where: eq(userProfiles.userId, userId),
     });

     return profile?.role || 'member';
   }

2. 获取用户在分组中的角色：

   import { userGroups } from '@/db/schema';
   import { and } from 'drizzle-orm';

   export async function getUserRoleInGroup(
     userId: string,
     groupId: string
   ): Promise<UserRole | null> {
     const userGroup = await db.query.userGroups.findFirst({
       where: and(
         eq(userGroups.userId, userId),
         eq(userGroups.groupId, groupId)
       ),
     });

     return userGroup?.role || null;
   }

3. 在 Server Action 中使用：

   'use server';

   import { neonAuth } from '@neondatabase/neon-js/auth/next';
   import { getUserRole } from '@/lib/auth/roles';

   export async function deleteConversation(conversationId: string) {
     const { session, user } = await neonAuth();
     if (!session || !user) {
       throw new Error('Unauthorized');
     }

     const role = await getUserRole(user.id);

     if (role !== 'system_admin') {
       // 检查是否是对话所有者
       const conversation = await db.query.conversations.findFirst({
         where: eq(conversations.id, conversationId),
       });

       if (conversation?.userId !== user.id) {
         throw new Error('Forbidden');
       }
     }

     // 系统管理员可以删除任何对话
     await db.delete(conversations).where(eq(conversations.id, conversationId));
   }

4. 在 API 路由中使用：

   import { neonAuth } from '@neondatabase/neon-js/auth/next';
   import { getUserRole } from '@/lib/auth/roles';

   export async function GET(request: Request) {
     const { session, user } = await neonAuth();
     if (!session || !user) {
       return Response.json({ error: 'Unauthorized' }, { status: 401 });
     }

     const role = await getUserRole(user.id);

     return Response.json({
       user: {
         id: user.id,
         email: user.email,
         name: user.name,
         role,
       },
     });
   }
  `);
}

// ============================================================================
// 主函数
// ============================================================================

function main() {
  console.log('🎭 RBAC 角色定义和获取示例\n');
  console.log('═'.repeat(60));

  example1_getUserRole();
  example2_getGroupRole();
  example3_getAllRoles();
  example4_roleHierarchy();
  example5_hasRole();
  realWorldExample();

  console.log('\n' + '═'.repeat(60));
  console.log('\n✅ 所有示例运行完成！\n');
  console.log('💡 关键要点：');
  console.log('   1. 角色定义在 user_profiles 表的 role 字段');
  console.log('   2. 用户可以在不同分组中拥有不同角色');
  console.log('   3. 角色有层级关系：system_admin > group_admin > member');
  console.log('   4. 高层级角色继承低层级角色的所有权限');
  console.log('   5. 系统管理员拥有所有权限');
  console.log('');
}

// 运行主函数
main();
