const xml = value => String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]);
const seconds = milliseconds => (Math.max(0, Number(milliseconds) || 0) / 1000).toFixed(3);

export function reportToJUnit(report) {
  if (!report || !Array.isArray(report.tests)) throw new TypeError('Neplatný testovací protokol.');
  const tests = report.tests.length ? report.tests : [{ id: 'INFRA', title: 'Spuštění testů', area: 'Prostředí', status: 'error', actual: report.message || 'Běh testů selhal.', durationMs: 0 }];
  const failures = tests.filter(test => test.status === 'failed').length;
  const errors = tests.filter(test => test.status === 'error').length;
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', `<testsuite name="ReleaseGuard ${xml(report.scenario || '')}" tests="${tests.length}" failures="${failures}" errors="${errors}" time="${seconds(report.durationMs)}">`];
  for (const test of tests) {
    const name = xml(`${test.id}: ${test.title}`), group = xml(test.area || 'Kontrola');
    const opener = `  <testcase classname="${group}" name="${name}" time="${seconds(test.durationMs)}"`;
    if (test.status === 'passed') { lines.push(opener + '/>'); continue; }
    const tag = test.status === 'failed' ? 'failure' : 'error';
    lines.push(opener + '>', `    <${tag} message="${xml(test.actual)}">${xml(`Očekáváno: ${test.expected || '—'}\nZjištěno: ${test.actual || '—'}`)}</${tag}>`, '  </testcase>');
  }
  lines.push('</testsuite>', '');
  return lines.join('\n');
}
