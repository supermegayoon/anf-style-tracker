import { q, ensure } from './db.js';
import { fnv } from './extract.js';

// Customer reviews arrive with a bookmarklet capture. The site only shows them on its US store, so a capture
// from elsewhere carries no reviews; that must not wipe what an earlier US capture saved.
const str = (v, n) => v == null ? null : String(v).replace(/\s+/g, ' ').trim().slice(0, n) || null;
// Keeps a small JSON value (object or scalar) only if it serializes under n characters.
const smallJson = (v, n) => { if (v == null) return null; try { const t = JSON.stringify(v); return t && t.length <= n ? JSON.parse(t) : null; } catch (e) { return null; } };
const num = v => { const n = parseFloat(v); return isFinite(n) ? n : null; };

export function cleanReviews(rv) {
  if (!rv || typeof rv !== 'object') return null;
  const items = (Array.isArray(rv.items) ? rv.items : []).slice(0, 300).map(r => {
    const out = {
      rating: num(r.rating), title: str(r.title, 300), body: str(r.text, 4000),
      author: str(r.author, 80), rdate: str(r.date, 40)
    };
    if (!out.body && !out.title) return null;
    if (out.rating != null && (out.rating < 0 || out.rating > 5)) out.rating = null;
    out.extra = smallJson(r.extra, 2000);
    out.rid = str(r.id, 80) || String(fnv([out.author, out.rdate, out.title, out.body].join('|')));
    return out;
  }).filter(Boolean);
  const dist = Array.isArray(rv.dist) ? rv.dist.slice(0, 5).map(d => ({ r: num(d.r), n: num(d.n) })).filter(d => d.r != null && d.n != null) : [];
  const meta = {
    store: str(rv.store, 8), rating: num(rv.rating), count: num(rv.count), dist,
    fit: smallJson(rv.fit, 1000)
  };
  const diag = smallJson(rv.diag, 4000);
  return { meta, items, diag };
}

export async function saveReviews(key, date, at, clean) {
  if (!clean) return { saved: 0 };
  await ensure();
  const useful = clean.items.length > 0 || (clean.meta.count || 0) > 0;
  const diag = Object.assign({ at, date, store: clean.meta.store, items: clean.items.length, count: clean.meta.count }, clean.diag || {});
  if (useful) {
    const data = Object.assign({}, clean.meta, { at, date });
    await q(`insert into review_meta (key, data, diag) values ($1, $2::jsonb, $3::jsonb)
      on conflict (key) do update set data = excluded.data, diag = excluded.diag, updated_at = now()`, [key, JSON.stringify(data), JSON.stringify(diag)]);
  } else {
    await q(`insert into review_meta (key, data, diag) values ($1, null, $2::jsonb)
      on conflict (key) do update set diag = excluded.diag, updated_at = now()`, [key, JSON.stringify(diag)]);
  }
  let saved = 0;
  for (const r of clean.items) {
    const rows = await q(`insert into reviews (key, rid, rating, title, body, author, rdate, extra) values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
      on conflict (key, rid) do update set last_seen = now(), rating = coalesce(excluded.rating, reviews.rating)
      returning (xmax = 0) as inserted`, [key, r.rid, r.rating, r.title, r.body, r.author, r.rdate, r.extra ? JSON.stringify(r.extra) : null]);
    if (rows[0] && rows[0].inserted) saved++;
  }
  return { saved, seen: clean.items.length, store: clean.meta.store, count: clean.meta.count };
}

const parse = v => typeof v === 'string' ? JSON.parse(v) : v;
export async function getReviews(key) {
  await ensure();
  const [m] = await q('select data, diag from review_meta where key = $1', [key]);
  const rows = await q(`select rid, rating, title, body, author, rdate, extra, first_seen from reviews where key = $1
    order by coalesce(rdate, '') desc, first_seen desc limit 500`, [key]);
  return { meta: m ? parse(m.data) : null, diag: m ? parse(m.diag) : null,
    items: rows.map(r => ({ id: r.rid, rating: r.rating == null ? null : Number(r.rating), title: r.title, text: r.body, author: r.author, date: r.rdate, extra: parse(r.extra), first: r.first_seen })) };
}
