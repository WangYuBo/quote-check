/**
 * 管理后台专用认证守卫（SS-1 · MS-D-01）
 *
 * requireAdmin() — 检查登录 + role === 'admin'
 * withAdminAuth() — Route Handler 包装
 */
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
}

/**
 * Server Component 页面守卫：未登录 → redirect(/login)，非 admin → redirect(/)
 */
export async function requireAdminPage(): Promise<AdminUser> {
  const { headers } = await import('next/headers');
  const headerStore = await headers();

  const session = await auth.api.getSession({ headers: headerStore });

  if (!session?.user?.id) {
    redirect('/login');
  }

  if (session.user.role !== 'admin') {
    redirect('/');
  }

  return {
    id: session.user.id,
    email: session.user.email ?? '',
    name: session.user.name ?? '',
  };
}

/**
 * 从请求中提取已登录 admin 用户。
 * 未登录 → throw AuthError(401)；非 admin → throw AuthError(403)
 */
export async function requireAdmin(): Promise<AdminUser> {
  const { headers } = await import('next/headers');
  const headerStore = await headers();

  const session = await auth.api.getSession({ headers: headerStore });

  if (!session?.user?.id) {
    throw new AdminAuthError('Unauthorized', 401);
  }

  if (session.user.role !== 'admin') {
    throw new AdminAuthError('Forbidden: admin role required', 403);
  }

  return {
    id: session.user.id,
    email: session.user.email ?? '',
    name: session.user.name ?? '',
  };
}

export class AdminAuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'AdminAuthError';
    this.status = status;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RouteContext = any;

/**
 * Route Handler 包装：自动处理 AdminAuthError → 401/403 Response。
 * 支持 Next.js 动态路由 params：export const GET = withAdminAuth(async (admin, req, { params }) => { ... });
 */
export function withAdminAuth(
  handler: (admin: AdminUser, req: Request, context?: RouteContext) => Promise<NextResponse>,
): (req: Request, context?: RouteContext) => Promise<NextResponse> {
  return async (req, context) => {
    try {
      const admin = await requireAdmin();
      return handler(admin, req, context);
    } catch (err) {
      if (err instanceof AdminAuthError) {
        return NextResponse.json(
          { errorCode: err.status === 403 ? 'FORBIDDEN' : 'UNAUTHORIZED' },
          { status: err.status },
        );
      }
      throw err;
    }
  };
}
