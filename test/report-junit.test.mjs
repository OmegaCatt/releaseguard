import test from 'node:test';
import assert from 'node:assert/strict';
import { reportToJUnit } from '../web/report-junit.mjs';

test('JUnit export distinguishes failed checks and environment errors and escapes XML', () => {
  const report = { scenario: 'price', durationMs: 1200, tests: [
    { id: 'A', title: 'Cena < API', area: 'Web', status: 'failed', actual: '390 & 1290', expected: 'Shoda', durationMs: 50 },
    { id: 'B', title: 'Prohlížeč', area: 'Prostředí', status: 'error', actual: 'Chybí "browser"', durationMs: 20 },
    { id: 'C', title: 'Databáze', area: 'SQL', status: 'passed', durationMs: 10 }
  ] };
  const xml = reportToJUnit(report);
  assert.match(xml, /tests="3" failures="1" errors="1"/);
  assert.match(xml, /Cena &lt; API/);
  assert.match(xml, /390 &amp; 1290/);
  assert.match(xml, /<failure /);
  assert.match(xml, /<error /);
  assert.match(xml, /name="C: Databáze" time="0.010"\/>/);
  assert.match(reportToJUnit({ scenario: 'clean', message: 'Server unavailable', tests: [] }), /name="INFRA: Spuštění testů"/);
});
