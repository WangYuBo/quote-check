import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { inngest } from '@/inngest/client';
import { auth } from '@/lib/auth';
import { getManuscript } from '@/lib/services/manuscript';
import { createTask, updateTaskStatus } from '@/lib/services/task';

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { manuscriptId?: string; referenceIds?: string[] };
  try {
    body = (await req.json()) as { manuscriptId?: string; referenceIds?: string[] };
  } catch {
    return NextResponse.json({ error: '无效 JSON' }, { status: 400 });
  }

  if (!body.manuscriptId) {
    return NextResponse.json({ error: '缺少 manuscriptId' }, { status: 400 });
  }

  const doc = await getManuscript(body.manuscriptId);
  if (!doc) {
    return NextResponse.json({ error: '书稿不存在' }, { status: 404 });
  }
  if (doc.userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const newTask = await createTask({
    userId: session.user.id,
    manuscriptId: body.manuscriptId,
    referenceIds: body.referenceIds ?? [],
  });

  // 立即推进到 VERIFYING，再发事件
  await updateTaskStatus(newTask.id, 'VERIFYING');

  await inngest.send({
    name: 'task/proofread.requested',
    data: {
      taskId: newTask.id,
      userId: session.user.id,
      triggeredBy: 'user',
      requestedAt: new Date().toISOString(),
    },
  });

  return NextResponse.json({ taskId: newTask.id, displayId: newTask.displayId }, { status: 201 });
}
