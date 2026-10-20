export function send(res, status, body, extraHeaders = {}) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  for (const [k, v] of Object.entries(extraHeaders)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

export async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (e) { return null; } }
  const chunks = [];
  for await (const ch of req) chunks.push(ch);
  if (!chunks.length) return null;
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (e) { return null; }
}

export function isAdmin(req) {
  const key = process.env.ADMIN_KEY;
  return !!key && req.headers['x-admin-key'] === key;
}

export const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type'
};
