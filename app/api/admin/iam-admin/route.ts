import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { user } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * 一次性管理员自升级工具（仅开发/初始设置阶段使用）
 *
 * 需要登录 + 查询参数 email 与当前用户匹配。
 * 访问 /api/admin/iam-admin?email=your@email.com
 *
 * 部署后即可删除此文件。
 */
export async function GET(req: Request) {
  const { headers } = await import('next/headers');
  const headerStore = await headers();
  const session = await auth.api.getSession({ headers: headerStore });

  if (!session?.user?.id) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const url = new URL(req.url);
  const confirmEmail = url.searchParams.get('email');

  if (!confirmEmail) {
    return NextResponse.json({
      currentUser: { id: session.user.id, email: session.user.email, role: session.user.role },
      message: '请在 URL 中添加 ?email=你的邮箱 来确认升级',
    });
  }

  if (confirmEmail !== session.user.email) {
    return NextResponse.json({ error: '邮箱不匹配' }, { status: 403 });
  }

  if (session.user.role === 'admin') {
    return NextResponse.json({ message: '已经是管理员，无需升级' });
  }

  await db.update(user).set({ role: 'admin' }).where(eq(user.id, session.user.id));

  return NextResponse.json({
    success: true,
    message: `用户 ${confirmEmail} 已升级为 admin，请重新登录`,
  });
}
