import { S3Client } from '@aws-sdk/client-s3';

import { env } from '@/lib/env';

export const cosClient = new S3Client({
  region: env.COS_BUCKET_REGION,
  endpoint: `https://cos.${env.COS_BUCKET_REGION}.myqcloud.com`,
  credentials: {
    accessKeyId: env.COS_SECRET_ID,
    secretAccessKey: env.COS_SECRET_KEY,
  },
  forcePathStyle: false,
});
