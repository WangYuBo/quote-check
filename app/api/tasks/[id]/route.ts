import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { getTask } from '@/lib/services/task';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const taskRow = await getTask(id);
  if (!taskRow) return NextResponse.json({ error: '任务不存在' }, { status: 404 });
  if (taskRow.userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({
    taskId: taskRow.id,
    displayId: taskRow.displayId,
    status: taskRow.status,
    totalQuotes: taskRow.totalQuotes,
    verifiedQuotes: taskRow.verifiedQuotes,
    failedQuotes: taskRow.failedQuotes,
    createdAt: taskRow.createdAt,
  });
}
