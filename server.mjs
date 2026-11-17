// Run the whole site on your own computer:  node --env-file=.env server.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.APEX_LOCAL = '1';
const { default: handler } = await import('./netlify/functions/api.mjs');
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.mp4': 'video/mp4', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.js': 'text/javascript' };

http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://localhost');
    if (u.pathname.startsWith('/api/')) {
      const chunks = []; for await (const c of req) chunks.push(c);
      const headers = new Headers();
      for (const k of ['authorization', 'content-type']) if (req.headers[k]) headers.set(k, req.headers[k]);
      const r = await handler(new Request('http://localhost' + req.url, { method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) }));
      res.writeHead(r.status, Object.fromEntries(r.headers));
      return res.end(Buffer.from(await r.arrayBuffer()));
    }
    let p = path.join(root, path.normalize(decodeURIComponent(u.pathname)));
    if (!p.startsWith(root)) { res.writeHead(403); return res.end('Forbidden'); }
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
    if (!fs.existsSync(p)) { res.writeHead(404); return res.end('Not found'); }
    const ext = path.extname(p);
    res.writeHead(200, { 'content-type': TYPES[ext] || 'application/octet-stream', 'cache-control': p.includes(path.sep + 'assets' + path.sep) ? 'public, max-age=31536000, immutable' : 'no-cache' });
    fs.createReadStream(p).pipe(res);
  } catch (e) { res.writeHead(500); res.end('Server error'); }
}).listen(process.env.PORT || 8888, () => console.log('Apex Clan League running on http://localhost:' + (process.env.PORT || 8888)));
