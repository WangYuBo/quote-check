import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { manuscript, paragraph } from '@/lib/db/schema';
import type { Manuscript, NewManuscript, NewParagraph } from '@/lib/db/types';
import type { ParsedParagraph } from '@/lib/parsers/manuscript';

function shortId(): string {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

export async function createManuscript(
  values: Omit<NewManuscript, 'displayId' | 'id'>,
): Promise<Manuscript> {
  const [row] = await db
    .insert(manuscript)
    .values({ ...values, displayId: `M-${shortId()}` })
    .returning();
  if (!row) throw new Error('manuscript insert failed');
  return row;
}

export async function saveParagraphs(
  manuscriptId: string,
  paragraphs: ParsedParagraph[],
): Promise<void> {
  if (paragraphs.length === 0) return;
  const rows: NewParagraph[] = paragraphs.map((p) => ({
    manuscriptId,
    seq: p.seq,
    displayId: `P-${shortId()}`,
    text: p.text,
    textHash: Buffer.from(p.text).toString('base64').slice(0, 64),
    hasQuote: false,
  }));
  await db.insert(paragraph).values(rows);
}

export async function markManuscriptParsed(id: string, charCount: number): Promise<void> {
  await db.update(manuscript).set({ charCount, parsedAt: new Date() }).where(eq(manuscript.id, id));
}

export async function getManuscript(id: string): Promise<Manuscript | undefined> {
  return db.query.manuscript.findFirst({ where: eq(manuscript.id, id) });
}
