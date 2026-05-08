import { GetCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE } from './lib/ddb.mjs';
import { verifyPassword } from './lib/auth.mjs';
import { gsi1For, gsi2For, pkFor, SK } from './lib/ids.mjs';
import { parseDateOrTimeframe } from './lib/parse-date.mjs';
import { jsonResponse } from './lib/cors.mjs';
import { decorateImages } from './lib/s3.mjs';

async function decorateForResponse(record) {
  if (!record) return record;
  const { gsi1pk, gsi1sk, gsi2pk, gsi2sk, ...clean } = record;
  return decorateImages(clean);
}

const EDITABLE_FIELDS = new Set([
  'firstName', 'lastName', 'fullName', 'email', 'phone',
  'shootType', 'dateOrTimeframe', 'timeOfDay', 'location', 'locationName', 'locationAddress',
  'numberOfPeople', 'budget', 'workedBefore', 'heardAbout',
  'inspirationLinks', 'vision', 'additionalDetails',
  'shootSpecific', 'adminNotes',
  'inquiry', 'details', 'shipping', 'address', 'city', 'state', 'zip',
  'scheduledType', 'scheduledAtISO', 'scheduledAtHuman', 'finalPrice'
]);

function adminPwd(event) {
  const h = event.headers || {};
  return h['x-admin-password'] || h['X-Admin-Password'];
}

