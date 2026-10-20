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
  const rows = await q('select key, data, seaa, first_seen from styles order by updated_at desc');
  return rows.map(r => Object.assign({}, parseC(r.data), { seaa: r.seaa, firstSeen: r.first_seen }));
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
export async function setMark(key, on) { await ensure(); await q('update styles set seaa = $2 where key = $1', [key, !!on]); }
export async function remove(key) {
  await ensure();
  await q('delete from daily where key = $1', [key]);
  await q('delete from snapshots where key = $1', [key]);
  await q('delete from styles where key = $1', [key]);
}
export async function dueForRefresh(today, limit) {
  await ensure();
  return q(`select key, data->>'url' as url from styles where coalesce(last_date, '') < $1 order by last_date nulls first limit $2`, [today, limit]);
}
