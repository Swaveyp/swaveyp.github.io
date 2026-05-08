import crypto from 'node:crypto';
import { presignPut } from './lib/s3.mjs';
import { jsonResponse } from './lib/cors.mjs';

const CONTENT_TYPE_RE = /^image\/(jpeg|jpg|png|heic|heif|webp|gif)$/;
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const EXPIRES = 300; // 5 minutes

export async function handler(event) {
  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return jsonResponse(400, { ok: false, error: 'Invalid JSON' }); }

  const filename = typeof body.filename === 'string' ? body.filename : '';
  const contentType = typeof body.contentType === 'string' ? body.contentType.toLowerCase() : '';
  const size = Number(body.size);

  if (!filename || filename.length < 1 || filename.length > 200) {
    return jsonResponse(400, { ok: false, error: 'Invalid filename' });
  }
  if (!CONTENT_TYPE_RE.test(contentType)) {
    return jsonResponse(400, { ok: false, error: 'Unsupported content type' });
  }
  if (!Number.isFinite(size) || size <= 0 || size > MAX_BYTES) {
    return jsonResponse(400, { ok: false, error: 'Invalid size' });
  }

  const key = `inspiration/${crypto.randomUUID()}`;

  let url;
  try {
    url = await presignPut(key, contentType, size, EXPIRES);
  } catch (err) {
    console.error('presignPut failed:', err);
    return jsonResponse(500, { ok: false, error: 'Could not presign upload' });
  }

  return jsonResponse(200, { ok: true, key, url, expiresInSeconds: EXPIRES });
}
