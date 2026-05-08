import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const REGION = process.env.AWS_REGION || 'us-east-1';

export const s3 = new S3Client({ region: REGION });
export const BUCKET = process.env.INSPIRATION_BUCKET;

// Presigned PUT — the signed URL pins Content-Type and Content-Length so a
// client can't swap in a giant file or different MIME after we vetted it.
export async function presignPut(key, contentType, contentLength, expiresInSeconds = 300) {
  const cmd = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
    ContentLength: contentLength
  });
  return getSignedUrl(s3, cmd, { expiresIn: expiresInSeconds });
}

export async function presignGet(key, expiresInSeconds = 3600) {
  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3, cmd, { expiresIn: expiresInSeconds });
}

// Decorate a record's inspirationImages with viewUrl. Mutates a cloned copy,
// not the input. If no images, returns the record unchanged.
export async function decorateInspiration(record, expiresInSeconds = 3600) {
  const imgs = record && record.inspirationImages;
  if (!Array.isArray(imgs) || imgs.length === 0) return record;
  const decorated = await Promise.all(imgs.map(async (img) => {
    if (!img || !img.key) return img;
    try {
      const viewUrl = await presignGet(img.key, expiresInSeconds);
      return { ...img, viewUrl };
    } catch (err) {
      console.error('presignGet failed for', img.key, err);
      return img;
    }
  }));
  return { ...record, inspirationImages: decorated };
}
