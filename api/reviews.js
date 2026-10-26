import { getReviews } from '../lib/reviews.js';
import { send } from '../lib/http.js';

export default async function handler(req, res) {
  const key = new URL(req.url, 'http://x').searchParams.get('key') || '';
  if (!/^(anf|hol|gh)-\d+$/.test(key)) return send(res, 400, { ok: false, error: 'bad_key' });
  try { return send(res, 200, Object.assign({ ok: true }, await getReviews(key))); }
  catch (e) { return send(res, 500, { ok: false, error: 'server' }); }
}
