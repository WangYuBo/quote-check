import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { parseManuscript } from '@/lib/parsers/manuscript';
import { createManuscript, markManuscriptParsed, saveParagraphs } from '@/lib/services/manuscript';
import { uploadManuscriptBlob } from '@/lib/storage/blob';

const ALLOWED_MIME = new Set([
  'text/plain',
  'text/markdown',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const MAX_SIZE = 20 * 1024 * 1024; // 20 MB

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

  const mimeType = file.type || 'text/plain';
  if (!ALLOWED_MIME.has(mimeType) && !file.name.match(/\.(txt|md|docx)$/i)) {
    return NextResponse.json(
      { error: `不支持的格式：${mimeType}。支持 .txt / .md / .docx` },
      { status: 422 },
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: `文件超过 20MB 上限` }, { status: 422 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // 1. 解析段落（先做，失败就不上传 Blob）
  let parsed;
  try {
    parsed = await parseManuscript(buffer, mimeType, file.name);
  } catch (err) {
    return NextResponse.json(
      { error: `解析失败：${err instanceof Error ? err.message : String(err)}` },
      { status: 422 },
    );
  }

  // 2. 上传到 Vercel Blob（本地开发 / token 无效时跳过）
  let url = `local://manuscripts/${Date.now()}-${file.name}`;
  let pathname = url;
  const blobToken = process.env['BLOB_READ_WRITE_TOKEN'] ?? '';
  if (!blobToken.includes('placeholder') && process.env['NODE_ENV'] !== 'development') {
    const uploaded = await uploadManuscriptBlob(file.name, buffer, mimeType);
    url = uploaded.url;
    pathname = uploaded.pathname;
  }

  // 3. 落库 manuscript
  const doc = await createManuscript({
    userId: session.user.id,
    filename: file.name,
    mimeType,
    fileSize: file.size,
    blobUrl: url,
    blobPathname: pathname,
  });

  // 4. 落库 paragraph 行
  await saveParagraphs(doc.id, parsed.paragraphs);
  await markManuscriptParsed(doc.id, parsed.charCount);

  return NextResponse.json({
    manuscriptId: doc.id,
    displayId: doc.displayId,
    filename: file.name,
    paragraphCount: parsed.paragraphs.length,
    charCount: parsed.charCount,
  });
}
