import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@/lib/db';
import { reference, referenceParagraph } from '@/lib/db/schema';
import { normalizeForCompare, stripForTrigram } from '@/lib/text/normalize';
import type { ParsedParagraph } from '@/lib/parsers/manuscript';
import type { NewReference, Reference } from '@/lib/db/types';

function shortId(): string {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

export async function createReference(
  values: Omit<NewReference, 'displayId'>,
): Promise<Reference> {
  const [row] = await db
    .insert(reference)
    .values({ ...values, displayId: `R-${shortId()}` })
    .returning();
  if (!row) throw new Error('reference insert failed');
  return row;
}

export async function saveReferenceParagraphs(
  referenceId: string,
  paragraphs: ParsedParagraph[],
): Promise<void> {
  if (paragraphs.length === 0) return;
  const rows = paragraphs.map((p) => ({
    referenceId,
    seq: p.seq,
    displayId: `RP-${shortId()}`,
    text: p.text,
    textNormalized: stripForTrigram(normalizeForCompare(p.text, 'simplified')),
    textHash: Buffer.from(p.text).toString('base64').slice(0, 64),
  }));
  await db.insert(referenceParagraph).values(rows);
}

export async function markReferenceParsed(id: string, charCount: number): Promise<void> {
  await db.update(reference).set({ charCount, parsedAt: new Date() }).where(eq(reference.id, id));
}

export async function getReference(id: string): Promise<Reference | undefined> {
  return db.query.reference.findFirst({ where: eq(reference.id, id) });
}

export async function listUserReferences(userId: string): Promise<Reference[]> {
  return db
    .select()
    .from(reference)
    .where(and(eq(reference.userId, userId), isNull(reference.deletedAt)));
}
