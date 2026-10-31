import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { chromium } from 'playwright';
import { createStore, orderCount, products, SCENARIOS } from './store.mjs';

class CheckFailure extends Error {}
function check(ok, detail) { if (!ok) throw new CheckFailure(detail); return detail; }
async function request(base, method, pathname, body) {
  const response = await fetch(base + pathname, {
    method,
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(6000),
  });
  return { status: response.status, data: await response.json() };
}
const orderInput = (key, quantity = 2) => ({ productId: 'luma', quantity, email: 'demo@example.test', idempotencyKey: key });

const CASES = [
  {
    id: 'CAT-API-01', area: 'API', title: 'Katalog má platnou strukturu',
    expected: 'Tři produkty s ID, názvem, cenou v haléřích a nezáporným skladem.',
    steps: ['Načíst GET /api/store/products.', 'Zkontrolovat typy a povinná pole odpovědi.'],
    async test({ base, token }) {
      const { status, data } = await request(base, 'GET', `/api/store/products?run=${token}`);
      return check(status === 200 && data.products?.length === 3 && data.products.every(p => typeof p.id === 'string' && typeof p.title === 'string' && Number.isInteger(p.priceCents) && p.priceCents > 0 && Number.isInteger(p.stock) && p.stock >= 0), `HTTP ${status}; produkty ${data.products?.length ?? 'chybí'}; typy ${data.products?.map(p => typeof p.priceCents).join(', ') ?? 'chybí'}`);
    },
  },
  {
    id: 'ORD-API-01', area: 'API + SQL', title: 'Neplatný počet kusů se odmítne',
    expected: 'HTTP 400 a žádná objednávka v databázi.',
    steps: ['Odeslat POST /api/store/orders s quantity = 0.', 'Ověřit odpověď a počet řádků v tabulce orders.'],
    async test({ base, token, store }) {
      const { status } = await request(base, 'POST', `/api/store/orders?run=${token}`, orderInput('invalid-qty-001', 0));
      const count = orderCount(store);
      return check(status === 400 && count === 0, `HTTP ${status}; objednávek v SQL: ${count}`);
    },
  },
  {
    id: 'ORD-API-02', area: 'API + SQL', title: 'Opakovaný požadavek nevytvoří další objednávku',
    expected: 'První požadavek 201, opakování 200 se stejným ID; jeden SQL řádek a jeden odečet skladu.',
    steps: ['Odeslat stejnou objednávku dvakrát se stejným idempotencyKey.', 'Porovnat ID, počet objednávek a sklad.'],
    async test({ base, token, store }) {
      const before = products(store).find(p => p.id === 'luma').stock;
      const one = await request(base, 'POST', `/api/store/orders?run=${token}`, orderInput('repeat-key-001'));
      const two = await request(base, 'POST', `/api/store/orders?run=${token}`, orderInput('repeat-key-001'));
      const count = orderCount(store), after = products(store).find(p => p.id === 'luma').stock;
      return check(one.status === 201 && two.status === 200 && one.data.order?.id === two.data.order?.id && count === 1 && after === before - 2, `HTTP ${one.status}/${two.status}; ID ${one.data.order?.id}/${two.data.order?.id}; SQL řádků ${count}; sklad ${before}→${after}`);
    },
  },
  {
    id: 'ORD-DB-01', area: 'SQL', title: 'Objednávka a sklad si odpovídají',
    expected: 'Objednávka má přesnou cenu a sklad klesne o objednané dva kusy.',
    steps: ['Načíst cenu a sklad produktu ze SQL.', 'Vytvořit objednávku dvou kusů.', 'Porovnat order.total_cents a nový products.stock.'],
    async test({ base, token, store }) {
      const before = products(store).find(p => p.id === 'luma');
      const { status, data } = await request(base, 'POST', `/api/store/orders?run=${token}`, orderInput('stock-check-001'));
      const after = products(store).find(p => p.id === 'luma');
      return check(status === 201 && data.order?.totalCents === before.priceCents * 2 && after.stock === before.stock - 2, `HTTP ${status}; součet ${data.order?.totalCents}; očekáváno ${before.priceCents * 2}; sklad ${before.stock}→${after.stock}`);
    },
  },
  {
    id: 'ORD-API-03', area: 'API + SQL', title: 'Nedostupné množství se neprodá',
    expected: 'HTTP 409, sklad ani tabulka objednávek se nezmění.',
    steps: ['Pokusit se objednat devět kusů při zásobě osm.', 'Zkontrolovat stav API a SQL.'],
    async test({ base, token, store }) {
      const { status } = await request(base, 'POST', `/api/store/orders?run=${token}`, orderInput('soldout-key-001', 9));
      const count = orderCount(store), stock = products(store).find(p => p.id === 'luma').stock;
      return check(status === 409 && count === 0 && stock === 8, `HTTP ${status}; SQL řádků ${count}; sklad ${stock}`);
    },
  },
  {
    id: 'CAT-UI-01', area: 'Prohlížeč', title: 'Cena na stránce odpovídá API',
    expected: 'Viditelná cena lampy je 1 290 Kč stejně jako 129 000 haléřů v API.',
    steps: ['Otevřít testovaný obchod v prohlížeči.', 'Přečíst viditelnou cenu lampy.', 'Porovnat ji s cenou z API.'],
    async test({ base, token, page }) {
      await page.goto(`${base}/store?run=${token}`, { waitUntil: 'networkidle' });
      const shown = await page.locator('[data-product-id="luma"] .product-price').innerText();
      const { data } = await request(base, 'GET', `/api/store/products?run=${token}`);
      const expected = data.products.find(p => p.id === 'luma').priceCents / 100;
      const actual = Number(shown.replace(/\D/g, ''));
      return check(actual === expected, `Web: ${shown}; API: ${expected} Kč`);
    },
  },
  {
    id: 'ORD-UI-01', area: 'Prohlížeč + SQL', title: 'Nákup ve webu vytvoří správný záznam',
    expected: 'Potvrzení ve webu a právě jedna objednávka s jedním kusem v SQL.',
    steps: ['Otevřít testovaný obchod.', 'Vyplnit e-mail a potvrdit nákup jednoho kusu.', 'Ověřit potvrzení a SQL řádek.'],
    async test({ base, token, store, page }) {
      await page.goto(`${base}/store?run=${token}`, { waitUntil: 'networkidle' });
      await page.locator('#product').selectOption('luma');
      await page.locator('#email').fill('browser@example.test');
      await page.locator('#quantity').fill('1');
      await page.locator('#order-button').click();
      await page.locator('#confirmation').waitFor({ state: 'visible' });
      const message = await page.locator('#confirmation').innerText();
      const row = store.db.prepare('SELECT quantity, total_cents AS totalCents FROM orders').get();
      return check(message.includes('Objednávka #1') && orderCount(store) === 1 && row?.quantity === 1 && row.totalCents === 129000, `Web: ${message}; SQL: ${JSON.stringify(row)}`);
    },
  },
];

