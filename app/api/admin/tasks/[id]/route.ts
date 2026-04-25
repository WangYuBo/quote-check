import { NextRequest, NextResponse } from 'next/server';

import { withAdminAuth } from '@/lib/auth/admin-guard';
import { cancelTask } from '@/lib/services/admin';

export const PATCH = withAdminAuth(async (_admin, req, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const body = await req.json();

  if (body.action === 'cancel') {
    await cancelTask(id);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
});

export const dynamic = 'force-dynamic';
