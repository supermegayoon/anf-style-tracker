import { validSnapshot } from '../lib/extract.js';
import { save } from '../lib/store.js';
import { send, readJson, CORS } from '../lib/http.js';

// POST snapshot from the bookmarklet, which runs on the A&F page in the user's own browser.
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.statusCode = 204; for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v); return res.end(); }
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'method' }, CORS);
  const r = await readJson(req);
  const bad = validSnapshot(r);
  if (bad) return send(res, 400, { ok: false, error: bad }, CORS);
  try {
    await save(r.style, r.hist);
    return send(res, 200, { ok: true, key: r.style.key, name: r.style.name, date: r.hist.date, units: r.hist.units, colors: r.style.colors.length }, CORS);
  } catch (e) {
    return send(res, 500, { ok: false, error: 'server' }, CORS);
  }
}
