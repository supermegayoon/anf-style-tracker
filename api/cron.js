import { capture } from '../lib/extract.js';
import { save, dueForRefresh } from '../lib/store.js';
import { localDate } from '../lib/extract.js';
import { send } from '../lib/http.js';

// Daily re-capture of every tracked style (Vercel Cron). Styles not reached within the time budget
// are picked up first on the next run, since they are ordered by their last capture date.
export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== 'Bearer ' + secret) return send(res, 401, { ok: false });
  const started = Date.now(), budget = 50000;
  const today = localDate();
  const due = await dueForRefresh(today, 300);
  const done = [], failed = [];
  let i = 0;
  async function worker() {
    while (i < due.length && Date.now() - started < budget) {
      const row = due[i++];
      try {
        const r = await capture(row.url);
        if (r.ok) { await save(r.style, r.hist); done.push(row.key); } else failed.push({ key: row.key, error: r.error });
      } catch (e) { failed.push({ key: row.key, error: 'exception' }); }
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()]);
  return send(res, 200, { ok: true, today, due: due.length, done: done.length, failed, left: Math.max(0, due.length - done.length - failed.length) });
}
