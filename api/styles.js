import { listStyles } from '../lib/store.js';
import { send } from '../lib/http.js';

export default async function handler(req, res) {
  try { return send(res, 200, { ok: true, styles: await listStyles() }); }
  catch (e) { return send(res, 500, { ok: false, error: 'server', detail: String(e && e.message || e).slice(0, 200) }); }
}
