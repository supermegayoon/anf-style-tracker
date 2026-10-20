// Local stand-in for Vercel: serves public/ and routes /api/<name> to api/<name>.js.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const port = Number(process.env.PORT || 3000);

export function makeServer() {
  return http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://localhost');
    if (u.pathname.startsWith('/api/')) {
      const name = u.pathname.slice(5).replace(/[^a-z]/g, '');
      try {
        const mod = await import(join(root, 'api', name + '.js'));
        return await mod.default(req, res);
      } catch (e) {
        res.statusCode = 404; return res.end(JSON.stringify({ ok: false, error: 'not_found', detail: String(e.message) }));
      }
    }
    const file = u.pathname === '/' ? 'index.html' : u.pathname.slice(1);
    try {
      const body = await readFile(join(root, 'public', file));
      res.setHeader('content-type', types[extname(file)] || 'application/octet-stream');
      res.end(body);
    } catch (e) { res.statusCode = 404; res.end('not found'); }
  });
}

if (import.meta.url === 'file://' + process.argv[1]) {
  makeServer().listen(port, () => console.log('http://localhost:' + port));
}
