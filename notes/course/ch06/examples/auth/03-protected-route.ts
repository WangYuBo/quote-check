/**
 * 03-protected-route.ts - 受保护路由示例
 *
 * 本示例演示如何：
 * 1. 使用中间件检查认证状态
 * 2. 未登录时重定向到登录页
 * 3. API 路由保护
 * 4. 页面级别的认证检查
 *
 * 运行：bunx tsx src/examples/auth/03-protected-route.ts
 */

import { randomBytes } from 'crypto';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * HTTP 请求
 */
interface Request {
  url: string;
  method: string;
  headers: Map<string, string>;
  cookies: Map<string, string>;
}

/**
 * HTTP 响应
 */
interface Response {
  status: number;
  body?: unknown;
  redirect?: string;
  headers?: Map<string, string>;
}

/**
 * Session 信息
 */
interface Session {
  userId: string;
  email: string;
  name: string;
  expiresAt: Date;
}

/**
 * 中间件函数类型
 */
type Middleware = (request: Request) => Response | null;

// ============================================================================
// 模拟数据
// ============================================================================

/**
 * 模拟 Session 存储
 */
const mockSessions = new Map<string, Session>();

// 初始化测试 Session
mockSessions.set('valid_token_123', {
  userId: 'user_alice_456',
  email: 'alice@example.com',
  name: 'Alice',
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
});

// ============================================================================
// 认证中间件
// ============================================================================

/**
 * 从请求中获取 Session Token
 *
 * @param request - HTTP 请求
 * @returns Session Token 或 null
 */
function getSessionToken(request: Request): string | null {
  // 从 Cookie 获取
  const token = request.cookies.get('session');
  return token || null;
}

/**
 * 验证 Session
 *
 * @param token - Session Token
 * @returns Session 对象或 null
 */
function validateSession(token: string | null): Session | null {
  if (!token) return null;

  const session = mockSessions.get(token);
  if (!session) return null;

  // 检查过期
  if (session.expiresAt < new Date()) {
    mockSessions.delete(token);
    return null;
  }

  return session;
}

/**
 * 认证中间件：检查用户是否登录
 *
 * @param request - HTTP 请求
 * @returns 响应（重定向到登录页）或 null（继续处理）
 */
function authMiddleware(request: Request): Response | null {
  const token = getSessionToken(request);
  const session = validateSession(token);

  if (!session) {
    console.log('❌ 未登录，重定向到登录页');
    return {
      status: 302,
      redirect: `/login?returnUrl=${encodeURIComponent(request.url)}`,
    };
  }

  console.log(`✅ 已认证: ${session.name} (${session.email})`);

  // 将 Session 附加到请求对象（实际应用中）
  // request.session = session;

  return null; // 继续处理请求
}

/**
 * API 认证中间件：返回 401 而不是重定向
 *
 * @param request - HTTP 请求
 * @returns 响应（401 Unauthorized）或 null（继续处理）
 */
function apiAuthMiddleware(request: Request): Response | null {
  const token = getSessionToken(request);
  const session = validateSession(token);

  if (!session) {
    console.log('❌ API 请求未授权');
    return {
      status: 401,
      body: { error: 'Unauthorized' },
    };
  }

  console.log(`✅ API 请求已授权: ${session.name}`);
  return null;
}

// ============================================================================
// 路由处理器
// ============================================================================

/**
 * 处理请求（模拟 Next.js 路由）
 *
 * @param request - HTTP 请求
 * @param middleware - 中间件数组
 * @param handler - 路由处理函数
 * @returns 响应
 */
function handleRequest(
  request: Request,
  middleware: Middleware[],
  handler: (request: Request) => Response
): Response {
  console.log(`\n🌐 ${request.method} ${request.url}`);

  // 执行中间件
  for (const mw of middleware) {
    const response = mw(request);
    if (response) {
      return response; // 中间件拦截，返回响应
    }
  }

  // 执行路由处理器
  return handler(request);
}

// ============================================================================
// 使用示例
// ============================================================================

/**
 * 示例 1：受保护的页面路由
 */
