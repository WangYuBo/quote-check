/**
 * 01-session.ts - Session 获取和验证示例
 *
 * 本示例演示如何：
 * 1. 模拟获取当前用户 Session
 * 2. 从 Session 提取 userId
 * 3. Session 过期处理
 *
 * 运行：bunx tsx src/examples/auth/01-session.ts
 */

// ============================================================================
// Session 类型定义
// ============================================================================

/**
 * Session 数据结构
 *
 * 在真实应用中，Session 通常包含：
 * - user: 用户基本信息
 * - expiresAt: 过期时间
 * - token: Session Token（JWT 或随机字符串）
 */
interface Session {
  user: {
    id: string; // Neon Auth 用户 ID（text 类型）
    email: string;
    name: string;
  };
  expiresAt: Date;
  token: string;
}

// ============================================================================
// Session 存储（模拟）
// ============================================================================

/**
 * 模拟的 Session 存储
 * 在真实应用中，这些数据存储在：
 * - 服务端：neon_auth.session 表
 * - 客户端：Cookie 或 LocalStorage
 */
const mockSessions: Map<string, Session> = new Map();

// 初始化一些模拟 Session
mockSessions.set('session_valid_123', {
  user: {
    id: 'user_alice_456',
    email: 'alice@example.com',
    name: 'Alice',
  },
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 天后过期
  token: 'session_valid_123',
});

mockSessions.set('session_expired_789', {
  user: {
    id: 'user_bob_789',
    email: 'bob@example.com',
    name: 'Bob',
  },
  expiresAt: new Date(Date.now() - 1000), // 已过期（1 秒前）
  token: 'session_expired_789',
});

// ============================================================================
// Session 操作函数
// ============================================================================

/**
 * 从 Cookie 或请求头获取 Session Token
 *
 * @param request - HTTP 请求对象（这里用字符串模拟）
 * @returns Session Token 或 null
 */
function getSessionToken(request: { cookie?: string }): string | null {
  // 在真实应用中，从 Cookie 解析
  // const cookie = request.headers.get('cookie');
  // const match = cookie?.match(/session=([^;]+)/);
  // return match ? match[1] : null;

  return request.cookie || null;
}

/**
 * 根据 Token 获取 Session
 *
 * @param token - Session Token
 * @returns Session 对象或 null（未找到或已过期）
 */
function getSession(token: string | null): Session | null {
  if (!token) {
    console.log('❌ 未提供 Session Token');
    return null;
  }

  const session = mockSessions.get(token);

  if (!session) {
    console.log('❌ Session 不存在');
    return null;
  }

  // 检查是否过期
  if (session.expiresAt < new Date()) {
    console.log('❌ Session 已过期');
    return null;
  }

  console.log('✅ Session 有效');
  return session;
}

/**
 * 验证 Session 并提取用户信息
 *
 * @param request - HTTP 请求对象
 * @returns 用户信息或 null
 */
function getCurrentUser(request: { cookie?: string }): Session['user'] | null {
  const token = getSessionToken(request);
  const session = getSession(token);
  return session ? session.user : null;
}

/**
 * 需要认证的包装函数（装饰器模式）
 *
 * @param handler - 业务逻辑函数
 * @returns 包装后的函数
 */
function requireAuth<T extends unknown[], R>(
  handler: (user: Session['user'], ...args: T) => R
): (request: { cookie?: string }, ...args: T) => R | { error: string } {
  return (request: { cookie?: string }, ...args: T) => {
    const user = getCurrentUser(request);
    if (!user) {
      return { error: 'Not authenticated' };
    }
    return handler(user, ...args);
  };
}

// ============================================================================
// 使用示例
// ============================================================================

/**
 * 示例 1：手动检查 Session
 */
function example1_manualCheck() {
  console.log('\n========== 示例 1：手动检查 Session ==========\n');

  // 情况 1：有效的 Session
  const request1 = { cookie: 'session_valid_123' };
  const user1 = getCurrentUser(request1);
  if (user1) {
    console.log('👤 当前用户:', user1.name, `(${user1.email})`);
    console.log('🆔 用户 ID:', user1.id);
  } else {
    console.log('🚫 未登录');
  }

  console.log('\n---\n');

  // 情况 2：过期的 Session
  const request2 = { cookie: 'session_expired_789' };
  const user2 = getCurrentUser(request2);
  if (user2) {
    console.log('👤 当前用户:', user2.name);
  } else {
    console.log('🚫 Session 已过期，请重新登录');
  }

  console.log('\n---\n');

  // 情况 3：无效的 Session
  const request3 = { cookie: 'session_invalid_000' };
  const user3 = getCurrentUser(request3);
  if (user3) {
    console.log('👤 当前用户:', user3.name);
  } else {
    console.log('🚫 无效的 Session');
  }
}

/**
 * 示例 2：使用 requireAuth 装饰器
 */
function example2_decorator() {
  console.log('\n========== 示例 2：使用 requireAuth 装饰器 ==========\n');

  // 业务逻辑：查询用户的对话列表
  function getUserConversations(user: Session['user']) {
    console.log(`📋 查询 ${user.name} 的对话列表...`);
    return [
      { id: '1', title: '对话 1', userId: user.id },
      { id: '2', title: '对话 2', userId: user.id },
    ];
  }

  // 包装成需要认证的函数
  const protectedGetUserConversations = requireAuth(getUserConversations);

  // 测试 1：有效 Session
  const request1 = { cookie: 'session_valid_123' };
  const result1 = protectedGetUserConversations(request1);
  console.log('结果 1:', result1);

  console.log('\n---\n');

  // 测试 2：无效 Session
  const request2 = { cookie: 'session_invalid_000' };
  const result2 = protectedGetUserConversations(request2);
  console.log('结果 2:', result2);
}

