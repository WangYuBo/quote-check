/**
 * 02-login-flow.ts - 登录/登出流程演示
 *
 * 本示例演示如何：
 * 1. 模拟用户登录流程
 * 2. 生成 Session Token（JWT 或随机字符串）
 * 3. 模拟登出流程
 * 4. Session 刷新机制
 *
 * 运行：bunx tsx src/examples/auth/02-login-flow.ts
 */

import { randomBytes, createHash } from 'crypto';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 用户凭证（用于登录）
 */
interface Credentials {
  email: string;
  password: string;
}

/**
 * OAuth 凭证
 */
interface OAuthCredentials {
  provider: 'google' | 'github';
  code: string; // OAuth 授权码
}

/**
 * 用户信息
 */
interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string; // 实际存储在 neon_auth.user 表
}

/**
 * Session 信息
 */
interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

// ============================================================================
// 模拟数据库
// ============================================================================

/**
 * 模拟用户数据库（neon_auth.user 表）
 */
const mockUsers: Map<string, User> = new Map();

/**
 * 模拟 Session 数据库（neon_auth.session 表）
 */
const mockSessions: Map<string, Session> = new Map();

// 初始化测试用户
const alicePasswordHash = createHash('sha256').update('alice123').digest('hex');
mockUsers.set('alice@example.com', {
  id: 'user_alice_456',
  email: 'alice@example.com',
  name: 'Alice',
  passwordHash: alicePasswordHash,
});

// ============================================================================
// 密码处理函数
// ============================================================================

/**
 * 哈希密码（模拟）
 * 真实应用使用 bcrypt 或 argon2
 *
 * @param password - 明文密码
 * @returns 密码哈希
 */
function hashPassword(password: string): string {
  // 实际应用中使用：
  // return await bcrypt.hash(password, 10);
  return createHash('sha256').update(password).digest('hex');
}

/**
 * 验证密码
 *
 * @param password - 明文密码
 * @param hash - 密码哈希
 * @returns 是否匹配
 */
function verifyPassword(password: string, hash: string): boolean {
  // 实际应用中使用：
  // return await bcrypt.compare(password, hash);
  return hashPassword(password) === hash;
}

// ============================================================================
// Session Token 生成
// ============================================================================

/**
 * 生成随机 Session Token
 *
 * @returns Session Token（32 字节，hex 编码）
 */
function generateSessionToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * 生成 Session ID
 *
 * @returns Session ID
 */
function generateSessionId(): string {
  return `session_${randomBytes(16).toString('hex')}`;
}

// ============================================================================
// 登录函数
// ============================================================================

/**
 * 邮箱密码登录
 *
 * @param credentials - 用户凭证
 * @returns Session 信息或错误
 */
