/**
 * Route handler 鉴权守卫（SS-1 · spec-coding §6.1）
 *
 * 强制每个 Route Handler 首行鉴权。
 * 替换手写 `auth.api.getSession` 样板。
 */
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: 'user' | 'admin';
}

/**
 * 从请求中提取已登录用户。
 * 未登录 → 返回 401 Response（需及早 return）。
 */
export async function requireUser(): Promise<AuthenticatedUser> {
  // Next.js App Router：headers() 在 RSC / Route Handler 中可用
  const { headers } = await import('next/headers');
  const headerStore = await headers();

  const session = await auth.api.getSession({ headers: headerStore });

  if (!session?.user?.id) {
    throw new AuthError('Unauthorized');
  }

  return {
    id: session.user.id,
    email: session.user.email ?? '',
    role: (session.user.role as 'user' | 'admin') ?? 'user',
  };
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Route handler 包装：自动处理 AuthError → 401 Response。
 * 用法：export const GET = withAuth(async (user) => { ... });
 */
export function withAuth(
  handler: (user: AuthenticatedUser, req: Request) => Promise<NextResponse>,
): (req: Request) => Promise<NextResponse> {
  return async (req) => {
    try {
      const user = await requireUser();
      return handler(user, req);
    } catch (err) {
      if (err instanceof AuthError) {
        return NextResponse.json({ errorCode: 'UNAUTHORIZED' }, { status: 401 });
      }
      throw err;
    }
  };
}
