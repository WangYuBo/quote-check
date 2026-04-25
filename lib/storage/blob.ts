import { del, put } from '@vercel/blob';

async function uploadToBlob(
  path: string,
  buffer: Buffer,
  mimeType: string,
): Promise<{ url: string; pathname: string }> {
  const blob = await put(path, buffer, { access: 'private' as 'public', contentType: mimeType });
  return { url: blob.url, pathname: blob.pathname };
}

export async function uploadManuscriptBlob(
  filename: string,
  buffer: Buffer,
  mimeType: string,
): Promise<{ url: string; pathname: string }> {
  return uploadToBlob(`manuscripts/${Date.now()}-${filename}`, buffer, mimeType);
}

export async function uploadReferenceBlob(
  filename: string,
  buffer: Buffer,
  mimeType: string,
): Promise<{ url: string; pathname: string }> {
  return uploadToBlob(`references/${Date.now()}-${filename}`, buffer, mimeType);
}

export async function deleteBlobByUrl(url: string): Promise<void> {
  await del(url);
}
