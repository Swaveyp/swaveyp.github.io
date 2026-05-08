import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE } from './lib/ddb.mjs';
import { newBookingId, pkFor, SK, gsi1For } from './lib/ids.mjs';
import { parseDateOrTimeframe } from './lib/parse-date.mjs';
import { jsonResponse } from './lib/cors.mjs';
import { decorateImages } from './lib/s3.mjs';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function handler(event) {
  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return jsonResponse(400, { ok: false, error: 'Invalid JSON' }); }

  const fullName = (body.fullName || '').trim() ||
    `${(body.firstName || '').trim()} ${(body.lastName || '').trim()}`.trim();
  const email = (body.email || '').trim();
  const phone = (body.phone || '').trim();

  if (!fullName) return jsonResponse(400, { ok: false, error: 'Missing name' });
  if (!EMAIL_RE.test(email)) return jsonResponse(400, { ok: false, error: 'Invalid email' });
  if (!phone) return jsonResponse(400, { ok: false, error: 'Missing phone' });

  // Validate inspirationImages: array of {key, name, contentType, size}, max 6.
  let inspirationImages = [];
  if (Array.isArray(body.inspirationImages)) {
    if (body.inspirationImages.length > 6) {
      return jsonResponse(400, { ok: false, error: 'Too many inspiration images (max 6)' });
    }
    inspirationImages = body.inspirationImages
      .filter(img => img && typeof img === 'object' && typeof img.key === 'string' && img.key.startsWith('inspiration/'))
      .map(img => ({
        key:         String(img.key),
        name:        String(img.name || '').slice(0, 200),
        contentType: String(img.contentType || ''),
        size:        Number(img.size) || 0
      }));
  }

  const id = newBookingId();
  const pk = pkFor(id);
  const submittedAt = new Date().toISOString();
  const eventDate = parseDateOrTimeframe(body.dateOrTimeframe || body.dateValue);
  const status = 'pending';

  const item = {
    pk,
    sk: SK,
    id,
    type: 'photoshoot',
    status,
    submittedAt,
    eventDate,
    // form fields
    firstName:        body.firstName || '',
    lastName:         body.lastName || '',
    fullName,
    email,
    phone,
    shootType:        body.shootType || '',
    dateOrTimeframe:  body.dateOrTimeframe || body.dateValue || '',
    timeOfDay:        body.timeOfDay || '',
    location:         body.location || body.locationPref || '',
    locationName:     body.locationName || '',
    locationAddress:  body.locationAddress || '',
    numberOfPeople:   body.numberOfPeople || body.peopleCount || '',
    budget:           body.budget || '',
    workedBefore:     body.workedBefore || body.priorExperience || '',
    heardAbout:       body.heardAbout || body.referral || '',
    inspirationLinks: body.inspirationLinks || '',
    inspirationImages,
    vision:           body.vision || '',
    additionalDetails: body.additionalDetails || '',
    shootSpecific:    body.shootSpecific || {},
    // request metadata
    sourceIp:  event.requestContext?.http?.sourceIp || '',
    userAgent: event.headers?.['user-agent'] || event.headers?.['User-Agent'] || '',
    ...gsi1For(status, submittedAt, pk)
  };

  await ddb.send(new PutCommand({
    TableName: TABLE,
    Item: item,
    ConditionExpression: 'attribute_not_exists(pk)'
  }));

  // Fire admin-notify email — failures must not break the user submission.
  try {
    const decorated = await decorateImages(item);
    await fetch(process.env.EMAIL_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: process.env.EMAIL_SCRIPT_SHARED_SECRET,
        kind: 'photoshoot-admin-notify',
        to: ['support@swavey.biz'],
        replyTo: email,
        data: decorated,
        calendar: null
      })
    });
  } catch (err) {
    console.error('email-fire failed (photoshoot admin-notify):', err);
  }

  return jsonResponse(200, { ok: true, id });
}
