import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createReleaseServer } from '../server.mjs';

test('local server serves approved files and rejects cross-origin writes and bad input', async t => {
  const directory = mkdtempSync(path.join(tmpdir(), 'releaseguard-test-'));
  const server = createReleaseServer({ port: 0, dataPath: path.join(directory, 'history.sqlite'), artifactRoot: path.join(directory, 'artifacts') });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); server.releaseGuardClose(); rmSync(directory, { recursive: true }); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const page = await fetch(base + '/'); assert.equal(page.status, 200); assert.match(await page.text(), /Kontrola před vydáním/);
  assert.equal((await fetch(base + '/api/health')).status, 200);
  assert.equal((await fetch(base + '/server.mjs')).status, 404);
  const wrongHost = await new Promise(resolve => http.get(base + '/api/health', { headers: { Host: 'attacker.example' } }, response => { response.resume(); resolve(response.statusCode); }));
  assert.equal(wrongHost, 403);
  assert.equal((await fetch(base + '/api/runs', { method: 'POST', headers: { Origin: 'https://attacker.example', 'content-type': 'application/json' }, body: JSON.stringify({ scenario: 'clean' }) })).status, 403);
  assert.equal((await fetch(base + '/api/runs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ scenario: 'unknown' }) })).status, 400);
  assert.equal((await fetch(base + '/api/runs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{broken' })).status, 400);
  const products = await (await fetch(base + '/api/store/products')).json();
  assert.equal(products.products.length, 3);
  assert.equal((await fetch(base + '/api/store/products?run=missing')).status, 404);
});
test('two concurrent requests cannot both purchase the last available stock',async t=>{
 const directory=mkdtempSync(path.join(tmpdir(),'releaseguard-stock-'));
 const server=createReleaseServer({port:0,dataPath:path.join(directory,'history.sqlite'),artifactRoot:path.join(directory,'artifacts')});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{await new Promise(resolve=>server.close(resolve));server.releaseGuardClose();if(!path.resolve(directory).startsWith(path.resolve(tmpdir())+path.sep))throw Error('Unsafe cleanup path');rmSync(directory,{recursive:true})});
 const base=`http://127.0.0.1:${server.address().port}`;
 const purchase=key=>fetch(base+'/api/store/orders',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({productId:'luma',quantity:8,email:'demo@example.test',idempotencyKey:key})});
 const responses=await Promise.all([purchase('last-stock-key-001'),purchase('last-stock-key-002')]);
 assert.deepEqual(responses.map(r=>r.status).sort(),[201,409]);
 const catalog=await (await fetch(base+'/api/store/products')).json();
 assert.equal(catalog.products.find(p=>p.id==='luma').stock,0);
});
