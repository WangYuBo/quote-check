import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { inngest } from '@/inngest/client';
import { auth } from '@/lib/auth';
import {
  COST_CONFIRM_THRESHOLD_FEN,
  DEFAULT_COST_CEILING_FEN,
  estimateCostFen,
  formatFenAsYuan,
} from '@/lib/ai/cost';
import { getManuscript } from '@/lib/services/manuscript';
import { createTask, updateTaskStatus } from '@/lib/services/task';

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { manuscriptId?: string; referenceIds?: string[]; costConfirmed?: boolean };
  try {
    body = (await req.json()) as typeof body;
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

  // MAS-4: 预估费用
  const charCount = doc.charCount ?? 0;
  const estimate = estimateCostFen(charCount);
  const thresholdExceeded = estimate.estimatedFen > COST_CONFIRM_THRESHOLD_FEN;

  // 超过阈值且未确认 → 返回 402，要求用户确认
  if (thresholdExceeded && !body.costConfirmed) {
    return NextResponse.json(
      {
        requiresConfirm: true,
        estimate: {
          quoteCountEstimate: estimate.quoteCountEstimate,
          estimatedFen: estimate.estimatedFen,
          estimatedDisplay: formatFenAsYuan(estimate.estimatedFen),
          errorMarginPct: estimate.errorMarginPct,
          thresholdDisplay: formatFenAsYuan(COST_CONFIRM_THRESHOLD_FEN),
        },
      },
      { status: 402 },
    );
  }

  const newTask = await createTask({
    userId: session.user.id,
    manuscriptId: body.manuscriptId,
    referenceIds: body.referenceIds ?? [],
    costEstimatedCents: estimate.estimatedFen,
    costCeilingCents: DEFAULT_COST_CEILING_FEN,
    ...(thresholdExceeded && { costConfirmedAt: new Date() }),
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

  return NextResponse.json(
    {
      taskId: newTask.id,
      displayId: newTask.displayId,
      estimate: {
        estimatedFen: estimate.estimatedFen,
        estimatedDisplay: formatFenAsYuan(estimate.estimatedFen),
        quoteCountEstimate: estimate.quoteCountEstimate,
      },
    },
    { status: 201 },
  );
}
