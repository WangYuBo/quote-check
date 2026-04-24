import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { getReport } from '@/lib/services/task';

export async function GET(req: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { taskId } = await params;
  const report = await getReport(taskId);
  if (!report) return NextResponse.json({ error: '报告不存在' }, { status: 404 });
  if (report.task.userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({
    taskId: report.task.id,
    displayId: report.task.displayId,
    status: report.task.status,
    totalQuotes: report.task.totalQuotes,
    results: report.results.map((r) => ({
      id: r.id,
      quoteId: r.quoteId,
      quoteText: r.quoteText,
      sourceWorkHint: r.sourceWorkHint,
      matchStatus: r.matchStatus,
      verdictTextAccuracy: r.verdictTextAccuracy,
      verdictInterpretation: r.verdictInterpretation,
      verdictContext: r.verdictContext,
      confidence: r.confidence,
      confidenceBreakdown: r.confidenceBreakdown,
    })),
  });
}
