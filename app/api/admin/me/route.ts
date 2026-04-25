import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

/**
 * 调试用：查看当前登录用户的 session 信息
 */
export async function GET() {
  const { headers } = await import('next/headers');
  const headerStore = await headers();

  const session = await auth.api.getSession({ headers: headerStore });

  if (!session?.user) {
    return NextResponse.json({ authenticated: false, message: '未登录' });
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      id: session.user.id,
      email: session.user.email,
      role: session.user.role,
      name: session.user.name,
    },
    sessionId: session.session?.id?.slice(0, 12),
  });
}
