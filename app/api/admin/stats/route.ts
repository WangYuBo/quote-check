import { NextResponse } from 'next/server';

import { withAdminAuth } from '@/lib/auth/admin-guard';
import { getDashboardStats, getTaskTrend } from '@/lib/services/admin';

export const GET = withAdminAuth(async () => {
  try {
    const [stats, trend] = await Promise.all([
      getDashboardStats(),
      getTaskTrend(30),
    ]);
    return NextResponse.json({ stats, trend });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
});
