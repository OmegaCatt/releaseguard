import { reportToJUnit } from './report-junit.mjs';
const $ = id => document.getElementById(id);
const state = { report: null, currentId: null, selectedTest: null, filter: 'all', busy: false, poll: null };
const notes = {
  clean: 'Bez závady: všech sedm kontrol má projít.',
  duplicate: 'Vložená závada: opakovaný požadavek může vytvořit druhou objednávku.',
  stock: 'Vložená závada: objednávka neodečte sklad.',
  validation: 'Vložená závada: API přijme nula kusů.',
  price: 'Vložená závada: web ukazuje jinou cenu než API.',
};
const labels = { clean: 'Bez závady', duplicate: 'Opakovaná objednávka', stock: 'Nesoulad skladu', validation: 'Chybějící validace', price: 'Stará cena na webu' };
const countWord = (count, one, few, many) => `${count} ${count === 1 ? one : count >= 2 && count <= 4 ? few : many}`;
function node(tag, className = '', text = '') { const element = document.createElement(tag); if (className) element.className = className; element.textContent = text; return element; }
function toast(message) { const el = $('toast'); el.textContent = message; el.hidden = false; clearTimeout(toast.timer); toast.timer = setTimeout(() => { el.hidden = true; }, 4000); }
async function api(path, options = {}) { const response = await fetch(path, { credentials: 'same-origin', ...options }); let data; try { data = await response.json(); } catch { data = { error: 'Server nevrátil JSON.' }; } if (!response.ok) throw new Error(data.error || 'Požadavek se nezdařil.'); return data; }
const date = value => new Date(value).toLocaleString('cs-CZ', { dateStyle: 'short', timeStyle: 'short' });
function setBusy(value) { state.busy = value; $('run-button').disabled = value; $('scenario').disabled = value; $('run-button').firstChild.textContent = value ? 'Kontroly běží… ' : 'Spustit 7 kontrol '; }
function showView(view) { for (const name of ['overview', 'target', 'method']) $(`${name}-view`).hidden = name !== view; for (const button of document.querySelectorAll('.nav-item')) { const active = button.dataset.view === view; button.classList.toggle('active', active); active ? button.setAttribute('aria-current', 'page') : button.removeAttribute('aria-current'); } window.scrollTo(0, 0); }
function statusText(value) { return { passed: 'Prošlo', failed: 'Chyba', error: 'Prostředí' }[value] || 'Čeká'; }
function renderCases() {
  const root = $('case-list'); root.replaceChildren();
  if (!state.report) { root.append(node('p', 'empty', state.busy ? 'Kontroly probíhají. Výsledky se zobrazí po dokončení.' : 'Vyberte scénář a spusťte kontroly.')); return; }
  const tests = state.report.tests.filter(test => state.filter === 'all' || (state.filter === 'failed' ? test.status !== 'passed' : test.status === 'passed'));
  if (!tests.length) { root.append(node('p', 'empty', 'V tomto filtru nejsou žádné výsledky.')); return; }
  for (const test of tests) {
    const row = node('button', 'case-row'); row.type = 'button';
    row.append(node('span', 'case-code', test.id), node('span', 'case-name', test.title), node('span', 'case-area', test.area), node('span', 'case-duration', `${test.durationMs} ms`), node('span', 'case-arrow', '›'));
    const badge = node('span', `badge ${test.status}`, statusText(test.status)); row.prepend(badge);
    row.addEventListener('click', () => showCase(test)); root.append(row);
  }
}
function renderReport() {
  const report = state.report;
  $('metric-total').textContent = report ? report.tests.length : '—';
  $('metric-passed').textContent = report ? report.passed : '—';
  $('metric-failed').textContent = report ? report.failed + report.errors : '—';
  $('metric-duration').textContent = report ? `${(report.durationMs / 1000).toFixed(1)} s` : '—';
  $('report-subtitle').textContent = report ? (report.message || `${report.scenarioLabel} · ${date(report.createdAt)} · ${countWord(report.failed, 'chyba', 'chyby', 'chyb')}, ${countWord(report.errors, 'chyba', 'chyby', 'chyb')} prostředí`) : state.busy ? 'Kontroly probíhají…' : 'Zatím nebyl spuštěn žádný test.';
  $('download-report').disabled = !report;
  $('download-junit').disabled = !report;
  renderCases();
}
function detailBlock(title, content) { const block = node('section', 'detail-block'); block.append(node('h3', '', title), node('p', '', content)); return block; }
function showCase(test) {
  state.selectedTest = test;
  $('download-case').hidden = test.status === 'passed';
  $('case-code').textContent = `${test.id} · ${test.area} · ${statusText(test.status)}`;
  $('case-title').textContent = test.title;
  const root = $('case-detail'); root.replaceChildren(detailBlock('Očekávaný výsledek', test.expected), detailBlock('Zjištěný výsledek', test.actual));
  const steps = node('section', 'detail-block'); steps.append(node('h3', '', 'Jak ověření opakovat')); const list = node('ol'); for (const step of test.steps) list.append(node('li', '', step)); steps.append(list); root.append(steps);
  if (test.screenshot || test.trace) {
    const evidence = node('section', 'detail-block'); evidence.append(node('h3', '', 'Podklady'));
    if (test.screenshot && /^\/artifacts\/[a-f0-9-]{36}\/[A-Z0-9-]+\.png$/.test(test.screenshot)) { const image = node('img', 'detail-evidence'); image.src = test.screenshot; image.alt = 'Snímek obrazovky při selhání testu'; evidence.append(image); }
    const links = node('div', 'detail-links');
    for (const [href, label] of [[test.screenshot, 'Stáhnout snímek'], [test.trace, 'Stáhnout trace']]) if (href && /^\/artifacts\/[a-f0-9-]{36}\/[A-Z0-9-]+\.(png|zip)$/.test(href)) { const link = node('a', '', label); link.href = href; link.download = ''; links.append(link); }
    evidence.append(links); root.append(evidence);
  }
  $('case-dialog').showModal();
}
function renderHistory(runs) { const root = $('history-list'); root.replaceChildren(); if (!runs.length) { root.append(node('p', 'empty', 'Historie je zatím prázdná.')); return; } for (const run of runs) { const row = node('button', 'history-row'); row.type = 'button'; row.append(node('strong', '', labels[run.scenario] || run.scenario), node('span', '', date(run.startedAt)), node('span', 'history-status', run.status === 'running' ? 'Běží…' : run.status === 'error' ? 'Prostředí' : countWord(run.failed ?? 0, 'chyba', 'chyby', 'chyb'))); row.addEventListener('click', () => loadRun(run.id).catch(error => toast(error.message))); root.append(row); } }
async function loadHistory() { const { runs } = await api('/api/runs'); renderHistory(runs); return runs; }
async function loadRun(id) {
  clearTimeout(state.poll); state.currentId = id;
  const data = await api(`/api/runs/${id}`);
  if (state.currentId !== id) return;
  state.report = data.report; renderReport();
  if (data.status === 'running') { setBusy(true); state.poll = setTimeout(() => loadRun(id).catch(error => { setBusy(false); toast(error.message); }), 550); }
  else { setBusy(false); await loadHistory(); if (data.status === 'error') toast('Běh selhal kvůli prostředí. Podrobnosti jsou v reportu.'); }
}
async function startRun() {
  if (state.busy) return; setBusy(true); state.report = null; renderReport();
  try { const { id } = await api('/api/runs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ scenario: $('scenario').value }) }); await loadRun(id); }
  catch (error) { setBusy(false); toast(error.message); }
}
function downloadReport() { if (!state.report) return; const url = URL.createObjectURL(new Blob([JSON.stringify(state.report, null, 2)], { type: 'application/json' })); const link = node('a'); link.href = url; link.download = `releaseguard-${state.report.scenario}-${state.report.id}.json`; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000); }
function downloadJUnit() { if (!state.report) return; const url = URL.createObjectURL(new Blob([reportToJUnit(state.report)], { type: 'application/xml;charset=utf-8' })); const link = node('a'); link.href = url; link.download = `releaseguard-${state.report.scenario}-${state.report.id}.xml`; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000); }
function downloadCase() {
  const test = state.selectedTest, report = state.report;
  if (!test || !report || test.status === 'passed') return;
  const body = [`# ${test.id}: ${test.title}`, '', `Scénář: ${report.scenarioLabel}`, `Běh: ${report.id}`, `Oblast: ${test.area}`, '', '## Očekávaný výsledek', test.expected, '', '## Zjištěný výsledek', test.actual, '', '## Postup k opakování', ...test.steps.map((step, index) => `${index + 1}. ${step}`), '', '## Podklady', test.screenshot || 'Bez snímku (kontrola API/SQL).', test.trace || 'Bez trace.'].join('\n');
  const url = URL.createObjectURL(new Blob([body], { type: 'text/markdown;charset=utf-8' })); const link = node('a'); link.href = url; link.download = `releaseguard-${test.id}.md`; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}
document.querySelectorAll('.nav-item').forEach(button => button.addEventListener('click', () => showView(button.dataset.view)));
document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => { state.filter = button.dataset.filter; document.querySelectorAll('[data-filter]').forEach(item => item.classList.toggle('active', item === button)); renderCases(); }));
$('scenario').addEventListener('change', () => { $('scenario-note').textContent = notes[$('scenario').value]; });
$('run-button').addEventListener('click', startRun);
$('download-report').addEventListener('click', downloadReport);
$('download-junit').addEventListener('click', downloadJUnit);
$('download-case').addEventListener('click', downloadCase);
$('dialog-close').addEventListener('click', () => $('case-dialog').close());
Promise.all([api('/api/health'), loadHistory()]).then(([, runs]) => { $('server-status').textContent = 'Server dostupný'; if (runs.length) loadRun(runs[0].id).catch(error => toast(error.message)); }).catch(error => { $('server-status').textContent = 'Server nedostupný'; toast(error.message); });
