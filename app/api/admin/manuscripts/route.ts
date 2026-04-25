import { NextRequest, NextResponse } from 'next/server';

import { withAdminAuth } from '@/lib/auth/admin-guard';
import { listManuscripts } from '@/lib/services/admin';

export const GET = withAdminAuth(async (_admin, req) => {
  const url = new URL(req.url);
  const q = url.searchParams.get('q') ?? undefined;
  const from = url.searchParams.get('from') ?? undefined;
  const to = url.searchParams.get('to') ?? undefined;
  const page = Number(url.searchParams.get('page') ?? '1');

  const result = await listManuscripts({ q, from, to, page, pageSize: 20 });
  return NextResponse.json(result);
});
