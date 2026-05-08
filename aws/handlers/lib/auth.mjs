import crypto from 'node:crypto';

export function verifyPassword(plain, expectedHash) {
  if (!plain || !expectedHash) return false;
  const got = crypto.createHash('sha256').update(plain).digest('hex');
  const a = Buffer.from(got);
  const b = Buffer.from(expectedHash);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
