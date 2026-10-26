// Builds the "A&F 수집" bookmarklet. Shared by index.html and guide.html.
(function(){
const SITE = location.origin;
const EXTRACT = "(() => { const st = window['APOLLO_STATE__product-mfe-web-service-ProductPageFrontend-config']; if (!st) return { v: 1, ok: false, error: 'no_product_state', url: location.href }; const rq = st.CACHE.ROOT_QUERY; const ck = Object.keys(rq).find(k => k.startsWith('collection(')); const bk = Object.keys(rq).find(k => k.startsWith('bazaarVoice(')); if (!ck) return { v: 1, ok: false, error: 'no_collection', url: location.href }; const args = JSON.parse(ck.slice(ck.indexOf('(') + 1, -1)); const coll = rq[ck].collection || {}; const prods = coll.products || []; const allSkus = coll.skus || []; const rv = bk ? rq[bk] : null; const host = location.hostname; const bs = host.includes('hollister') ? 'hol' : (host.includes('gillyhicks') ? 'gh' : 'anf'); const brand = { hol: 'Hollister', gh: 'Gilly Hicks', anf: 'Abercrombie & Fitch' }[bs]; const num = s => { if (s == null || s === '') return null; const n = parseFloat(String(s).replace(/[^0-9.]/g, '')); return isNaN(n) ? null : n; }; const colors = prods.map(p => { const lp = (p.prices && p.prices.list) || {}; const skus = allSkus.filter(s => s.productId === p.productId).map(s => { const sp = (s.prices && s.prices.list) || {}; return { sku: s.shortSku, p: (s.sizePrimary || '').replace(/_p$/, ''), s: (s.sizeSecondary || '').replace(/_s$/, ''), label: s.fullSizeLabel || '', inv: typeof s.inventory === 'number' ? s.inventory : null, status: s.inventoryStatus || '', offer: sp.offerPriceUSD ?? num(sp.discountPrice || sp.originalPrice) }; }); const img = (p.imageSet && p.imageSet.prod && p.imageSet.prod[0]) || (p.orderedImages && p.orderedImages[0]) || {}; return { id: p.productId, color: p.swatchName || p.colorFamily || '', family: p.colorFamily || '', webItem: p.webItemNumber || '', storeItem: p.storeItemNumber || '', list: lp.listPriceUSD ?? num(lp.originalPrice), offer: lp.offerPriceUSD ?? num(lp.discountPrice || lp.originalPrice), flag: p.priceFlag || '', promo: p.merchPromoMessage || '', finalSale: !!p.isFinalSale, badges: (p.badges || []).map(b => b.label).filter(Boolean), img: (img.mainImageSrc || img.thumbnailSrc || '').split('?')[0], skus }; }); const p0 = prods.find(p => p.productId === args.productId) || prods[0] || {}; const now = new Date(); const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(now); const key = bs + '-' + args.collectionId; const sum = a => a.reduce((x, y) => x + (y || 0), 0); const hist = { key, date, at: now.toISOString(), units: sum(colors.map(c => sum(c.skus.map(s => s.inv)))), c: {} }; colors.forEach(c => { const sz = {}; c.skus.forEach(s => { sz[s.label || s.sku] = s.inv; }); hist.c[c.id] = { n: c.color, o: c.offer, l: c.list, u: sum(c.skus.map(s => s.inv)), s: sz }; }); const canon = v => v && typeof v === 'object' ? '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}' : JSON.stringify(v); const cstr = canon(hist.c); let hh = 2166136261; for (let i = 0; i < cstr.length; i++) { hh ^= cstr.charCodeAt(i); hh = Math.imul(hh, 16777619) >>> 0; } hist.ck = hh; const style = { key, brand, bs, site: host, store: (location.pathname.match(/\\/shop\\/([a-z]+)\\//) || [])[1] || '', url: location.origin + '/shop/us/p/' + (location.pathname.split('/p/')[1] || ''), collectionId: args.collectionId, productId: args.productId, name: p0.productNameEn || p0.productName || document.title, department: p0.departmentName || '', gender: p0.gender || '', category: (p0.breadcrumbCategoryHierarchy || []).map(c => c.categoryName_EN || c.categoryName).filter(Boolean).slice(1).join(' › '), shortDesc: p0.shortDescription || '', longDesc: p0.longDescription || '', fabric: p0.fabricDetails || '', care: (p0.careDetailsList || []).map(c => c.value.trim()), rating: rv ? rv.averageOverallRating : null, reviews: rv ? rv.totalReviewCount : null, soldOut: !!coll.isSoldOut, capturedAt: hist.at, date, units: hist.units, colors, img: (((p0.orderedImages && p0.orderedImages[0]) || (p0.imageSet && p0.imageSet.prod && p0.imageSet.prod[0]) || {}).mainImageSrc || '').split('?')[0] }; return { v: 1, ok: true, kind: 'anf-tracker', style, hist }; })()";
// Runs on the A&F / Hollister page, never here. Self-contained: it is serialized into the bookmark.
function bmMain(L, SITE, getR, getRv){
  var T = L === 'en'
    ? { notpdp: 'A&F Capture: click this on a product page', sending: 'Saving to the tracker…', saved: 'Saved', open: 'Open in tracker', fail: 'Could not save', close: 'Close', rvSaved: function(n, t){ return 'Reviews: ' + n + ' new / ' + t + ' on page'; }, rvNone: 'No reviews on this page (non-US store). Open it from the US store to save reviews too.', colors: ' colors · ', units: ' units' }
    : { notpdp: 'A&F 수집: 상품 페이지에서 눌러주세요', sending: '트래커에 저장하는 중…', saved: '저장됨', open: '트래커에서 보기', fail: '저장하지 못했습니다', close: '닫기', rvSaved: function(n, t){ return '리뷰: 새로 ' + n + '개 / 화면 ' + t + '개'; }, rvNone: '이 페이지에는 리뷰가 없습니다 (해외 스토어). 미국 스토어(VPN)에서 누르면 리뷰도 저장됩니다.', colors: '컬러 · ', units: '개' };
  var r; try { r = getR(); } catch (e) { r = { ok: false, error: String(e) }; }
  if (!r || !r.ok) { alert(T.notpdp + ' (' + (r && r.error) + ')'); return; }
  r.style.colors.forEach(function(c){ delete c.img; });
  try { r.reviews = getRv(); } catch (e) { r.reviews = { diag: { error: String(e).slice(0, 200) } }; }
  var old = document.getElementById('__anf_capture'); if (old) old.remove();
  var d = document.createElement('div'); d.id = '__anf_capture';
  d.style.cssText = 'position:fixed;z-index:2147483647;right:16px;bottom:16px;width:340px;max-width:calc(100vw - 32px);background:#141C29;color:#fff;font:14px/1.5 system-ui,sans-serif;padding:14px;border-radius:8px;box-shadow:0 8px 30px rgba(0,0,0,.35)';
  var m = document.createElement('div'); m.style.fontWeight = '600'; m.textContent = r.style.name;
  var m2 = document.createElement('div'); m2.style.cssText = 'opacity:.75;font-size:12px'; m2.textContent = r.style.colors.length + T.colors + r.style.units.toLocaleString() + T.units;
  var s = document.createElement('div'); s.style.cssText = 'margin-top:8px;font-size:13px'; s.textContent = T.sending;
  var row = document.createElement('div'); row.style.cssText = 'display:flex;gap:10px;margin-top:10px;align-items:center';
  var a = document.createElement('a'); a.textContent = T.open; a.target = '_blank'; a.rel = 'noopener'; a.style.cssText = 'color:#9db4ff;font-weight:600;display:none';
  var b2 = document.createElement('button'); b2.textContent = T.close; b2.style.cssText = 'padding:4px 12px;cursor:pointer'; b2.onclick = function(){ d.remove(); };
  row.append(a, b2); d.append(m, m2, s, row); document.body.appendChild(d);
  fetch(SITE + '/api/ingest', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(r) })
    .then(function(res){ return res.json(); })
    .then(function(j){
      if (j && j.ok) {
        s.textContent = '✓ ' + T.saved + ' (' + j.date + ')'; a.href = SITE + '/#' + j.key; a.style.display = 'inline';
        var rv = document.createElement('div'); rv.style.cssText = 'font-size:12px;margin-top:4px;opacity:.85';
        rv.textContent = j.reviews && (j.reviews.seen || j.reviews.count) ? T.rvSaved(j.reviews.saved || 0, j.reviews.seen || 0) : T.rvNone;
        s.after(rv);
      }
      else s.textContent = T.fail + ' (' + (j && j.error) + ')';
    })
    .catch(function(e){ s.textContent = T.fail + ' (' + e + ')'; });
}
// Runs on the product page, never here: reads the customer reviews the page itself shows (US store only).
// Sources, in order: the page's own data (Apollo bazaarVoice entry), schema.org JSON-LD, and the rendered review list
// (including open shadow roots). A small "diag" summary rides along so the tracker can show what the page offered.
function rvGrab(){
  var out = { store: (location.pathname.match(/\/shop\/([a-z]+)\//) || [])[1] || '', items: [], diag: {} };
  var seen = {};
  function num(v){ var n = parseFloat(v); return isFinite(n) ? n : null; }
  function txt(el){ return el ? (el.getAttribute && el.getAttribute('content')) || el.textContent || '' : ''; }
  function add(r, src){
    if (!r || typeof r !== 'object') return;
    var a = r.author;
    var item = {
      id: r.id || r.Id || r.reviewId || r.ReviewId || null,
      rating: num(r.rating != null ? r.rating : r.Rating != null ? r.Rating : (r.reviewRating && (r.reviewRating.ratingValue != null ? r.reviewRating.ratingValue : r.reviewRating))),
      title: r.title || r.Title || r.name || r.headline || '',
      text: r.reviewText || r.ReviewText || r.text || r.reviewBody || r.body || r.description || '',
      author: r.userNickname || r.UserNickname || r.nickname || (a && (a.name || (typeof a === 'string' ? a : ''))) || '',
      date: r.submissionTime || r.SubmissionTime || r.datePublished || r.date || '',
      src: src
    };
    if (!item.text && !item.title) return;
    var extra = {};
    Object.keys(r).forEach(function(k){
      if (/^(id|Id|rating|Rating|title|Title|name|reviewText|ReviewText|text|reviewBody|body|description|userNickname|UserNickname|author|submissionTime|SubmissionTime|datePublished|date|__typename|@type|@context)$/.test(k)) return;
      var v = r[k];
      if (v == null || v === '') return;
      if (typeof v === 'string' && v.length < 200 || typeof v === 'number' || typeof v === 'boolean') extra[k] = v;
      else if (typeof v === 'object' && /context|secondary|tag|badge|recommend|fit|size|age|height|location/i.test(k)) { try { var t = JSON.stringify(v); if (t.length < 800) extra[k] = v; } catch (e) {} }
    });
    if (Object.keys(extra).length) item.extra = extra;
    var sig = item.id || (item.author + '|' + item.date + '|' + String(item.text).slice(0, 80));
    if (seen[sig]) return; seen[sig] = 1;
    if (out.items.length < 300) out.items.push(item);
  }
  // 1) page data
  var st = window['APOLLO_STATE__product-mfe-web-service-ProductPageFrontend-config'];
  var cache = st && st.CACHE || {}, rq = cache.ROOT_QUERY || {};
  var bk = Object.keys(rq).filter(function(k){ return k.indexOf('bazaarVoice(') === 0; })[0];
  var b = bk ? rq[bk] : null;
  function deref(x){ return x && x.__ref ? (cache[x.__ref] || x) : x; }
  if (b) {
    out.rating = b.averageOverallRating; out.count = b.totalReviewCount; out.fit = b.fitRecommendation;
    var dist = b.ratingDistribution;
    if (Array.isArray(dist)) out.dist = dist.map(function(d){ d = deref(d) || {}; return { r: d.ratingValue != null ? d.ratingValue : d.RatingValue != null ? d.RatingValue : d.rating, n: d.count != null ? d.count : d.Count }; });
    else if (dist && typeof dist === 'object') out.dist = Object.keys(dist).filter(function(k){ return /^\d$/.test(k.replace(/\D/g, '')); }).map(function(k){ return { r: k.replace(/\D/g, ''), n: dist[k] }; });
    var seo = b.seoReviewsData || [];
    out.diag.seo = seo.length;
    if (seo.length) out.diag.seoKeys = Object.keys(deref(seo[0]) || {}).slice(0, 25);
    seo.forEach(function(x){ add(deref(x), 'page'); });
  } else out.diag.noBv = true;
  // 2) JSON-LD
  var ld = 0;
  function walk(o, depth){
    if (!o || typeof o !== 'object' || depth > 6) return;
    if (Array.isArray(o)) { o.forEach(function(x){ walk(x, depth + 1); }); return; }
    var ty = o['@type'];
    if (ty === 'Review' || (Array.isArray(ty) && ty.indexOf('Review') >= 0)) { ld++; add(o, 'ld'); }
    if (o.aggregateRating && out.rating == null) { out.rating = o.aggregateRating.ratingValue; out.count = o.aggregateRating.reviewCount || o.aggregateRating.ratingCount; }
    Object.keys(o).forEach(function(k){ if (typeof o[k] === 'object') walk(o[k], depth + 1); });
  }
  document.querySelectorAll('script[type="application/ld+json"]').forEach(function(sc){ try { walk(JSON.parse(sc.textContent), 0); } catch (e) {} });
  out.diag.ld = ld;
  // 3) rendered list, including open shadow roots
  var roots = [document], hosts = 0;
  (function collect(root, depth){
    if (depth > 4) return;
    root.querySelectorAll('*').forEach(function(el){ if (el.shadowRoot) { hosts++; roots.push(el.shadowRoot); collect(el.shadowRoot, depth + 1); } });
  })(document, 0);
  var dom = 0;
  roots.forEach(function(root){
    root.querySelectorAll('[itemprop="review"], [data-bv-v="contentItem"], li.bv-content-review, section[id^="bv-review-"]').forEach(function(el){
      var q = function(sel){ return el.querySelector(sel); };
      var rEl = q('[itemprop="ratingValue"]');
      var aria = (q('[aria-label*="out of 5"], [aria-label*="Rated"], [title*="out of 5"]') || {});
      var am = ((aria.getAttribute && (aria.getAttribute('aria-label') || aria.getAttribute('title'))) || '').match(/([\d.]+)\s*(?:out of|\/)\s*5/);
      var rating = num(txt(rEl)); if (rating == null && am) rating = num(am[1]);
      var item = {
        rating: rating,
        title: txt(q('[itemprop="name"], h3, h4, .bv-content-title')).trim(),
        reviewText: txt(q('[itemprop="reviewBody"], [itemprop="description"], .bv-content-summary-body-text, p')).trim(),
        userNickname: txt(q('[itemprop="author"] [itemprop="name"], [itemprop="author"], .bv-author, button[aria-label*="profile"]')).trim(),
        datePublished: txt(q('[itemprop="datePublished"], time, .bv-content-datetime-stamp')).trim(),
        id: el.getAttribute('data-bv-review-id') || el.getAttribute('data-review-id') || (el.id && /review/i.test(el.id) ? el.id : null)
      };
      dom++; add(item, 'dom');
    });
  });
  out.diag.dom = dom; out.diag.shadowHosts = hosts; out.diag.bvSlots = document.querySelectorAll('[data-bv-show]').length;
  out.diag.reviewWord = ((document.body.innerText.match(/(\d[\d,]*)\s+Reviews?/) || [])[1]) || null;
  return out;
}
window.anfBookmarklet = function(L){
  return 'javascript:' + encodeURIComponent('(' + bmMain.toString() + ')(' + JSON.stringify(L || 'ko') + ',' + JSON.stringify(SITE) + ',function(){return ' + EXTRACT + '},' + rvGrab.toString() + ')');
};
})();