function edgeExecutable() {
  if (process.env.RELEASEGUARD_BROWSER_PATH) return process.env.RELEASEGUARD_BROWSER_PATH;
  if (process.platform !== 'win32') return null;
  const root = 'C:\\Program Files (x86)\\Microsoft\\EdgeCore';
  if (!existsSync(root)) return null;
  for (const version of readdirSync(root).sort().reverse()) {
    const candidate = path.join(root, version, 'msedge.exe');
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

export async function launchBrowser() {
  try { return await chromium.launch({ headless: true }); }
  catch (error) {
    const executablePath = edgeExecutable();
    if (!executablePath) throw new Error('Prohlížeč Playwright chybí. Spusťte pnpm exec playwright install chromium.');
    return chromium.launch({ headless: true, executablePath });
  }
}

export async function runSuite({ baseUrl, scenario, runId, contexts, artifactRoot }) {
  if (!Object.hasOwn(SCENARIOS, scenario)) throw new Error('Unknown scenario');
  const started = performance.now(), tests = [];
  let browser = null, browserError = null;
  try { browser = await launchBrowser(); } catch (error) { browserError = error.message; }
  mkdirSync(artifactRoot, { recursive: true });
  try {
    for (const item of CASES) {
      const token = randomUUID(), store = createStore(scenario), t0 = performance.now();
      contexts.set(token, store);
      let context = null, page = null, status = 'passed', actual = '', screenshot = null, trace = null;
      const isBrowser = item.area.includes('Prohlížeč');
      try {
        if (isBrowser) {
          if (!browser) { const err = new Error(browserError); err.environment = true; throw err; }
          context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
          await context.tracing.start({ screenshots: true, snapshots: true });
          page = await context.newPage(); page.setDefaultTimeout(6000);
        }
        actual = await item.test({ base: baseUrl, token, store, page });
      } catch (error) {
        status = error instanceof CheckFailure || (page && error.name === 'TimeoutError') ? 'failed' : 'error'; actual = error.message || String(error);
        if (page) {
          const basename = `${runId}-${item.id}`;
          try { await page.screenshot({ path: path.join(artifactRoot, `${basename}.png`), fullPage: true }); screenshot = `/artifacts/${runId}/${item.id}.png`; } catch { /* Page may have closed. */ }
        }
      } finally {
        if (context) {
          const tracePath = status !== 'passed' ? path.join(artifactRoot, `${runId}-${item.id}.zip`) : undefined;
          try { await context.tracing.stop(tracePath ? { path: tracePath } : {}); if (tracePath) trace = `/artifacts/${runId}/${item.id}.zip`; } catch { /* Trace is optional evidence. */ }
          await context.close();
        }
        contexts.delete(token); store.close();
      }
      tests.push({ id: item.id, area: item.area, title: item.title, status, expected: item.expected, actual, steps: item.steps, durationMs: Math.round(performance.now() - t0), screenshot, trace });
    }
  } finally { if (browser) await browser.close(); }
  return { id: runId, scenario, scenarioLabel: SCENARIOS[scenario], createdAt: new Date().toISOString(), durationMs: Math.round(performance.now() - started), passed: tests.filter(x => x.status === 'passed').length, failed: tests.filter(x => x.status === 'failed').length, errors: tests.filter(x => x.status === 'error').length, tests };
}
