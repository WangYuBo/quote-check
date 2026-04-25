import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { CONFIDENCE_ALGO_VERSION } from '@/lib/ai/confidence';
import { MODEL_ID } from '@/lib/ai/client';
import { PROMPT_VERSION } from '@/lib/ai/prompts';
import { getReport } from '@/lib/services/task';

/**
 * CSV 导出（MAS-5 · 版本戳随报告输出）
 *
 * GET /api/reports/[taskId]/export?format=csv
 *
 * 每条引文一行，三维度独立列（禁止合并为综合评分）。
 * 文件头含版本戳：model / prompts / generated。
 */
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

  const frozenAt = report.task.completedAt?.toISOString().slice(0, 10) ?? 'unknown';
  const header = [
    `# 引用核查报告 · ${report.task.displayId}`,
    `# model=${MODEL_ID} | prompts=${PROMPT_VERSION} | confidence_algo=${CONFIDENCE_ALGO_VERSION} | generated=${frozenAt}`,
    `# 注：终审权归编辑，AI 结果仅供参考`,
    '',
  ].join('\n');

  const cols = [
    '序号',
    '引用文字',
    '来源提示',
    '参考匹配状态',
    '字词准确性',
    '字词说明',
    '解释一致性',
    '解释说明',
    '上下文相符性',
    '上下文说明',
    '置信度',
  ];

  const escape = (s: string) => `"${(s ?? '').replace(/"/g, '""')}"`;

  const rows = report.results.map((r, i) => {
    const textV = r.verdictTextAccuracy as { verdict: string; explanation: string } | null;
    const interV = r.verdictInterpretation as { verdict: string; explanation: string } | null;
    const ctxV = r.verdictContext as { verdict: string; explanation: string } | null;

    return [
      i + 1,
      escape(r.quoteText ?? ''),
      escape(r.sourceWorkHint ?? ''),
      escape(r.matchStatus ?? ''),
      escape(textV?.verdict ?? ''),
      escape(textV?.explanation ?? ''),
      escape(interV?.verdict ?? ''),
      escape(interV?.explanation ?? ''),
      escape(ctxV?.verdict ?? ''),
      escape(ctxV?.explanation ?? ''),
      escape(String(r.confidence ?? '')),
    ].join(',');
  });

  const csv = header + cols.join(',') + '\n' + rows.join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="quote-check-${report.task.displayId}.csv"`,
    },
  });
}
