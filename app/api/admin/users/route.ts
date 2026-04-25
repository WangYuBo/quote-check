import { NextRequest, NextResponse } from 'next/server';

import { withAdminAuth } from '@/lib/auth/admin-guard';
import { listUsers } from '@/lib/services/admin';

export const GET = withAdminAuth(async (_admin, req) => {
  const url = new URL(req.url);
  const role = url.searchParams.get('role') ?? undefined;
  const status = url.searchParams.get('status') ?? undefined;
  const q = url.searchParams.get('q') ?? undefined;
  const page = Number(url.searchParams.get('page') ?? '1');

  const result = await listUsers({ role, status, q, page, pageSize: 20 });
  return NextResponse.json(result);
});
