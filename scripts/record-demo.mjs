import {record,nodeServer} from './recording.mjs';
import {createReleaseServer} from '../server.mjs';import {fileURLToPath} from 'node:url';import path from 'node:path';import {readFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url));
await record({root,slug:'releaseguard',start:async temp=>{const s=createReleaseServer({port:0,dataPath:path.join(temp,'history.sqlite'),artifactRoot:path.join(temp,'artifacts')});return nodeServer(s,()=>s.releaseGuardClose())},walk:async({p,cue,hold,ui})=>{
  await cue('Nejdřív otestujeme zdravý stav fiktivního e-shopu přes API, databázi a prohlížeč.');await ui.click(p.locator('#run-button'));await p.waitForFunction(()=>document.querySelector('#metric-passed').textContent==='7',null,{timeout:30000});assert.equal(await p.locator('#metric-failed').innerText(),'0');await hold(4);
  await cue('Všech sedm kontrol prošlo. Teď vložíme chybu: cena na webu se liší od API.');await ui.select(p.locator('#scenario'), 'price');await ui.click(p.locator('#run-button'));await p.waitForFunction(()=>document.querySelector('#metric-failed').textContent==='1',null,{timeout:30000});await cue('Kontrola zachytila jednu chybu v ceně.');await hold(4);
  await cue('Zobrazíme selhanou kontrolu a otevřeme její detail.');await ui.click(p.locator('[data-filter="failed"]'));await ui.click(p.locator('.case-row'));assert.match(await p.locator('#case-detail').innerText(),/Web: 1.*390.*API: 1290/);assert.equal(await p.locator('.detail-evidence').count(),1);
  await cue('Nález obsahuje očekávání, skutečnou cenu, kroky k opakování a screenshot.');await hold(5);
  await cue('Hlášení chyby stáhneme pro vývojáře.');const pending=p.waitForEvent('download');await ui.click(p.locator('#download-case'));const report=await readFile(await(await pending).path(),'utf8');assert.match(report,/Postup k opakování/);await ui.click(p.locator('#dialog-close'));
  await cue('Na disk se ukládá historie testů, nikoli trvalá evidence objednávek.');await hold(4);
  return {clean:{passed:7,failed:0},priceFault:{passed:6,failed:1},screenshotEvidence:true,bugReportDownloaded:true};
}});
