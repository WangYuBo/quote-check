import { NextResponse } from 'next/server';

import { withAdminAuth } from '@/lib/auth/admin-guard';
import { getDashboardStats, getTaskTrend } from '@/lib/services/admin';

export const GET = withAdminAuth(async () => {
  const [stats, trend] = await Promise.all([
    getDashboardStats(),
    getTaskTrend(30),
  ]);

  return NextResponse.json({ stats, trend });
});