function example1_protectedPage() {
  console.log('\n========== 示例 1：受保护的页面路由 ==========');

  // 页面处理器
  function dashboardHandler(request: Request): Response {
    console.log('✅ 渲染 Dashboard 页面');
    return {
      status: 200,
      body: '<html><body><h1>Dashboard</h1></body></html>',
    };
  }

  // 测试 1：已登录用户
  console.log('\n--- 测试 1：已登录用户访问 ---');
  const request1: Request = {
    url: '/dashboard',
    method: 'GET',
    headers: new Map(),
    cookies: new Map([['session', 'valid_token_123']]),
  };

  const response1 = handleRequest(request1, [authMiddleware], dashboardHandler);
  console.log('响应状态:', response1.status);
  if (response1.redirect) {
    console.log('重定向到:', response1.redirect);
  }

  // 测试 2：未登录用户
  console.log('\n--- 测试 2：未登录用户访问 ---');
  const request2: Request = {
    url: '/dashboard',
    method: 'GET',
    headers: new Map(),
    cookies: new Map(), // 没有 Session Cookie
  };

  const response2 = handleRequest(request2, [authMiddleware], dashboardHandler);
  console.log('响应状态:', response2.status);
  if (response2.redirect) {
    console.log('重定向到:', response2.redirect);
  }
}

/**
 * 示例 2：受保护的 API 路由
 */
function example2_protectedAPI() {
  console.log('\n========== 示例 2：受保护的 API 路由 ==========');

  // API 处理器
  function getUserProfileHandler(request: Request): Response {
    const token = getSessionToken(request);
    const session = validateSession(token);

    console.log('✅ 返回用户信息');
    return {
      status: 200,
      body: {
        user: {
          id: session!.userId,
          email: session!.email,
          name: session!.name,
        },
      },
    };
  }

  // 测试 1：已登录用户
  console.log('\n--- 测试 1：已登录用户请求 API ---');
  const request1: Request = {
    url: '/api/user/profile',
    method: 'GET',
    headers: new Map(),
    cookies: new Map([['session', 'valid_token_123']]),
  };

  const response1 = handleRequest(request1, [apiAuthMiddleware], getUserProfileHandler);
  console.log('响应状态:', response1.status);
  console.log('响应体:', JSON.stringify(response1.body, null, 2));

  // 测试 2：未登录用户
  console.log('\n--- 测试 2：未登录用户请求 API ---');
  const request2: Request = {
    url: '/api/user/profile',
    method: 'GET',
    headers: new Map(),
    cookies: new Map(),
  };

  const response2 = handleRequest(request2, [apiAuthMiddleware], getUserProfileHandler);
  console.log('响应状态:', response2.status);
  console.log('响应体:', JSON.stringify(response2.body, null, 2));
}

/**
 * 示例 3：多个中间件组合
 */
function example3_multipleMiddleware() {
  console.log('\n========== 示例 3：多个中间件组合 ==========');

  // CORS 中间件
  function corsMiddleware(request: Request): Response | null {
    console.log('🔧 执行 CORS 中间件');
    // 实际应用中，这里会设置 CORS 头
    return null;
  }

  // 日志中间件
  function loggingMiddleware(request: Request): Response | null {
    console.log(`📝 日志: ${request.method} ${request.url}`);
    return null;
  }

  // API 处理器
  function createConversationHandler(request: Request): Response {
    console.log('✅ 创建对话');
    return {
      status: 201,
      body: {
        id: randomBytes(16).toString('hex'),
        title: 'New Conversation',
      },
    };
  }

  // 测试：组合多个中间件
  const request: Request = {
    url: '/api/conversations',
    method: 'POST',
    headers: new Map(),
    cookies: new Map([['session', 'valid_token_123']]),
  };

  const response = handleRequest(
    request,
    [loggingMiddleware, corsMiddleware, apiAuthMiddleware],
    createConversationHandler
  );

  console.log('\n响应状态:', response.status);
  console.log('响应体:', JSON.stringify(response.body, null, 2));
}

/**
 * 示例 4：条件性保护路由
 */
