import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE } from './lib/ddb.mjs';
import { verifyPassword } from './lib/auth.mjs';
import { todayUtc } from './lib/parse-date.mjs';
import { jsonResponse } from './lib/cors.mjs';
import { decorateImages } from './lib/s3.mjs';

// GET /admin/list?type=photoshoot|apparel|all&view=pending|upcoming|past|denied|archived
export async function handler(event) {
  const headers = event.headers || {};
  const pwd = headers['x-admin-password'] || headers['X-Admin-Password'];
  if (!verifyPassword(pwd, process.env.ADMIN_PASSWORD_HASH)) {
    return jsonResponse(401, { ok: false, error: 'Unauthorized' });
  }

  const qs = event.queryStringParameters || {};
  const view = (qs.view || 'pending').toLowerCase();
  const type = (qs.type || 'all').toLowerCase();

  const types = (type === 'all') ? ['photoshoot', 'apparel'] : [type];
  const items = [];

  for (const t of types) {
    if (view === 'upcoming' || view === 'past') {
      const today = todayUtc();
      const params = {
        TableName: TABLE,
        IndexName: 'UpcomingIndex',
        KeyConditionExpression: '#pk = :pk AND #sk ' + (view === 'upcoming' ? '>= :today' : '< :today'),
        ExpressionAttributeNames: { '#pk': 'gsi2pk', '#sk': 'gsi2sk' },
        ExpressionAttributeValues: {
          ':pk':   `STATUS#confirmed#TYPE#${t}`,
          ':today': today
        },
        ScanIndexForward: view === 'upcoming'
      };
      const out = await ddb.send(new QueryCommand(params));
      (out.Items || []).forEach(it => items.push(it));
    } else {
      // pending / denied / archived / confirmed (catch-all)
      const status = (view === 'archived') ? 'archived' :
                     (view === 'denied') ? 'denied' :
                     (view === 'confirmed') ? 'confirmed' : 'pending';
      const params = {
        TableName: TABLE,
        IndexName: 'StatusIndex',
        KeyConditionExpression: '#pk = :pk',
        ExpressionAttributeNames: { '#pk': 'gsi1pk' },
        ExpressionAttributeValues: { ':pk': `STATUS#${status}` },
        ScanIndexForward: false
      };
      const out = await ddb.send(new QueryCommand(params));
      (out.Items || []).filter(it => !type || type === 'all' || it.type === t)
        .forEach(it => items.push(it));
    }
  }

  // Strip internal keys from response and decorate any image-array fields
  // (inspirationImages, designImages) with short-lived presigned GET URLs
  // so the admin UI can render them.
  const cleaned = await Promise.all(items.map(async (it) => {
    const { gsi1pk, gsi1sk, gsi2pk, gsi2sk, ...rest } = it;
    return decorateImages(rest);
  }));

  return jsonResponse(200, { ok: true, items: cleaned });
}
