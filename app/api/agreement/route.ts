import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { CURRENT_AGREEMENT_VERSION, hasAcceptedAgreement, recordAgreementAcceptance } from '@/lib/services/agreement';

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const accepted = await hasAcceptedAgreement(session.user.id);
  return NextResponse.json({ accepted, currentVersion: CURRENT_AGREEMENT_VERSION });
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { accepted?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: '无效 JSON' }, { status: 400 });
  }

  if (!body.accepted) {
    return NextResponse.json({ error: '必须接受协议才能使用服务' }, { status: 400 });
  }

  const role = (session.user as { role?: string }).role as 'B' | 'C' | 'admin' | undefined ?? 'C';
  const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined;
  const userAgent = req.headers.get('user-agent') ?? undefined;

  await recordAgreementAcceptance(session.user.id, role, ipAddress, userAgent);
  return NextResponse.json({ ok: true, version: CURRENT_AGREEMENT_VERSION });
}
