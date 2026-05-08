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

// Decorate any image-array fields on a record with viewUrl. Walks both
// inspirationImages (photoshoot) and designImages (apparel). Returns a
// shallow-cloned record; the input is not mutated.
const IMAGE_FIELDS = ['inspirationImages', 'designImages'];

async function decorateOne(img, expiresInSeconds) {
  if (!img || !img.key) return img;
  try {
    const viewUrl = await presignGet(img.key, expiresInSeconds);
    return { ...img, viewUrl };
  } catch (err) {
    console.error('presignGet failed for', img.key, err);
    return img;
  }
}

export async function decorateImages(record, expiresInSeconds = 3600) {
  if (!record) return record;
  const out = { ...record };
  for (const field of IMAGE_FIELDS) {
    const imgs = record[field];
    if (!Array.isArray(imgs) || imgs.length === 0) continue;
    out[field] = await Promise.all(imgs.map(img => decorateOne(img, expiresInSeconds)));
  }
  return out;
}
