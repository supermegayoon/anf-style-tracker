// End-to-end check against an in-process Postgres (PGLITE=1). Uses synthetic captures only.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { makeServer } from './dev-server.js';
import { canon, fnv, normalizeUrl, stateFromHtml, extract } from '../lib/extract.js';

process.env.ADMIN_KEY = 'test-admin';
const server = makeServer().listen(0);
const base = 'http://localhost:' + server.address().port;
const post = (p, body, headers = {}) => fetch(base + p, { method: 'POST', headers: Object.assign({ 'content-type': 'application/json' }, headers), body: JSON.stringify(body) }).then(async r => ({ status: r.status, j: await r.json() }));
const get = p => fetch(base + p).then(r => r.json());

const fixture = JSON.parse(await readFile(new URL('./fixture-style.json', import.meta.url)));
function snapshotFor(style, date, mutate) {
  const s = JSON.parse(JSON.stringify(style));
  s.colors.forEach((c, ci) => c.skus.forEach((k, ki) => { k.inv = mutate(k.inv, ci, ki); }));
  const c = {};
  s.colors.forEach(col => { const sz = {}; col.skus.forEach(k => { sz[k.label] = k.inv; }); c[col.id] = { n: col.color, o: col.offer, l: col.list, u: col.skus.reduce((a, k) => a + k.inv, 0), s: sz }; });
  const units = Object.values(c).reduce((a, v) => a + v.u, 0);
  const at = date + 'T02:00:00.000Z';
  Object.assign(s, { date, capturedAt: at, units });
  return { v: 1, ok: true, kind: 'anf-tracker', style: s, hist: { key: s.key, date, at, units, c, ck: fnv(canon(c)) } };
}

// 1) URL normalisation
assert.equal(normalizeUrl('abercrombie.com/shop/wd/p/bra-free-rib-scoopneck-tank-61765319?categoryId=1'), 'https://www.abercrombie.com/shop/us/p/bra-free-rib-scoopneck-tank-61765319');
assert.equal(normalizeUrl('https://example.com/p/x'), null);

// 2) HTML parsing of an Apollo assignment, including braces inside strings
const html = `<script>window['APOLLO_STATE__product-mfe-web-service-ProductPageFrontend-config'] = {"CACHE":{"ROOT_QUERY":{"collection({\\"categoryId\\":\\"1\\",\\"collectionId\\":\\"42\\",\\"faceout\\":\\"\\",\\"productId\\":\\"7\\"})":{"collection":{"products":[{"productId":"7","productName":"Tee {x}","swatchName":"black","colorFamily":"Black","prices":{"list":{"listPriceUSD":30,"offerPriceUSD":20}},"orderedImages":[{"mainImageSrc":"https://img.abercrombie.com/is/image/anf/X_model1?policy=a"}]}],"skus":[{"productId":"7","shortSku":"1","sizePrimary":"S_p","fullSizeLabel":"S","inventory":5,"inventoryStatus":"Available"}]}}}}};var x=1;</script>`;
const st = stateFromHtml(html);
const ex = extract(st, 'https://www.abercrombie.com/shop/us/p/tee-7');
assert.equal(ex.ok, true); assert.equal(ex.style.key, 'anf-42'); assert.equal(ex.style.name, 'Tee {x}');
assert.equal(ex.hist.units, 5); assert.equal(ex.style.colors[0].offer, 20);
assert.equal(ex.style.img, 'https://img.abercrombie.com/is/image/anf/X_model1');

// 3) Ten daily captures: steady sell-down, a restock on day 5, a markdown from day 7
const dates = Array.from({ length: 10 }, (_, i) => '2026-10-' + String(11 + i).padStart(2, '0'));
let expected = {};
let prevC = null;
for (const [i, d] of dates.entries()) {
  const snap = snapshotFor(fixture, d, (inv, ci, ki) => Math.max(0, inv + 200 - i * (ki + 1) * 3 + (i >= 4 ? 60 : 0)));
  if (i >= 6) snap.style.colors.forEach(c => { c.offer = 39.95; }), Object.values(snap.hist.c).forEach(v => { v.o = 39.95; }), snap.hist.ck = fnv(canon(snap.hist.c));
  const r = await post('/api/ingest', snap);
  assert.equal(r.status, 200, JSON.stringify(r.j));
  // independent expectation
  let sold = 0, recv = 0;
  if (prevC) for (const id of Object.keys(snap.hist.c)) for (const lb of Object.keys(snap.hist.c[id].s)) {
    const p = prevC[id].s[lb], n = snap.hist.c[id].s[lb];
    if (n < p) sold += p - n; else recv += n - p;
  }
  expected[d] = { sold, recv };
  prevC = snap.hist.c;
}
const daily = (await get('/api/daily?since=2026-10-01')).daily.filter(x => x.key === fixture.key);
assert.equal(daily.length, 10);
for (const row of daily) {
  assert.equal(row.s, expected[row.date].sold, 'sold ' + row.date);
  assert.equal(row.r, expected[row.date].recv, 'recv ' + row.date);
}
assert.equal(daily[0].first, true);

