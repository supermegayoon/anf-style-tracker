import { setMark, remove } from '../lib/store.js';
import { send, readJson, isAdmin } from '../lib/http.js';

// POST {action: 'check' | 'mark' | 'unmark' | 'delete', key} mark/unmark are open to everyone; check/delete need header x-admin-key.
export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'method' });
  const b = (await readJson(req)) || {};
  // Anyone can mark/unmark Sae-A styles; checking the key and deleting need the admin key.
  const open = b.action === 'mark' || b.action === 'unmark';
  if (!open && !isAdmin(req)) return send(res, 401, { ok: false, error: 'admin_key' });
  if (b.action === 'check') return send(res, 200, { ok: true });
  if (!/^(anf|hol|gh)-\d+$/.test(String(b.key || ''))) return send(res, 400, { ok: false, error: 'bad_key' });
  try {
    if (b.action === 'mark' || b.action === 'unmark') await setMark(b.key, b.action === 'mark');
    else if (b.action === 'delete') await remove(b.key);
    else return send(res, 400, { ok: false, error: 'bad_action' });
    return send(res, 200, { ok: true });
  } catch (e) { return send(res, 500, { ok: false, error: 'server' }); }
}
