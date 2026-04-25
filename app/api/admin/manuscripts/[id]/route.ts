import { NextRequest, NextResponse } from 'next/server';

import { withAdminAuth } from '@/lib/auth/admin-guard';
import { destroyManuscript } from '@/lib/services/admin';

export const DELETE = withAdminAuth(async (_admin, _req, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  await destroyManuscript(id);
  return NextResponse.json({ success: true });
});

export const dynamic = 'force-dynamic';
