// Turns an A&F / Hollister / Gilly Hicks product page into a normalized snapshot.
// The same logic runs in the bookmarklet (EXTRACT in public/index.html); keep them in step.

export const HOSTS = { abercrombie: 'anf', hollisterco: 'hol', gillyhicks: 'gh' };
const BRAND = { anf: 'Abercrombie & Fitch', hol: 'Hollister', gh: 'Gilly Hicks' };
const MARKER = 'APOLLO_STATE__product-mfe-web-service-ProductPageFrontend-config';

// Accepts URLs with or without scheme/www and strips tracking parameters.
export function normalizeUrl(raw) {
  const m = String(raw || '').trim().match(/^(?:https?:\/\/)?(?:www\.)?(abercrombie|hollisterco|gillyhicks)\.com\/\S*?\/p\/([^\s?#\/]+)/i);
  if (!m) return null;
  return 'https://www.' + m[1].toLowerCase() + '.com/shop/us/p/' + m[2];
}

// Pulls the JSON object assigned to window['APOLLO_STATE__...ProductPageFrontend-config'] out of raw HTML.
export function stateFromHtml(html) {
  const i = html.indexOf(MARKER);
  if (i < 0) return null;
  const start = html.indexOf('{', html.indexOf('=', i));
  let depth = 0, inStr = false, esc = false;
  for (let k = start; k < html.length; k++) {
    const ch = html[k];
    if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (!depth) return JSON.parse(html.slice(start, k + 1)); }
  }
  return null;
}

export const canon = v => v && typeof v === 'object'
  ? '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}'
  : JSON.stringify(v);
export const fnv = str => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; };

const num = s => { if (s == null || s === '') return null; const n = parseFloat(String(s).replace(/[^0-9.]/g, '')); return isNaN(n) ? null : n; };
const sum = a => a.reduce((x, y) => x + (y || 0), 0);

export function localDate(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(d);
}

// state: the parsed Apollo object; pageUrl: the product page URL it came from.
export function extract(state, pageUrl) {
  const u = new URL(pageUrl);
  const rq = state && state.CACHE && state.CACHE.ROOT_QUERY;
  if (!rq) return { ok: false, error: 'no_product_state' };
  const ck = Object.keys(rq).find(k => k.startsWith('collection('));
  const bk = Object.keys(rq).find(k => k.startsWith('bazaarVoice('));
  if (!ck) return { ok: false, error: 'no_collection' };
  const args = JSON.parse(ck.slice(ck.indexOf('(') + 1, -1));
  const coll = (rq[ck] && rq[ck].collection) || {};
  const prods = coll.products || [];
  const allSkus = coll.skus || [];
  const rv = bk ? rq[bk] : null;
  const host = u.hostname;
  const bs = host.includes('hollister') ? 'hol' : (host.includes('gillyhicks') ? 'gh' : 'anf');
  const colors = prods.map(p => {
    const lp = (p.prices && p.prices.list) || {};
    const skus = allSkus.filter(s => s.productId === p.productId).map(s => ({
      sku: s.shortSku, p: (s.sizePrimary || '').replace(/_p$/, ''), s: (s.sizeSecondary || '').replace(/_s$/, ''),
      label: s.fullSizeLabel || '', inv: typeof s.inventory === 'number' ? s.inventory : null, status: s.inventoryStatus || ''
    }));
    return {
      id: p.productId, color: p.swatchName || p.colorFamily || '', family: p.colorFamily || '',
      webItem: p.webItemNumber || '', storeItem: p.storeItemNumber || '',
      list: lp.listPriceUSD ?? num(lp.originalPrice), offer: lp.offerPriceUSD ?? num(lp.discountPrice || lp.originalPrice),
      flag: p.priceFlag || '', promo: p.merchPromoMessage || '', finalSale: !!p.isFinalSale,
      badges: (p.badges || []).map(b => b.label).filter(Boolean), skus
    };
  });
  const p0 = prods.find(p => p.productId === args.productId) || prods[0] || {};
  const now = new Date();
  const date = localDate(now);
  const key = bs + '-' + args.collectionId;
  const hist = { key, date, at: now.toISOString(), units: sum(colors.map(c => sum(c.skus.map(s => s.inv)))), c: {} };
  colors.forEach(c => {
    const sz = {}; c.skus.forEach(s => { sz[s.label || s.sku] = s.inv; });
    hist.c[c.id] = { n: c.color, o: c.offer, l: c.list, u: sum(c.skus.map(s => s.inv)), s: sz };
  });
  hist.ck = fnv(canon(hist.c));
  const heroImg = (p0.orderedImages && p0.orderedImages[0]) || (p0.imageSet && p0.imageSet.prod && p0.imageSet.prod[0]) || {};
  const style = {
    key, brand: BRAND[bs], bs, site: host,
    store: (u.pathname.match(/\/shop\/([a-z]+)\//) || [])[1] || '',
    url: 'https://' + host + '/shop/us/p/' + (u.pathname.split('/p/')[1] || ''),
    collectionId: String(args.collectionId), productId: String(args.productId),
    name: p0.productNameEn || p0.productName || '', department: p0.departmentName || '', gender: p0.gender || '',
    category: (p0.breadcrumbCategoryHierarchy || []).map(c => c.categoryName_EN || c.categoryName).filter(Boolean).slice(1).join(' › '),
    shortDesc: p0.shortDescription || '', longDesc: p0.longDescription || '', fabric: p0.fabricDetails || '',
    care: (p0.careDetailsList || []).map(c => String(c.value).trim()),
    rating: rv ? rv.averageOverallRating : null, reviews: rv ? rv.totalReviewCount : null,
    soldOut: !!coll.isSoldOut, capturedAt: hist.at, date, units: hist.units,
    img: (heroImg.mainImageSrc || '').split('?')[0], colors
  };
  return { v: 1, ok: true, kind: 'anf-tracker', style, hist };
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';

// Fetches a product page server-side and extracts it.
export async function capture(url) {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: {
      'user-agent': UA,
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'accept-language': 'en-US,en;q=0.9',
      'cache-control': 'no-cache'
    }
  });
  const html = await res.text();
  if (!res.ok) return { ok: false, error: 'http_' + res.status };
  let state;
  try { state = stateFromHtml(html); } catch (e) { return { ok: false, error: 'parse_failed' }; }
  if (!state) return { ok: false, error: html.length < 20000 ? 'blocked' : 'not_a_product_page' };
  return extract(state, res.url || url);
}

// Basic shape checks for snapshots that arrive from the bookmarklet.
export function validSnapshot(r) {
  if (!r || r.kind !== 'anf-tracker' || !r.ok || !r.style || !r.hist) return 'not_tracker_data';
  const s = r.style, h = r.hist;
  if (!/^(anf|hol|gh)-\d{3,12}$/.test(String(s.key)) || s.key !== h.key) return 'bad_key';
  if (!Object.keys(HOSTS).some(k => String(s.site).includes(k))) return 'bad_site';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(h.date)) return 'bad_date';
  if (!Array.isArray(s.colors) || s.colors.length > 80) return 'bad_colors';
  if (h.ck != null && fnv(canon(h.c)) !== h.ck) return 'checksum_mismatch';
  return null;
}