// 4) Same-day recapture replaces that day and stays consistent
const again = snapshotFor(fixture, dates[9], (inv, ci, ki) => Math.max(0, inv + 200 - 9 * (ki + 1) * 3 + 60 - 1));
Object.values(again.hist.c).forEach(v => { v.o = 39.95; }); again.hist.at = dates[9] + 'T05:00:00.000Z'; again.hist.ck = fnv(canon(again.hist.c));
assert.equal((await post('/api/ingest', again)).status, 200);
const d10 = (await get('/api/daily?since=' + dates[9])).daily.find(x => x.key === fixture.key);
assert.equal(d10.s, expected[dates[9]].sold + Object.values(again.hist.c).reduce((a, v) => a + Object.keys(v.s).length, 0));

// 5) Corrupted data is refused
const bad = snapshotFor(fixture, '2026-10-21', inv => inv);
bad.hist.c[Object.keys(bad.hist.c)[0]].u += 1;
const rb = await post('/api/ingest', bad);
assert.equal(rb.status, 400); assert.equal(rb.j.error, 'checksum_mismatch');

// 6) Admin actions need the key
assert.equal((await post('/api/admin', { action: 'delete', key: fixture.key })).status, 401);
assert.equal((await post('/api/admin', { action: 'check' }, { 'x-admin-key': 'test-admin' })).status, 200);
assert.equal((await post('/api/admin', { action: 'mark', key: fixture.key })).status, 200);
const listed = (await get('/api/styles')).styles.find(s => s.key === fixture.key);
assert.equal(listed.seaa, true); assert.equal(listed.date, dates[9]);
const hist = (await get('/api/history?key=' + fixture.key)).history;
assert.equal(hist.length, 10);

// 7) Reviews: a US capture saves them, a later non-US capture (no reviews) keeps them, repeats are not duplicated
const withRv = snapshotFor(fixture, dates[9], (inv, ci, ki) => Math.max(0, inv + 200 - 9 * (ki + 1) * 3 + 60 - 1));
Object.values(withRv.hist.c).forEach(v => { v.o = 39.95; }); withRv.hist.at = dates[9] + 'T06:00:00.000Z'; withRv.hist.ck = fnv(canon(withRv.hist.c));
withRv.reviews = { store: 'us', rating: 4.3, count: 57, dist: [{ r: 5, n: 30 }, { r: 4, n: 15 }, { r: 3, n: 6 }, { r: 2, n: 4 }, { r: 1, n: 2 }],
  items: [{ id: 'a1', rating: 5, title: 'So soft', text: 'Runs small, size up. Very soft.', author: 'kim', date: '2026-10-01' },
          { rating: 2, title: 'Sheer', text: 'Totally see-through in white', author: 'lee', date: '2026-09-20', extra: { Size: 'M' } },
          { rating: 9, title: '', text: '' }], diag: { seo: 2 } };
let ri = await post('/api/ingest', withRv);
assert.equal(ri.status, 200); assert.equal(ri.j.reviews.saved, 2); assert.equal(ri.j.reviews.count, 57);
ri = await post('/api/ingest', withRv);
assert.equal(ri.j.reviews.saved, 0);
const wd = JSON.parse(JSON.stringify(withRv)); wd.reviews = { store: 'wd', rating: null, count: null, items: [], diag: { seo: 0 } };
assert.equal((await post('/api/ingest', wd)).status, 200);
const rvs = await get('/api/reviews?key=' + fixture.key);
assert.equal(rvs.items.length, 2); assert.equal(rvs.meta.count, 57); assert.equal(rvs.meta.store, 'us'); assert.equal(rvs.diag.store, 'wd');
assert.equal((await get('/api/styles')).styles.find(s => s.key === fixture.key).rv.saved, 2);
const noRv = snapshotFor(fixture, dates[9], inv => inv); delete noRv.reviews; noRv.hist.at = dates[9] + 'T01:00:00.000Z';
assert.equal((await post('/api/ingest', noRv)).status, 200);

// 8) Capture rejects non-A&F URLs before any network call
const rc = await post('/api/capture', { url: 'https://evil.example/p/1' });
assert.equal(rc.status, 400); assert.equal(rc.j.error, 'bad_url');

console.log('all checks passed');
if (!process.env.KEEP) server.close();
export { base, server };
