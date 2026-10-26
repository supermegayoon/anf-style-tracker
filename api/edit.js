import { setCustom } from '../lib/store.js';
import { send, readJson } from '../lib/http.js';

// POST {key, fields:{alias, styleNo, season, vendor, note}} — anyone on the team can fill these in.
export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'method' });
  const b = (await readJson(req)) || {};
  if (!/^(anf|hol|gh)-\d+$/.test(String(b.key || ''))) return send(res, 400, { ok: false, error: 'bad_key' });
  try {
    const custom = await setCustom(b.key, b.fields || {});
    if (!custom) return send(res, 404, { ok: false, error: 'not_found' });
    return send(res, 200, { ok: true, custom });
  } catch (e) { return send(res, 500, { ok: false, error: 'server' }); }
}