async function fireEmail(payload) {
  try {
    await fetch(process.env.EMAIL_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.error('email-fire failed:', err);
  }
}

function buildCalendar(record) {
  // Photoshoot uses scheduledAtISO (admin sets) or eventDate fallback.
  const startISO = record.scheduledAtISO ||
    (record.eventDate ? `${record.eventDate}T19:00:00.000Z` : null);
  if (!startISO) return null;

  const start = new Date(startISO);
  if (isNaN(start.getTime())) return null;

  let durationMin;
  if (record.type === 'photoshoot') {
    durationMin = 90;
  } else {
    durationMin = (record.scheduledType === 'Delivery') ? 60 : 30;
  }
  const end = new Date(start.getTime() + durationMin * 60 * 1000);

  if (record.type === 'photoshoot') {
    const addr = (record.locationAddress || record.location || '').trim();
    return {
      title: `Swavey ${record.shootType || 'Photoshoot'}`,
      startISO: start.toISOString(),
      endISO: end.toISOString(),
      location: addr,
      description: `${record.shootType || 'Photoshoot'} session with Swavey · ${record.numberOfPeople || ''} people · contact support@swavey.biz`.trim()
    };
  }

  const addr = [record.address, record.city, record.state, record.zip].filter(Boolean).join(', ') ||
    'Local pickup — TBD';
  const which = (record.scheduledType === 'Delivery') ? 'delivery' : 'pickup';
  return {
    title: `Swavey ${record.scheduledType === 'Delivery' ? 'Delivery' : 'Pickup'}`,
    startISO: start.toISOString(),
    endISO: end.toISOString(),
    location: addr,
    description: `${record.inquiry || 'Apparel'} ${which} with Swavey · contact support@swavey.biz`
  };
}

export async function handler(event) {
  if (!verifyPassword(adminPwd(event), process.env.ADMIN_PASSWORD_HASH)) {
    return jsonResponse(401, { ok: false, error: 'Unauthorized' });
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return jsonResponse(400, { ok: false, error: 'Invalid JSON' }); }

  const id = body.id;
  const action = body.action;
  if (!id || !action) return jsonResponse(400, { ok: false, error: 'Missing id or action' });

  const pk = pkFor(id);
  const get = await ddb.send(new GetCommand({ TableName: TABLE, Key: { pk, sk: SK } }));
  const record = get.Item;
  if (!record) return jsonResponse(404, { ok: false, error: 'Not found' });

  if (action === 'delete') {
    await ddb.send(new DeleteCommand({ TableName: TABLE, Key: { pk, sk: SK } }));
    return jsonResponse(200, { ok: true });
  }

  // Apply edits (whitelisted) for approve / edit
  const edits = body.updates || {};
  const setNames = {};
  const setValues = {};
  const setExprs = [];
  for (const [k, v] of Object.entries(edits)) {
    if (!EDITABLE_FIELDS.has(k)) continue;
    setNames[`#${k}`] = k;
    setValues[`:${k}`] = v;
    setExprs.push(`#${k} = :${k}`);
  }

  // Re-derive eventDate from any updated date hint
  let mergedEventDate = record.eventDate || '';
  if (edits.scheduledAtISO) {
    mergedEventDate = String(edits.scheduledAtISO).slice(0, 10);
  } else if (edits.dateOrTimeframe) {
    mergedEventDate = parseDateOrTimeframe(edits.dateOrTimeframe);
  }

  const now = new Date().toISOString();
  const merged = { ...record, ...edits, eventDate: mergedEventDate };

  if (action === 'approve') {
    merged.status = 'confirmed';
    merged.confirmedAt = now;
    setNames['#status'] = 'status';
    setValues[':status'] = 'confirmed';
    setExprs.push('#status = :status');
    setNames['#confirmedAt'] = 'confirmedAt';
    setValues[':confirmedAt'] = now;
    setExprs.push('#confirmedAt = :confirmedAt');
    setNames['#eventDate'] = 'eventDate';
    setValues[':eventDate'] = mergedEventDate;
    setExprs.push('#eventDate = :eventDate');

    const g1 = gsi1For('confirmed', record.submittedAt, pk);
    setNames['#g1pk'] = 'gsi1pk'; setNames['#g1sk'] = 'gsi1sk';
    setValues[':g1pk'] = g1.gsi1pk; setValues[':g1sk'] = g1.gsi1sk;
    setExprs.push('#g1pk = :g1pk', '#g1sk = :g1sk');

    const g2 = gsi2For(record.type, mergedEventDate, pk);
    let removeExpr = '';
    if (g2) {
      setNames['#g2pk'] = 'gsi2pk'; setNames['#g2sk'] = 'gsi2sk';
      setValues[':g2pk'] = g2.gsi2pk; setValues[':g2sk'] = g2.gsi2sk;
      setExprs.push('#g2pk = :g2pk', '#g2sk = :g2sk');
    } else {
      removeExpr = ' REMOVE gsi2pk, gsi2sk';
    }

    await ddb.send(new UpdateCommand({
      TableName: TABLE,
      Key: { pk, sk: SK },
      UpdateExpression: 'SET ' + setExprs.join(', ') + removeExpr,
      ExpressionAttributeNames: setNames,
      ExpressionAttributeValues: setValues
    }));

    const calendar = buildCalendar(merged);
    const recipients = [merged.email, 'support@swavey.biz'].filter(Boolean);
    await fireEmail({
      secret: process.env.EMAIL_SCRIPT_SHARED_SECRET,
      kind: merged.type === 'photoshoot' ? 'photoshoot-confirmation' : 'apparel-confirmation',
      to: recipients,
      replyTo: 'support@swavey.biz',
      data: merged,
      calendar
    });
    return jsonResponse(200, { ok: true, record: await decorateForResponse(merged) });
  }

  if (action === 'edit') {
    if (!setExprs.length) return jsonResponse(400, { ok: false, error: 'No editable fields' });
    setNames['#eventDate'] = 'eventDate';
    setValues[':eventDate'] = mergedEventDate;
    setExprs.push('#eventDate = :eventDate');

    // If currently confirmed, also keep gsi2 in sync with new eventDate
    let removeExpr = '';
    if (record.status === 'confirmed') {
      const g2 = gsi2For(record.type, mergedEventDate, pk);
      if (g2) {
        setNames['#g2pk'] = 'gsi2pk'; setNames['#g2sk'] = 'gsi2sk';
        setValues[':g2pk'] = g2.gsi2pk; setValues[':g2sk'] = g2.gsi2sk;
        setExprs.push('#g2pk = :g2pk', '#g2sk = :g2sk');
      } else {
        removeExpr = ' REMOVE gsi2pk, gsi2sk';
      }
    }
    await ddb.send(new UpdateCommand({
      TableName: TABLE,
      Key: { pk, sk: SK },
      UpdateExpression: 'SET ' + setExprs.join(', ') + removeExpr,
      ExpressionAttributeNames: setNames,
      ExpressionAttributeValues: setValues
    }));

    if (body.sendEmail && record.status === 'confirmed') {
      const calendar = buildCalendar(merged);
      const recipients = [merged.email, 'support@swavey.biz'].filter(Boolean);
      await fireEmail({
        secret: process.env.EMAIL_SCRIPT_SHARED_SECRET,
        kind: merged.type === 'photoshoot' ? 'photoshoot-confirmation' : 'apparel-confirmation',
        to: recipients,
        replyTo: 'support@swavey.biz',
        data: merged,
        calendar
      });
    }
    return jsonResponse(200, { ok: true, record: await decorateForResponse(merged) });
  }

  if (action === 'deny') {
    const g1 = gsi1For('denied', record.submittedAt, pk);
    const exprNames = {
      '#status': 'status', '#deniedAt': 'deniedAt',
      '#g1pk': 'gsi1pk', '#g1sk': 'gsi1sk'
    };
    const exprValues = {
      ':status': 'denied', ':deniedAt': now,
      ':g1pk': g1.gsi1pk, ':g1sk': g1.gsi1sk
    };
    const setParts = ['#status = :status', '#deniedAt = :deniedAt', '#g1pk = :g1pk', '#g1sk = :g1sk'];
    if (typeof edits.adminNotes === 'string') {
      exprNames['#adminNotes'] = 'adminNotes';
      exprValues[':adminNotes'] = edits.adminNotes;
      setParts.push('#adminNotes = :adminNotes');
    }
    await ddb.send(new UpdateCommand({
      TableName: TABLE,
      Key: { pk, sk: SK },
      UpdateExpression: 'SET ' + setParts.join(', ') + ' REMOVE gsi2pk, gsi2sk',
      ExpressionAttributeNames: exprNames,
      ExpressionAttributeValues: exprValues
    }));
    if (body.sendEmail) {
      await fireEmail({
        secret: process.env.EMAIL_SCRIPT_SHARED_SECRET,
        kind: record.type === 'photoshoot' ? 'photoshoot-decline' : 'apparel-decline',
        to: [record.email].filter(Boolean),
        replyTo: 'support@swavey.biz',
        data: { ...record, adminNotes: edits.adminNotes || record.adminNotes || '' },
        calendar: null
      });
    }
    return jsonResponse(200, { ok: true });
  }

  if (action === 'archive') {
    const g1 = gsi1For('archived', record.submittedAt, pk);
    await ddb.send(new UpdateCommand({
      TableName: TABLE,
      Key: { pk, sk: SK },
      UpdateExpression: 'SET #status = :status, #archivedAt = :archivedAt, #g1pk = :g1pk, #g1sk = :g1sk REMOVE gsi2pk, gsi2sk',
      ExpressionAttributeNames: {
        '#status': 'status', '#archivedAt': 'archivedAt',
        '#g1pk': 'gsi1pk', '#g1sk': 'gsi1sk'
      },
      ExpressionAttributeValues: {
        ':status': 'archived', ':archivedAt': now,
        ':g1pk': g1.gsi1pk, ':g1sk': g1.gsi1sk
      }
    }));
    return jsonResponse(200, { ok: true });
  }

  return jsonResponse(400, { ok: false, error: 'Unknown action: ' + action });
}
