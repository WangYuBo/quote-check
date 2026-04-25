import { NextRequest, NextResponse } from 'next/server';

import { withAdminAuth } from '@/lib/auth/admin-guard';
import { updateUser } from '@/lib/services/admin';

export const PATCH = withAdminAuth(async (_admin, req, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const body = await req.json();

  const updateData: { role?: string; suspendedAt?: Date | null } = {};
  if (body.role) updateData.role = body.role;
  if (body.suspended !== undefined) {
    updateData.suspendedAt = body.suspended ? new Date() : null;
  }

  await updateUser(id, updateData);
  return NextResponse.json({ success: true });
});

export const dynamic = 'force-dynamic';
