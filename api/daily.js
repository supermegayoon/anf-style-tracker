import { dailySince } from '../lib/store.js';
import { send } from '../lib/http.js';

export default async function handler(req, res) {
  const since = new URL(req.url, 'http://x').searchParams.get('since') || '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(since)) return send(res, 400, { ok: false, error: 'bad_since' });
  try { return send(res, 200, { ok: true, daily: await dailySince(since) }); }
  catch (e) { return send(res, 500, { ok: false, error: 'server' }); }
}
