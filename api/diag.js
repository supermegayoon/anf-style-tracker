// TEMPORARY: probes how A&F responds to server-side requests. Remove after testing.
import { send } from '../lib/http.js';

const CHROME = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'accept-language': 'en-US,en;q=0.9',
  'accept-encoding': 'gzip, deflate, br',
  'sec-ch-ua': '"Chromium";v="129", "Not=A?Brand";v="8", "Google Chrome";v="129"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-fetch-dest': 'document',
  'sec-fetch-mode': 'navigate',
  'sec-fetch-site': 'none',
  'sec-fetch-user': '?1',
  'upgrade-insecure-requests': '1'
};

async function probe(name, url, opts) {
  const t = Date.now();
  try {
    const r = await fetch(url, Object.assign({ redirect: 'manual' }, opts));
    const body = await r.text();
    const title = (body.match(/<title>([^<]{0,120})/i) || [])[1] || '';
    return { name, status: r.status, ms: Date.now() - t, len: body.length, title, location: r.headers.get('location'), server: r.headers.get('server'), akamai: !!r.headers.get('akamai-grn') || /akamai|reference #/i.test(body), marker: body.includes('APOLLO_STATE__product-mfe'), head: body.slice(0, 160).replace(/\s+/g, ' ') };
  } catch (e) { return { name, error: String(e && e.message || e) }; }
}

export default async function handler(req, res) {
  const pdp = 'https://www.abercrombie.com/shop/us/p/bra-free-rib-scoopneck-tank-61765319';
  const hol = 'https://www.hollisterco.com/shop/us/p/hollister-feel-good-boxy-washed-quarter-zip-hoodie-63858527';
  const gql = 'https://www.abercrombie.com/api/bff/product?brand=anf&store=a-us&storeId=10051&catalogId=10901&langId=-1&country=US&currency=USD&urlRoot=/shop/us';
  const results = await Promise.all([
    probe('plain-ua', pdp, { headers: { 'user-agent': CHROME['user-agent'], 'accept': CHROME.accept, 'accept-language': 'en-US,en;q=0.9' } }),
    probe('chrome-headers', pdp, { headers: CHROME }),
    probe('no-headers', pdp, {}),
    probe('hollister-chrome', hol, { headers: CHROME }),
    probe('googlebot', pdp, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' } }),
    probe('gql-post', gql, { method: 'POST', headers: { 'content-type': 'application/json', 'apollo-require-preflight': 'true', 'user-agent': CHROME['user-agent'], 'x-apollo-operation-name': 'P' }, body: JSON.stringify({ operationName: 'P', query: 'query P($productId:String!){product(productId:$productId){id name}}', variables: { productId: '61765319' } }) })
  ]);
  return send(res, 200, { region: process.env.VERCEL_REGION || null, results });
}
