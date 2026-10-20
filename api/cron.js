import { capture, localDate } from '../lib/extract.js';
import { save, dueForRefresh } from '../lib/store.js';
import { send } from '../lib/http.js';

// Daily re-capture of every tracked style (Vercel Cron). Runs one request at a time and stops for the
// day as soon as the site answers with its automated-access challenge, so a refused run stays quiet.
// Styles not reached are picked up first on the next run (ordered by last capture date).
export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== 'Bearer ' + secret) return send(res, 401, { ok: false });
  const started = Date.now(), budget = 50000;
  const today = localDate();
  const due = await dueForRefresh(today, 300);
  const done = [], failed = [];
  let blocked = false;
  for (const row of due) {
    if (Date.now() - started > budget) break;
    try {
      const r = await capture(row.url);
      if (r.ok) { await save(r.style, r.hist); done.push(row.key); }
      else if (r.error === 'blocked') { blocked = true; break; }
      else failed.push({ key: row.key, error: r.error });
    } catch (e) { failed.push({ key: row.key, error: 'exception' }); }
    await new Promise(r => setTimeout(r, 1500));
  }
  return send(res, 200, { ok: true, today, due: due.length, done: done.length, failed, blocked, left: due.length - done.length - failed.length });
}
