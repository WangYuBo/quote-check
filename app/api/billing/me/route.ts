/**
 * A23 字数结算明细 — GET /api/billing/me?groupBy=month|task
 *
 * 用户结算按字数公式：ceil(charCount/1000) × ¥3/千字
 * 数据源：task.cost_actual_fen（非 api_call）
 *
 * 查询参数：
 *   groupBy: 'month' | 'task'（默认 month）
 *   from: ISO 日期（默认 月初）
 *   to: ISO 日期（默认 今）
 */
import { NextRequest, NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/guard';
import { getUserBillingRange } from '@/lib/billing/aggregator';
import { formatFenAsYuan } from '@/lib/billing/pricing';

export const GET = withAuth(async (user, req) => {
  const { searchParams } = new URL(req.url);
  const groupBy = (searchParams.get('groupBy') as 'month' | 'task') ?? 'month';
  const fromStr = searchParams.get('from');
  const toStr = searchParams.get('to');

  const now = new Date();
  const from = fromStr ? new Date(fromStr) : new Date(now.getFullYear(), now.getMonth(), 1);
  const to = toStr ? new Date(toStr) : now;

  if (groupBy !== 'month' && groupBy !== 'task') {
    return NextResponse.json(
      { errorCode: 'VALIDATION_ERROR', detail: 'groupBy must be "month" or "task"' },
      { status: 400 },
    );
  }

  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    return NextResponse.json(
      { errorCode: 'VALIDATION_ERROR', detail: 'Invalid date format' },
      { status: 400 },
    );
  }

  const range = await getUserBillingRange(user.id, from, to, groupBy);

  return NextResponse.json({
    summary: {
      totalFen: range.totalFen,
      totalDisplay: formatFenAsYuan(range.totalFen),
    },
    breakdown: range.breakdown.map((r) => ({
      period: r.period,
      type: r.type,
      costFen: r.costFen,
      costDisplay: formatFenAsYuan(r.costFen),
    })),
  });
});
