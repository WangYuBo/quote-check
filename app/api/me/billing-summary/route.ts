/**
 * A22 账户摘要带 — GET /api/me/billing-summary
 *
 * 返回：本月费用 + 累计费用 + 运行中任务数
 * 数据源：task.cost_actual_fen（字数公式，非 api_call）
 */
import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/guard';
import { getBillingSummary } from '@/lib/services/dashboard';

export const GET = withAuth(async (user) => {
  const summary = await getBillingSummary(user.id);
  return NextResponse.json(summary);
});