function example4_conditionalProtection() {
  console.log('\n========== 示例 4：条件性保护路由 ==========');

  // 智能认证中间件：根据路径决定是否需要认证
  function smartAuthMiddleware(request: Request): Response | null {
    const publicPaths = ['/login', '/signup', '/about', '/api/public'];

    // 公开路径，跳过认证
    if (publicPaths.some((path) => request.url.startsWith(path))) {
      console.log('ℹ️  公开路径，跳过认证');
      return null;
    }

    // 其他路径，需要认证
    const token = getSessionToken(request);
    const session = validateSession(token);

    if (!session) {
      console.log('❌ 需要认证');

      // API 路径返回 401
      if (request.url.startsWith('/api/')) {
        return {
          status: 401,
          body: { error: 'Unauthorized' },
        };
      }

      // 页面路径重定向
      return {
        status: 302,
        redirect: `/login?returnUrl=${encodeURIComponent(request.url)}`,
      };
    }

    console.log(`✅ 已认证: ${session.name}`);
    return null;
  }

  // 测试 1：公开页面
  console.log('\n--- 测试 1：访问公开页面 ---');
  const request1: Request = {
    url: '/about',
    method: 'GET',
    headers: new Map(),
    cookies: new Map(), // 未登录
  };

  const response1 = handleRequest(
    request1,
    [smartAuthMiddleware],
    () => ({ status: 200, body: 'About page' })
  );
  console.log('响应状态:', response1.status);

  // 测试 2：受保护页面（未登录）
  console.log('\n--- 测试 2：访问受保护页面（未登录）---');
  const request2: Request = {
    url: '/dashboard',
    method: 'GET',
    headers: new Map(),
    cookies: new Map(), // 未登录
  };

  const response2 = handleRequest(
    request2,
    [smartAuthMiddleware],
    () => ({ status: 200, body: 'Dashboard' })
  );
  console.log('响应状态:', response2.status);
  if (response2.redirect) {
    console.log('重定向到:', response2.redirect);
  }

  // 测试 3：受保护 API（未登录）
  console.log('\n--- 测试 3：访问受保护 API（未登录）---');
  const request3: Request = {
    url: '/api/user/profile',
    method: 'GET',
    headers: new Map(),
    cookies: new Map(), // 未登录
  };

  const response3 = handleRequest(
    request3,
    [smartAuthMiddleware],
    () => ({ status: 200, body: { user: {} } })
  );
  console.log('响应状态:', response3.status);
  console.log('响应体:', JSON.stringify(response3.body, null, 2));
}

// ============================================================================
// 真实应用示例
// ============================================================================

/**
 * 真实应用中的路由保护（Next.js）
 */
function realWorldExample() {
  console.log('\n========== 真实应用中的路由保护 ==========\n');

  console.log(`
在真实的 Next.js + Neon Auth 应用中：

1. 中间件保护路由（proxy.ts 或 middleware.ts）：

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

2. Server Component 中检查认证（app/dashboard/page.tsx）：

   import { neonAuth } from '@neondatabase/neon-js/auth/next';
   import { redirect } from 'next/navigation';

   export default async function DashboardPage() {
     const { session, user } = await neonAuth();

     if (!session || !user) {
       redirect('/auth/sign-in');
     }

     return (
       <div>
         <h1>Welcome, {user.name}!</h1>
       </div>
     );
   }

3. API 路由保护（app/api/conversations/route.ts）：

   import { neonAuth } from '@neondatabase/neon-js/auth/next';

   export async function GET(request: Request) {
     const { session, user } = await neonAuth();

     if (!session || !user) {
       return Response.json({ error: 'Unauthorized' }, { status: 401 });
     }

     const conversations = await db.query.conversations.findMany({
       where: eq(conversations.userId, user.id),
     });

     return Response.json({ conversations });
   }

4. Client Component 中使用 Session（app/dashboard/client-component.tsx）：

   'use client';

   import { createAuthClient } from '@neondatabase/neon-js/auth/next';
   import { useRouter } from 'next/navigation';
   import { useState, useEffect } from 'react';

   const authClient = createAuthClient();

   export default function ClientComponent() {
     const [session, setSession] = useState(null);
     const [user, setUser] = useState(null);
     const [loading, setLoading] = useState(true);
     const router = useRouter();

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

     if (!session) {
       router.push('/auth/sign-in');
       return null;
     }

     return <div>Welcome, {user.name}!</div>;
   }

5. Server Action 保护（app/actions/conversations.ts）：

   'use server';

   import { neonAuth } from '@neondatabase/neon-js/auth/next';

   export async function createConversation(title: string) {
     const { session, user } = await neonAuth();

     if (!session || !user) {
       throw new Error('Unauthorized');
     }

     const conversation = await db.insert(conversations).values({
       userId: user.id,
       title,
     });

     return conversation;
   }
  `);
}

// ============================================================================
// 主函数
// ============================================================================

function main() {
  console.log('🛡️  受保护路由示例\n');
  console.log('═'.repeat(60));

  example1_protectedPage();
  example2_protectedAPI();
  example3_multipleMiddleware();
  example4_conditionalProtection();
  realWorldExample();

  console.log('\n' + '═'.repeat(60));
  console.log('\n✅ 所有示例运行完成！\n');
  console.log('💡 关键要点：');
  console.log('   1. 中间件在路由处理前执行，统一检查认证状态');
  console.log('   2. 页面路由未认证时重定向到登录页');
  console.log('   3. API 路由未认证时返回 401 Unauthorized');
  console.log('   4. 可以根据路径决定是否需要认证（公开/私有）');
  console.log('   5. 多个中间件可以组合使用（CORS、日志、认证等）');
  console.log('');
}

// 运行主函数
main();
