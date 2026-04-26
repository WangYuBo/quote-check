import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

import { cosClient } from './cos';
import { env } from '@/lib/env';

const BUCKET = env.COS_BUCKET;

async function uploadToBlob(
  path: string,
  buffer: Buffer,
  mimeType: string,
): Promise<{ url: string; pathname: string }> {
  await cosClient.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: path,
      Body: buffer,
      ContentType: mimeType,
    }),
  );
  const url = `https://${BUCKET}.cos.${env.COS_BUCKET_REGION}.myqcloud.com/${path}`;
  return { url, pathname: path };
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
  const key = url.split('.myqcloud.com/')[1];
  if (!key) return;
  await cosClient.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}
