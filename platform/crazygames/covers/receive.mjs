// Tiny local receiver: the covers page POSTs each finished PNG here and it is written to
// dist/covers/out/. Only accepts requests from the local covers page.
import http from 'node:http';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'dist', 'covers', 'out');
mkdirSync(OUT, { recursive: true });
http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5261');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.end(); return; }
  if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
  const name = basename(new URL(req.url, 'http://x').searchParams.get('name') || 'cover.png').replace(/[^\w.-]/g, '_');
  const chunks = []; req.on('data', c => chunks.push(c));
  req.on('end', () => { const buf = Buffer.concat(chunks); writeFileSync(join(OUT, name), buf); console.log('saved', name, buf.length); res.end('ok ' + buf.length); });
}).listen(5231, '127.0.0.1', () => console.log('listening on 5231, saving to', OUT));