function loginWithPassword(
  credentials: Credentials
): { session: Session; user: User } | { error: string } {
  console.log(`🔐 尝试登录: ${credentials.email}`);

  // 1. 查找用户
  const user = mockUsers.get(credentials.email);
  if (!user) {
    console.log('❌ 用户不存在');
    return { error: 'Invalid credentials' };
  }

  // 2. 验证密码
  const isValid = verifyPassword(credentials.password, user.passwordHash);
  if (!isValid) {
    console.log('❌ 密码错误');
    return { error: 'Invalid credentials' };
  }

  // 3. 创建 Session
  const session: Session = {
    id: generateSessionId(),
    userId: user.id,
    token: generateSessionToken(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 天
    createdAt: new Date(),
  };

  // 4. 存储 Session
  mockSessions.set(session.token, session);

  console.log('✅ 登录成功');
  console.log('   Session ID:', session.id);
  console.log('   Token:', session.token.substring(0, 16) + '...');
  console.log('   过期时间:', session.expiresAt.toLocaleString());

  return { session, user };
}

/**
 * OAuth 登录（模拟）
 *
 * @param credentials - OAuth 凭证
 * @returns Session 信息或错误
 */
function loginWithOAuth(
  credentials: OAuthCredentials
): { session: Session; user: User } | { error: string } {
  console.log(`🔐 OAuth 登录: ${credentials.provider}`);

  // 模拟 OAuth 流程：
  // 1. 使用 code 换取 access_token
  // 2. 使用 access_token 获取用户信息
  // 3. 查找或创建用户
  // 4. 创建 Session

  // 这里直接模拟创建用户
  const oauthUser: User = {
    id: `user_oauth_${randomBytes(8).toString('hex')}`,
    email: `oauth_${credentials.provider}@example.com`,
    name: `OAuth User (${credentials.provider})`,
    passwordHash: '', // OAuth 用户无密码
  };

  mockUsers.set(oauthUser.email, oauthUser);

  const session: Session = {
    id: generateSessionId(),
    userId: oauthUser.id,
    token: generateSessionToken(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
  };

  mockSessions.set(session.token, session);

  console.log('✅ OAuth 登录成功');
  console.log('   用户 ID:', oauthUser.id);
  console.log('   Session Token:', session.token.substring(0, 16) + '...');

  return { session, user: oauthUser };
}

// ============================================================================
// 登出函数
// ============================================================================

/**
 * 登出（销毁 Session）
 *
 * @param token - Session Token
 * @returns 是否成功
 */
function logout(token: string): boolean {
  console.log('🚪 尝试登出...');

  const session = mockSessions.get(token);
  if (!session) {
    console.log('❌ Session 不存在');
    return false;
  }

  // 删除 Session
  mockSessions.delete(token);

  console.log('✅ 登出成功');
  console.log('   Session ID:', session.id);

  return true;
}

// ============================================================================
// Session 刷新
// ============================================================================

/**
 * 刷新 Session（延长过期时间）
 *
 * @param token - 当前 Session Token
 * @returns 新的 Session 或错误
 */
function refreshSession(token: string): { session: Session } | { error: string } {
  console.log('🔄 刷新 Session...');

  const oldSession = mockSessions.get(token);
  if (!oldSession) {
    console.log('❌ Session 不存在');
    return { error: 'Session not found' };
  }

  // 检查是否过期
  if (oldSession.expiresAt < new Date()) {
    console.log('❌ Session 已过期，请重新登录');
    mockSessions.delete(token);
    return { error: 'Session expired' };
  }

  // 生成新的 Session Token
  const newSession: Session = {
    id: generateSessionId(),
    userId: oldSession.userId,
    token: generateSessionToken(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 重新设置 7 天
    createdAt: new Date(),
  };

  // 删除旧 Session，添加新 Session
  mockSessions.delete(token);
  mockSessions.set(newSession.token, newSession);

  console.log('✅ Session 刷新成功');
  console.log('   旧 Token:', token.substring(0, 16) + '...');
  console.log('   新 Token:', newSession.token.substring(0, 16) + '...');
  console.log('   新过期时间:', newSession.expiresAt.toLocaleString());

  return { session: newSession };
}

// ============================================================================
// 使用示例
// ============================================================================

/**
 * 示例 1：邮箱密码登录
 */
function example1_passwordLogin() {
  console.log('\n========== 示例 1：邮箱密码登录 ==========\n');

  // 成功登录
  const result1 = loginWithPassword({
    email: 'alice@example.com',
    password: 'alice123',
  });

  if ('error' in result1) {
    console.log('登录失败:', result1.error);
  } else {
    console.log('\n登录结果:');
    console.log('  用户:', result1.user.name, `(${result1.user.email})`);
    console.log('  Session Token:', result1.session.token);
  }

  console.log('\n---\n');

  // 失败登录：密码错误
  const result2 = loginWithPassword({
    email: 'alice@example.com',
    password: 'wrong_password',
  });

  if ('error' in result2) {
    console.log('登录失败:', result2.error);
  }

  console.log('\n---\n');

  // 失败登录：用户不存在
  const result3 = loginWithPassword({
    email: 'nonexistent@example.com',
    password: 'any_password',
  });

  if ('error' in result3) {
    console.log('登录失败:', result3.error);
  }
}

/**
 * 示例 2：OAuth 登录
 */
function example2_oauthLogin() {
  console.log('\n========== 示例 2：OAuth 登录 ==========\n');

  // Google OAuth 登录
  const result1 = loginWithOAuth({
    provider: 'google',
    code: 'mock_google_code_123',
  });

  if ('error' in result1) {
    console.log('登录失败:', result1.error);
  } else {
    console.log('\n登录结果:');
    console.log('  用户:', result1.user.name);
    console.log('  邮箱:', result1.user.email);
    console.log('  Session Token:', result1.session.token);
  }

  console.log('\n---\n');

  // GitHub OAuth 登录
  const result2 = loginWithOAuth({
    provider: 'github',
    code: 'mock_github_code_456',
  });

  if ('error' in result2) {
    console.log('登录失败:', result2.error);
  } else {
    console.log('\n登录结果:');
    console.log('  用户:', result2.user.name);
    console.log('  Session Token:', result2.session.token);
  }
}

/**
 * 示例 3：登出流程
 */
function example3_logout() {
  console.log('\n========== 示例 3：登出流程 ==========\n');

  // 先登录
  const loginResult = loginWithPassword({
    email: 'alice@example.com',
    password: 'alice123',
  });

  if ('error' in loginResult) {
    console.log('登录失败');
    return;
  }

  const token = loginResult.session.token;

  console.log('\n---\n');

  // 登出
  logout(token);

  console.log('\n---\n');

  // 尝试再次登出（应该失败）
  logout(token);
}

/**
 * 示例 4：Session 刷新
 */
function example4_refreshSession() {
  console.log('\n========== 示例 4：Session 刷新 ==========\n');

  // 先登录
  const loginResult = loginWithPassword({
    email: 'alice@example.com',
    password: 'alice123',
  });

  if ('error' in loginResult) {
    console.log('登录失败');
    return;
  }

  const oldToken = loginResult.session.token;

  console.log('\n等待 2 秒后刷新...\n');
  // 实际应用中，这里会有实际的等待时间

  console.log('\n---\n');

  // 刷新 Session
  const refreshResult = refreshSession(oldToken);

  if ('error' in refreshResult) {
    console.log('刷新失败:', refreshResult.error);
  } else {
    console.log('\n刷新结果:');
    console.log('  新 Token:', refreshResult.session.token);
  }

  console.log('\n---\n');

  // 尝试使用旧 Token（应该失败）
  console.log('🔍 尝试使用旧 Token:');
  const oldSession = mockSessions.get(oldToken);
  if (!oldSession) {
    console.log('❌ 旧 Token 已失效');
  }
}

/**
 * 示例 5：完整的登录-使用-登出流程
 */
function example5_fullFlow() {
  console.log('\n========== 示例 5：完整流程 ==========\n');

  // 1. 登录
  console.log('步骤 1: 登录');
  const loginResult = loginWithPassword({
    email: 'alice@example.com',
    password: 'alice123',
  });

  if ('error' in loginResult) {
    console.log('登录失败');
    return;
  }

  const { session, user } = loginResult;

  console.log('\n---\n');

  // 2. 使用 Session 访问受保护资源
  console.log('步骤 2: 使用 Session 访问受保护资源');
  function getProtectedResource(token: string) {
    const currentSession = mockSessions.get(token);
    if (!currentSession) {
      console.log('❌ 未授权：Session 无效');
      return null;
    }

    if (currentSession.expiresAt < new Date()) {
      console.log('❌ 未授权：Session 已过期');
      return null;
    }

    console.log('✅ 访问成功');
    console.log('   用户 ID:', currentSession.userId);
    return { data: 'Protected data for ' + user.name };
  }

  const data = getProtectedResource(session.token);
  if (data) {
    console.log('   返回数据:', data.data);
  }

  console.log('\n---\n');

  // 3. 登出
  console.log('步骤 3: 登出');
  logout(session.token);

  console.log('\n---\n');

  // 4. 尝试再次访问（应该失败）
  console.log('步骤 4: 尝试再次访问（已登出）');
  getProtectedResource(session.token);
}

// ============================================================================
// 真实应用示例
// ============================================================================

/**
 * 真实应用中的登录流程（Next.js + Neon Auth）
 */
function realWorldExample() {
  console.log('\n========== 真实应用中的登录流程 ==========\n');

  console.log(`
在真实的 Next.js + Neon Auth 应用中：

1. 创建 Auth Client（lib/auth/client.ts）：

   'use client';

   import { createAuthClient } from '@neondatabase/neon-js/auth/next';

   export const authClient = createAuthClient();

2. 邮箱密码登录（客户端组件中）：

   'use client';

   import { authClient } from '@/lib/auth/client';

   export default function LoginPage() {
     const [email, setEmail] = useState('');
     const [password, setPassword] = useState('');

     async function handleSubmit(e: React.FormEvent) {
       e.preventDefault();

       const result = await authClient.signIn.email({
         email,
         password,
       });

       if (result.error) {
         alert(result.error.message);
         return;
       }

       // 登录成功，重定向到仪表板
       window.location.href = '/dashboard';
     }

     return (
       <form onSubmit={handleSubmit}>
         <input
           type="email"
           value={email}
           onChange={(e) => setEmail(e.target.value)}
           required
         />
         <input
           type="password"
           value={password}
           onChange={(e) => setPassword(e.target.value)}
           required
         />
         <button type="submit">登录</button>
       </form>
     );
   }

3. 用户注册：

   const result = await authClient.signUp.email({
     name: 'John Doe',
     email: 'john@example.com',
     password: 'securepassword',
   });

   if (result.error) {
     console.error('注册失败:', result.error.message);
   } else {
     console.log('注册成功:', result.data.user);
   }

4. OAuth 登录（Google、GitHub 等）：

   // 点击按钮触发 OAuth 登录
   async function handleGoogleLogin() {
     await authClient.signIn.social({
       provider: 'google',
       callbackURL: '/dashboard',
     });
   }

   async function handleGitHubLogin() {
     await authClient.signIn.social({
       provider: 'github',
       callbackURL: '/dashboard',
     });
   }

5. 登出：

   async function handleSignOut() {
     const { error } = await authClient.signOut();

     if (error) {
       console.error('登出失败:', error.message);
     } else {
       // 登出成功，重定向到首页
       window.location.href = '/';
     }
   }

6. 服务端验证（API Route 或 Server Component）：

   import { neonAuth } from '@neondatabase/neon-js/auth/next';

   export async function GET(request: Request) {
     const { session, user } = await neonAuth();

     if (!session || !user) {
       return Response.json({ error: 'Unauthorized' }, { status: 401 });
     }

     // 请求
     return Response.json({ user });
   }
  `);
}

// ============================================================================
// 主函数
// ============================================================================

function main() {
  console.log('🔑 登录/登出流程示例\n');
  console.log('═'.repeat(60));

  example1_passwordLogin();
  example2_oauthLogin();
  example3_logout();
  example4_refreshSession();
  example5_fullFlow();
  realWorldExample();

  console.log('\n' + '═'.repeat(60));
  console.log('\n✅ 所有示例运行完成！\n');
  console.log('💡 关键要点：');
  console.log('   1. 登录成功后生成 Session Token');
  console.log('   2. Session Token 存储在 Cookie 中（httpOnly, secure）');
  console.log('   3. 每次请求携带 Token，服务端验证有效性');
  console.log('   4. 登出时删除 Session，客户端清除 Cookie');
  console.log('   5. 支持 Session 刷新，延长登录状态');
  console.log('');
}

// 运行主函数
main();
