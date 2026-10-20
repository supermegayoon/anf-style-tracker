import { normalizeUrl, capture } from '../lib/extract.js';
import { save } from '../lib/store.js';
import { send, readJson } from '../lib/http.js';

// POST {url} — the server opens the product page, extracts it and saves it.
export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'method' });
  const body = await readJson(req);
  const url = normalizeUrl(body && body.url);
  if (!url) return send(res, 400, { ok: false, error: 'bad_url' });
  try {
    const r = await capture(url);
    if (!r.ok) return send(res, 502, { ok: false, error: r.error, url });
    await save(r.style, r.hist);
    return send(res, 200, { ok: true, style: r.style, hist: r.hist });
  } catch (e) {
    return send(res, 500, { ok: false, error: 'server', detail: String(e && e.message || e).slice(0, 200) });
  }
}
