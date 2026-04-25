import { createHash } from 'crypto';
import { and, desc, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { user, userAgreementAcceptance } from '@/lib/db/schema';

export const CURRENT_AGREEMENT_VERSION = 'v1.0-2026-04';

/** 检查用户是否已接受当前版本协议 */
export async function hasAcceptedAgreement(userId: string): Promise<boolean> {
  const row = await db.query.userAgreementAcceptance.findFirst({
    where: and(
      eq(userAgreementAcceptance.userId, userId),
      eq(userAgreementAcceptance.agreementVersion, CURRENT_AGREEMENT_VERSION),
    ),
    orderBy: desc(userAgreementAcceptance.acceptedAt),
  });
  return !!row;
}

/** 记录协议签署（append-only，T-05 触发器兜底） */
export async function recordAgreementAcceptance(
  userId: string,
  role: 'B' | 'C' | 'admin',
  ipAddress?: string,
  userAgent?: string,
): Promise<void> {
  const checksum = createHash('sha256')
    .update(`${userId}:${CURRENT_AGREEMENT_VERSION}:${role}`)
    .digest('hex')
    .slice(0, 64);

  await db.insert(userAgreementAcceptance).values({
    userId,
    agreementVersion: CURRENT_AGREEMENT_VERSION,
    agreementRole: role,
    checksum,
    ...(ipAddress && { ipAddress }),
    ...(userAgent && { userAgent }),
  });

  // 同步更新 user.agreementVersion（便于 session 快速校验）
  await db.update(user).set({
    agreementVersion: CURRENT_AGREEMENT_VERSION,
    agreementAcceptedAt: new Date(),
  }).where(eq(user.id, userId));
}
