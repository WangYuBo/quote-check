import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { parseManuscript } from '@/lib/parsers/manuscript';
import {
  createReference,
  listUserReferences,
  markReferenceParsed,
  saveReferenceParagraphs,
} from '@/lib/services/reference';
import { uploadReferenceBlob } from '@/lib/storage/blob';

const ALLOWED_MIME = new Set([
  'text/plain',
  'text/markdown',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const MAX_SIZE = 20 * 1024 * 1024;
const ALLOWED_ROLES = new Set(['CANON', 'ANNOTATED', 'TRANSLATED', 'TOOL', 'OTHER'] as const);

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: '无法解析 form-data' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: '缺少 file 字段' }, { status: 400 });
  }

  const canonicalName = (formData.get('canonicalName') as string | null)?.trim();
  if (!canonicalName) {
    return NextResponse.json({ error: '缺少 canonicalName' }, { status: 400 });
  }

  const roleRaw = (formData.get('role') as string | null) ?? 'CANON';
  if (!ALLOWED_ROLES.has(roleRaw as 'CANON')) {
    return NextResponse.json({ error: `无效 role：${roleRaw}` }, { status: 422 });
  }
  const role = roleRaw as 'CANON' | 'ANNOTATED' | 'TRANSLATED' | 'TOOL' | 'OTHER';

  const copyrightDeclared = formData.get('copyrightDeclared') === 'true';
  if (!copyrightDeclared) {
    return NextResponse.json({ error: '请勾选版权声明后再上传参考文献' }, { status: 422 });
  }

  const mimeType = file.type || 'text/plain';
  if (!ALLOWED_MIME.has(mimeType) && !file.name.match(/\.(txt|md|docx)$/i)) {
    return NextResponse.json(
      { error: `不支持的格式：${mimeType}。支持 .txt / .md / .docx` },
      { status: 422 },
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: '文件超过 20MB 上限' }, { status: 422 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const contentHash = Buffer.from(
    await crypto.subtle.digest('SHA-256', buffer),
  )
    .toString('hex')
    .slice(0, 64);

  let parsed;
  try {
    parsed = await parseManuscript(buffer, mimeType, file.name);
  } catch (err) {
    return NextResponse.json(
      { error: `解析失败：${err instanceof Error ? err.message : String(err)}` },
      { status: 422 },
    );
  }

  const { url, pathname } = await uploadReferenceBlob(file.name, buffer, mimeType);

  const ref = await createReference({
    userId: session.user.id,
    canonicalName,
    role,
    filename: file.name,
    mimeType,
    fileSize: file.size,
    blobUrl: url,
    blobPathname: pathname,
    contentHash,
    copyrightDeclaredBy: session.user.id,
    copyrightDeclaredAt: new Date(),
  });

  await saveReferenceParagraphs(ref.id, parsed.paragraphs);
  await markReferenceParsed(ref.id, parsed.charCount);

  return NextResponse.json({
    referenceId: ref.id,
    displayId: ref.displayId,
    canonicalName: ref.canonicalName,
    paragraphCount: parsed.paragraphs.length,
    charCount: parsed.charCount,
  });
}

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const refs = await listUserReferences(session.user.id);
  return NextResponse.json({
    references: refs.map((r) => ({
      referenceId: r.id,
      displayId: r.displayId,
      canonicalName: r.canonicalName,
      versionLabel: r.versionLabel,
      role: r.role,
      filename: r.filename,
      charCount: r.charCount,
      createdAt: r.createdAt,
    })),
  });
}
