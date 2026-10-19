/**
 * 生产用静态服务器：托管 dist/，并提供与开发环境一致的 /api/llm 代理。
 * 用法： node server/index.mjs  （默认 http://127.0.0.1:4173）
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { proxyLLM, readBody, sendJSON } from './llmProxy.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT || 4173);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  if (url.pathname === '/api/health') return sendJSON(res, 200, { ok: true, dist: fs.existsSync(DIST) });

  if (url.pathname === '/api/llm' && req.method === 'POST') {
    const raw = await readBody(req);
    return proxyLLM(req, res, raw);
  }

  if (!fs.existsSync(DIST)) {
    res.statusCode = 404;
    return res.end('dist/ 不存在，请先运行 npm run build');
  }

  let file = path.join(DIST, decodeURIComponent(url.pathname));
  if (!file.startsWith(DIST)) file = DIST;
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');

  const ext = path.extname(file).toLowerCase();
  res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`方块学院 BlockAcademy → http://127.0.0.1:${PORT}`);
  console.log(`LLM 代理端点：POST http://127.0.0.1:${PORT}/api/llm`);
});