/**
 * 示例 3：在 API 路由中使用 Session
 */
function example3_apiRoute() {
  console.log('\n========== 示例 3：API 路由中使用 Session ==========\n');

  // 模拟 API 路由处理函数
  function handleGetProfile(request: { cookie?: string }) {
    const user = getCurrentUser(request);

    if (!user) {
      return {
        status: 401,
        body: { error: 'Unauthorized' },
      };
    }

    // 返回用户信息
    return {
      status: 200,
      body: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      },
    };
  }

  // 测试：有效请求
  const request1 = { cookie: 'session_valid_123' };
  const response1 = handleGetProfile(request1);
  console.log('✅ GET /api/profile (已登录)');
  console.log('Status:', response1.status);
  console.log('Body:', JSON.stringify(response1.body, null, 2));

  console.log('\n---\n');

  // 测试：未登录请求
  const request2 = { cookie: undefined };
  const response2 = handleGetProfile(request2);
  console.log('❌ GET /api/profile (未登录)');
  console.log('Status:', response2.status);
  console.log('Body:', JSON.stringify(response2.body, null, 2));
}

/**
 * 示例 4：Session 过期处理
 */
function example4_expiration() {
  console.log('\n========== 示例 4：Session 过期处理 ==========\n');

  function checkSessionExpiration(token: string): void {
    const session = mockSessions.get(token);

    if (!session) {
      console.log('❌ Session 不存在');
      return;
    }

    const now = new Date();
    const timeLeft = session.expiresAt.getTime() - now.getTime();

    if (timeLeft <= 0) {
      console.log('❌ Session 已过期');
      console.log('   过期时间:', session.expiresAt.toLocaleString());
      console.log('   当前时间:', now.toLocaleString());
      console.log('   建议：重定向到登录页');
      return;
    }

    const daysLeft = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hoursLeft = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    console.log('✅ Session 有效');
    console.log('   用户:', session.user.name);
    console.log('   过期时间:', session.expiresAt.toLocaleString());
    console.log(`   剩余时间: ${daysLeft} 天 ${hoursLeft} 小时`);

    if (daysLeft < 1) {
      console.log('⚠️  Session 即将过期，建议刷新');
    }
  }

  // 检查有效 Session
  console.log('🔍 检查 Alice 的 Session:');
  checkSessionExpiration('session_valid_123');

  console.log('\n---\n');

  // 检查过期 Session
  console.log('🔍 检查 Bob 的 Session:');
  checkSessionExpiration('session_expired_789');
}

// ============================================================================
// 真实应用中的 Session 管理
// ============================================================================

/**
 * 真实应用中的 Session 获取（使用 Neon Auth SDK）
 *
 * 示例代码（不可运行）：
 */
function realWorldExample() {
  console.log('\n========== 真实应用中的 Session 管理 ==========\n');

  console.log(`
在真实的 Next.js + Neon Auth 应用中：

1. 服务端获取 Session（Server Component 或 API Route 中）：

   import { neonAuth } from '@neondatabase/neon-js/auth/next';

   // Server Component 中
   export default async function ProfilePage() {
     const { session, user } = await neonAuth();

     if (!session || !user) {
       redirect('/auth/sign-in');
     }

     return <div>Welcome, {user.name}!</div>;
   }

   // API Route Handler 中
   export async function GET(request: Request) {
     const { session, user } = await neonAuth();

     if (!session || !user) {
       return Response.json({ error: 'Unauthorized' }, { status: 401 });
     }

     const userId = user.id; // 从 Session 获取用户 ID
     // ... 业务逻辑
   }

2. 客户端获取 Session（Client Component 中）：

   'use client';

   import { createAuthClient } from '@neondatabase/neon-js/auth/next';

   const authClient = createAuthClient();

   function MyComponent() {
     const [session, setSession] = useState(null);
     const [user, setUser] = useState(null);
     const [loading, setLoading] = useState(true);

     useEffect(() => {
       authClient.getSession().then((result) => {
         if (result.data?.session && result.data?.user) {
           setSession(result.data.session);
           setUser(result.data.user);
         }
         setLoading(false);
       });
     }, []);

     if (loading) return <div>Loading...</div>;
     if (!session) return <div>Not logged in</div>;

     return <div>Welcome, {user.name}!</div>;
   }

3. 中间件保护路由（middleware.ts 或 proxy.ts）：

   import { neonAuthMiddleware } from '@neondatabase/neon-js/auth/next';

   export default neonAuthMiddleware({
     // 未认证用户重定向到登录页
     loginUrl: '/auth/sign-in',
   });

   export const config = {
     matcher: [
       // 需要认证的路由
       '/account/:path*',
       '/dashboard/:path*',
     ],
   };
  `);
}

// ============================================================================
// 主函数
// ============================================================================

function main() {
  console.log('🔐 Session 获取和验证示例\n');
  console.log('═'.repeat(60));

  example1_manualCheck();
  example2_decorator();
  example3_apiRoute();
  example4_expiration();
  realWorldExample();

  console.log('\n' + '═'.repeat(60));
  console.log('\n✅ 所有示例运行完成！\n');
  console.log('💡 关键要点：');
  console.log('   1. Session 是认证的基础，存储用户身份信息');
  console.log('   2. 每次请求都需要验证 Session 是否有效');
  console.log('   3. Session 过期后需要重新登录');
  console.log('   4. 永远不要信任客户端传来的用户信息，从 Session 获取');
  console.log('');
}

// 运行主函数
main();
