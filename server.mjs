import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { createStore, orderById, placeOrder, products, SCENARIOS } from './store.mjs';
import { runSuite } from './runner.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const STATIC = Object.freeze({
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/report-junit.mjs': ['report-junit.mjs', 'text/javascript; charset=utf-8'],
  '/style.css': ['style.css', 'text/css; charset=utf-8'],
  '/store': ['store.html', 'text/html; charset=utf-8'],
  '/store.js': ['store.js', 'text/javascript; charset=utf-8'],
});
const CSP = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";

function headers(type) {
  return { 'Content-Type': type, 'Content-Security-Policy': CSP, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store' };
}
function json(res, status, data) {
  const body = Buffer.from(JSON.stringify(data));
  res.writeHead(status, { ...headers('application/json; charset=utf-8'), 'Content-Length': body.length });
  res.end(body);
}
async function bodyJson(req) {
  let total = 0, chunks = [];
  for await (const chunk of req) {
    total += chunk.length;
    if (total > 16_384) { const error = new Error('Požadavek přesahuje 16 KB.'); error.status = 413; throw error; }
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { const error = new Error('Neplatný JSON.'); error.status = 400; throw error; }
}

export function createReleaseServer({ port = 4191, dataPath = path.join(ROOT, 'data', 'releaseguard.sqlite'), artifactRoot = path.join(ROOT, 'artifacts') } = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid port');
  mkdirSync(path.dirname(dataPath), { recursive: true });
  const history = new DatabaseSync(dataPath), demo = createStore();
  history.exec('CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, scenario TEXT NOT NULL, status TEXT NOT NULL, started_at TEXT NOT NULL, report_json TEXT)');
  const contexts = new Map();
  let active = false;
  const server = http.createServer(async (req, res) => {
    try {
      const ownPort = server.address()?.port ?? port;
      const host = req.headers.host;
      if (host !== `127.0.0.1:${ownPort}` && host !== `localhost:${ownPort}`) return json(res, 403, { error: 'Neplatný místní Host.' });
      if (!['GET', 'HEAD', 'POST'].includes(req.method)) return json(res, 405, { error: 'Metoda není povolena.' });
      if (req.method === 'POST' && ((req.headers.origin && req.headers.origin !== `http://${host}`) || req.headers['sec-fetch-site'] === 'cross-site')) return json(res, 403, { error: 'Cizí stránka nesmí volat místní API.' });
      const url = new URL(req.url, `http://${host}`), pathname = url.pathname;
      if (Object.hasOwn(STATIC, pathname) && req.method !== 'POST') {
        const [file, type] = STATIC[pathname], bytes = readFileSync(path.join(ROOT, 'web', file));
        res.writeHead(200, { ...headers(type), 'Content-Length': bytes.length });
        return res.end(req.method === 'HEAD' ? undefined : bytes);
      }
      const artifact = /^\/artifacts\/([a-f0-9-]{36})\/([A-Z0-9-]+)\.(png|zip)$/.exec(pathname);
      if (artifact && req.method !== 'POST') {
        const filename = path.join(artifactRoot, `${artifact[1]}-${artifact[2]}.${artifact[3]}`);
        if (!existsSync(filename)) return json(res, 404, { error: 'Příloha nenalezena.' });
        const bytes = readFileSync(filename);
        res.writeHead(200, { ...headers(artifact[3] === 'png' ? 'image/png' : 'application/zip'), 'Content-Length': bytes.length });
        return res.end(req.method === 'HEAD' ? undefined : bytes);
      }
      if (pathname === '/api/health' && req.method === 'GET') return json(res, 200, { ok: true, active });
      if (pathname === '/api/scenarios' && req.method === 'GET') return json(res, 200, { scenarios: SCENARIOS });
      if (pathname === '/api/runs' && req.method === 'GET') {
        const rows = history.prepare('SELECT id, scenario, status, started_at AS startedAt, report_json AS reportJson FROM runs ORDER BY started_at DESC LIMIT 20').all();
        return json(res, 200, { runs: rows.map(({ reportJson, ...row }) => {
          if (!reportJson) return row;
          const { passed, failed, errors } = JSON.parse(reportJson);
          return { ...row, passed, failed, errors };
        }) });
      }
      const runMatch = /^\/api\/runs\/([a-f0-9-]{36})$/.exec(pathname);
      if (runMatch && req.method === 'GET') {
        const row = history.prepare('SELECT id, scenario, status, started_at AS startedAt, report_json AS reportJson FROM runs WHERE id = ?').get(runMatch[1]);
        return row ? json(res, 200, { id: row.id, scenario: row.scenario, status: row.status, startedAt: row.startedAt, report: row.reportJson ? JSON.parse(row.reportJson) : null }) : json(res, 404, { error: 'Běh nenalezen.' });
      }
      if (pathname === '/api/runs' && req.method === 'POST') {
        const input = await bodyJson(req);
        if (!input || typeof input.scenario !== 'string' || !Object.hasOwn(SCENARIOS, input.scenario)) return json(res, 400, { error: 'Neznámý testovací scénář.' });
        if (active) return json(res, 409, { error: 'Jiný test právě běží.' });
        const id = randomUUID();
        history.prepare('INSERT INTO runs VALUES (?, ?, ?, ?, NULL)').run(id, input.scenario, 'running', new Date().toISOString());
        active = true;
        json(res, 202, { id });
        setImmediate(async () => {
          try {
            const report = await runSuite({ baseUrl: `http://127.0.0.1:${server.address().port}`, scenario: input.scenario, runId: id, contexts, artifactRoot });
            history.prepare('UPDATE runs SET status = ?, report_json = ? WHERE id = ?').run('done', JSON.stringify(report), id);
          } catch (error) {
            history.prepare('UPDATE runs SET status = ?, report_json = ? WHERE id = ?').run('error', JSON.stringify({ id, scenario: input.scenario, message: error.message, passed: 0, failed: 0, errors: 1, tests: [] }), id);
          } finally { active = false; }
        });
        return;
      }
      const token = url.searchParams.get('run'), store = token ? contexts.get(token) : demo;
      if (pathname.startsWith('/api/store/')) {
        if (!store) return json(res, 404, { error: 'Testovací relace nenalezena.' });
        if (pathname === '/api/store/products' && req.method === 'GET') {
          return json(res, 200, { products: products(store).map(p => ({ ...p, displayPriceCents: store.fault === 'price' && p.id === 'luma' ? p.priceCents + 10000 : p.priceCents })) });
        }
        const orderMatch = /^\/api\/store\/orders\/(\d{1,12})$/.exec(pathname);
        if (orderMatch && req.method === 'GET') {
          const order = orderById(store, Number(orderMatch[1]));
          return order ? json(res, 200, { order }) : json(res, 404, { error: 'Objednávka nenalezena.' });
        }
        if (pathname === '/api/store/orders' && req.method === 'POST') {
          const outcome = placeOrder(store, await bodyJson(req));
          return json(res, outcome.status, outcome.body);
        }
      }
      return json(res, 404, { error: 'Nenalezeno.' });
    } catch (error) {
      if (!res.headersSent) json(res, error.status || 500, { error: error.status ? error.message : 'Vnitřní chyba serveru.' });
      else res.end();
    }
  });
  server.releaseGuardClose = () => { demo.close(); history.close(); };
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 4191);
  createReleaseServer({ port }).listen(port, '127.0.0.1', () => console.log(`ReleaseGuard: http://127.0.0.1:${port}`));
}
