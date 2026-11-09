import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, rm, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createReleaseServer } from '../server.mjs';
import { launchBrowser } from '../runner.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temp = await mkdtemp(path.join(tmpdir(), 'releaseguard-qa-'));
const server = createReleaseServer({ port: 0, dataPath: path.join(temp, 'history.sqlite'), artifactRoot: path.join(temp, 'artifacts') });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(base, { waitUntil: 'networkidle' });
  assert.equal(await page.locator('#server-status').innerText(), 'Server dostupný');
  await page.locator('.tech-details summary').click();
  assert.equal(await page.locator('.tech-details').getAttribute('open'), '');
  await page.locator('#run-button').click();
  await page.waitForFunction(() => document.querySelector('#metric-passed')?.textContent === '7', null, { timeout: 20000 });
  assert.equal(await page.locator('#metric-failed').innerText(), '0');
  for(const [scenario,failed] of [['duplicate',1],['stock',2],['validation',1]]){
    await page.locator('#scenario').selectOption(scenario);
    await page.locator('#run-button').click();
    await page.waitForFunction(()=>!document.querySelector('#run-button').disabled,null,{timeout:20000});
    assert.equal(await page.locator('#metric-failed').innerText(),String(failed),`Fault ${scenario} must be detected`);
    assert.equal(await page.locator('#metric-passed').innerText(),String(7-failed));
  }
  await page.locator('#scenario').selectOption('price');
  await page.locator('#run-button').click();
  await page.waitForFunction(() => document.querySelector('#metric-failed')?.textContent === '1', null, { timeout: 20000 });
  const junitDownload = page.waitForEvent('download');
  await page.locator('#download-junit').click();
  const junitFile = await junitDownload;
  assert.match(await readFile(await junitFile.path(), 'utf8'), /tests="7" failures="1" errors="0"/);
  await writeFile(path.join(temp,'junit.xml'),await readFile(await junitFile.path()));
  await page.locator('[data-filter="failed"]').click();
  assert.equal(await page.locator('.case-row').count(), 1);
  await page.locator('.case-row').click();
  assert.match(await page.locator('#case-detail').innerText(), /Web: 1.*390.*API: 1290/);
  assert.equal(await page.locator('.detail-evidence').count(), 1);
  const saved = page.waitForEvent('download');
  await page.locator('#download-case').click();
  const reportFile = await saved;
  assert.equal(reportFile.suggestedFilename(), 'releaseguard-CAT-UI-01.md');
  assert.match(await readFile(await reportFile.path(), 'utf8'), /Postup k opakování/);
  await page.locator('#dialog-close').click();
  await page.locator('[data-filter="all"]').click();
  await mkdir(path.join(root, 'docs'), { recursive: true });
  await page.screenshot({ path: path.join(root, 'docs', 'preview.png'), fullPage: true });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('#metric-failed')?.textContent === '1');
  const store = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await store.goto(base + '/store', { waitUntil: 'networkidle' });
  assert.equal(await store.locator('.product-card').count(), 3);
  assert.equal(await store.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await store.locator('#email').fill('qa@example.test');
  await store.locator('#order-button').click();
  await store.locator('#confirmation').waitFor({ state: 'visible' });
  assert.match(await store.locator('#confirmation').innerText(), /Objednávka #1/);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: path.join(root, 'docs', 'mobile-preview.png'), fullPage: true });
  assert.deepEqual(errors, []);
  console.log('Browser QA passed: clean 7/7, all four injected faults detected, screenshot, JUnit, Markdown bug report, history reload, mobile dashboard/store, manual checkout.');
} finally {
  if(process.env.CI){
    await cp(temp,path.join(root,'qa-artifacts'),{recursive:true});
  }
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve)); server.releaseGuardClose();
  const resolved = path.resolve(temp), parent = path.resolve(tmpdir()) + path.sep;
  if (!resolved.startsWith(parent)) throw new Error('Unsafe QA cleanup path');
  await rm(resolved, { recursive: true, force: true });
}
