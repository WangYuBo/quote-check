import { del, put } from '@vercel/blob';

export async function uploadManuscriptBlob(
  filename: string,
  buffer: Buffer,
  mimeType: string,
): Promise<{ url: string; pathname: string }> {
  const blob = await put(`manuscripts/${Date.now()}-${filename}`, buffer, {
    access: 'public',
    contentType: mimeType,
  });
  return { url: blob.url, pathname: blob.pathname };
}

export async function deleteBlobByUrl(url: string): Promise<void> {
  await del(url);
}
