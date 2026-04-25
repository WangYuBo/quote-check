import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';

import { auth } from '@/lib/auth';
import { CONFIDENCE_ALGO_VERSION } from '@/lib/ai/confidence';
import { MODEL_ID } from '@/lib/ai/client';
import { PROMPT_VERSION } from '@/lib/ai/prompts';
import { getReport } from '@/lib/services/task';

/**
 * Word 导出（MAS-5 · 版本戳随报告输出）
 *
 * GET /api/reports/[taskId]/export-docx
 *
 * 每条引文一行，三维度独立列。文件头含版本戳。
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

  const metaRows = [
    `报告编号：${report.task.displayId}`,
    `生成日期：${frozenAt}`,
    `模型版本：${MODEL_ID}`,
    `提示词版本：${PROMPT_VERSION}`,
    `置信度算法：${CONFIDENCE_ALGO_VERSION}`,
    `注：终审权归编辑，AI 结果仅供参考`,
  ];

  const MATCH_LABEL: Record<string, string> = {
    MATCH: '符合参考',
    PARTIAL_MATCH: '部分符合',
    NOT_MATCH: '不符合参考',
    NOT_FOUND_IN_REF: '未在参考中找到',
  };

  const VERDICT_LABEL: Record<string, string> = {
    MATCH: '一致', VARIANT: '存在异文', MISMATCH: '不一致', NOT_FOUND_IN_REF: '未找到',
    CONSISTENT: '一致', PARTIAL: '部分一致', DIVERGENT: '有偏差',
    APPROPRIATE: '符合语境', AMBIGUOUS: '语境模糊', OUT_OF_CONTEXT: '超出语境',
    NOT_APPLICABLE: '—',
  };

  const headerRow = new TableRow({
    tableHeader: true,
    children: ['序号', '引用文字', '来源提示', '参考匹配', '字词准确性', '字词说明', '解释一致性', '解释说明', '上下文相符', '上下文说明', '置信度'].map(
      (text) =>
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text, bold: true })] })],
          width: { size: 1, type: WidthType.AUTO },
        }),
    ),
  });

  const dataRows = report.results.map((r, i) => {
    const textV = r.verdictTextAccuracy as { verdict: string; explanation: string } | null;
    const interV = r.verdictInterpretation as { verdict: string; explanation: string } | null;
    const ctxV = r.verdictContext as { verdict: string; explanation: string } | null;

    const cells = [
      String(i + 1),
      r.quoteText ?? '',
      r.sourceWorkHint ?? '',
      MATCH_LABEL[r.matchStatus ?? ''] ?? (r.matchStatus ?? ''),
      VERDICT_LABEL[textV?.verdict ?? ''] ?? (textV?.verdict ?? ''),
      textV?.explanation ?? '',
      VERDICT_LABEL[interV?.verdict ?? ''] ?? (interV?.verdict ?? ''),
      interV?.explanation ?? '',
      VERDICT_LABEL[ctxV?.verdict ?? ''] ?? (ctxV?.verdict ?? ''),
      ctxV?.explanation ?? '',
      String(r.confidence ?? ''),
    ];

    return new TableRow({
      children: cells.map(
        (text) =>
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text })] })],
          }),
      ),
    });
  });

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            text: '引用核查报告',
            heading: HeadingLevel.HEADING_1,
          }),
          ...metaRows.map(
            (line) =>
              new Paragraph({
                children: [new TextRun({ text: line, size: 18, color: '666666' })],
              }),
          ),
          new Paragraph({ text: '' }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [headerRow, ...dataRows],
          }),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="quote-check-${report.task.displayId}.docx"`,
    },
  });
}
