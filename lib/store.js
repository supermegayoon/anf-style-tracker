import { q, ensure } from './db.js';

// Units that left stock between two captures count as sold; units that came back count as received.
export function diff(prevC, curC) {
  let sold = 0, recv = 0, rev = 0;
  for (const id of Object.keys(curC || {})) {
    const x = (prevC || {})[id], y = curC[id];
    if (!x) continue; // a new color has no earlier stock to compare
    let sc = 0;
    for (const sz of new Set([...Object.keys(x.s || {}), ...Object.keys(y.s || {})])) {
      const p = (x.s || {})[sz] || 0, n = (y.s || {})[sz] || 0;
      if (n < p) sc += p - n; else if (n > p) recv += n - p;
    }
    sold += sc; rev += sc * (y.o || 0);
  }
  return { sold, recv, rev: Math.round(rev * 100) / 100 };
}
const minOffer = c => { const o = Object.values(c || {}).map(v => v.o).filter(v => v != null); return o.length ? Math.min(...o) : null; };
const parseC = c => typeof c === 'string' ? JSON.parse(c) : c;

async function rollDay(key, date) {
  const [cur] = await q('select date, units, c from snapshots where key = $1 and date = $2', [key, date]);
  if (!cur) return;
  const [prev] = await q('select date, c from snapshots where key = $1 and date < $2 order by date desc limit 1', [key, date]);
  const c = parseC(cur.c);
  const d = prev ? diff(parseC(prev.c), c) : { sold: 0, recv: 0, rev: 0 };
  await q(`insert into daily (key, date, units, sold, recv, rev, min_offer, first) values ($1,$2,$3,$4,$5,$6,$7,$8)
    on conflict (key, date) do update set units = excluded.units, sold = excluded.sold, recv = excluded.recv,
      rev = excluded.rev, min_offer = excluded.min_offer, first = excluded.first`,
    [key, date, cur.units, d.sold, d.recv, d.rev, minOffer(c), !prev]);
}

// Saves one capture: latest style sheet, the day's snapshot, and the daily estimate (plus the next day's, which depends on it).
export async function save(style, hist) {
  await ensure();
  const data = Object.assign({}, style);
  delete data.th;
  await q(`insert into styles (key, data, last_date) values ($1, $2::jsonb, $3)
    on conflict (key) do update set
      data = case when styles.last_date is null or excluded.last_date >= styles.last_date then excluded.data else styles.data end,
      last_date = greatest(coalesce(styles.last_date, ''), excluded.last_date),
      updated_at = now()`, [style.key, JSON.stringify(data), hist.date]);
  await q(`insert into snapshots (key, date, at, units, c, ck) values ($1,$2,$3,$4,$5::jsonb,$6)
    on conflict (key, date) do update set at = excluded.at, units = excluded.units, c = excluded.c, ck = excluded.ck
    where excluded.at >= snapshots.at`, [hist.key, hist.date, hist.at, hist.units, JSON.stringify(hist.c), hist.ck ?? null]);
  await rollDay(hist.key, hist.date);
  const [next] = await q('select date from snapshots where key = $1 and date > $2 order by date limit 1', [hist.key, hist.date]);
  if (next) await rollDay(hist.key, next.date);
}

export async function listStyles() {
  await ensure();
  const rows = await q(`select s.key, s.data, s.seaa, s.first_seen, s.custom, m.data as rv,
      (select count(*) from reviews r where r.key = s.key)::int as rv_saved
    from styles s left join review_meta m on m.key = s.key order by s.updated_at desc`);
  return rows.map(r => {
    const rv = r.rv ? parseC(r.rv) : null;
    return Object.assign({}, parseC(r.data), { seaa: r.seaa, firstSeen: r.first_seen, custom: r.custom ? parseC(r.custom) : null,
      rv: rv || r.rv_saved ? { rating: rv && rv.rating, count: rv && rv.count, saved: r.rv_saved, date: rv && rv.date } : null });
  });
}
export async function history(key) {
  await ensure();
  const rows = await q('select key, date, at, units, c from snapshots where key = $1 order by date', [key]);
  return rows.map(r => ({ key: r.key, date: r.date, at: r.at, units: r.units, c: parseC(r.c) }));
}
export async function dailySince(since) {
  await ensure();
  const rows = await q('select key, date, units, sold, recv, rev, first from daily where date >= $1 order by date', [since]);
  return rows.map(r => ({ key: r.key, date: r.date, u: r.units, s: r.sold, r: r.recv, v: Number(r.rev), first: r.first }));
}
// Team-entered fields that the site does not provide (style number, season, vendor, notes, a display name).
export const CUSTOM_FIELDS = { alias: 120, styleNo: 60, season: 40, vendor: 80, note: 1000 };
export async function setCustom(key, fields) {
  await ensure();
  const out = {};
  for (const [k, n] of Object.entries(CUSTOM_FIELDS)) {
    const v = fields && fields[k] != null ? String(fields[k]).trim().slice(0, n) : '';
    if (v) out[k] = v;
  }
  out.at = new Date().toISOString();
  const rows = await q('update styles set custom = $2::jsonb where key = $1 returning key', [key, JSON.stringify(out)]);
  return rows.length ? out : null;
}
export async function setMark(key, on) { await ensure(); await q('update styles set seaa = $2 where key = $1', [key, !!on]); }
export async function remove(key) {
  await ensure();
  await q('delete from daily where key = $1', [key]);
  await q('delete from reviews where key = $1', [key]);
  await q('delete from review_meta where key = $1', [key]);
  await q('delete from snapshots where key = $1', [key]);
  await q('delete from styles where key = $1', [key]);
}
export async function dueForRefresh(today, limit) {
  await ensure();
  return q(`select key, data->>'url' as url from styles where coalesce(last_date, '') < $1 order by last_date nulls first limit $2`, [today, limit]);
}
