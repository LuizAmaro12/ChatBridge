import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyAudit } from './audit.mjs';

const report = high => JSON.stringify({ metadata: { vulnerabilities:
  { info: 0, low: 0, moderate: 0, high, critical: 0, total: high } } });
test('alertas com exit 1 permanecem explícitos e informativos', () => {
  assert.equal(classifyAudit(report(12), 1).status, 'vulnerabilities_reported');
  assert.equal(classifyAudit(report(12), 1).counts.high, 12);
});
test('zero alertas exige relatório válido e exit 0', () => {
  assert.equal(classifyAudit(report(0), 0).status, 'no_known_alerts');
  assert.equal(classifyAudit(report(0), 1).status, 'collection_error');
  assert.equal(classifyAudit(report(12), 0).status, 'collection_error');
});
test('endpoint indisponível, JSON inválido, timeout e contagens incompletas não viram aprovação', () => {
  for (const [body, code] of [['{"error":{"code":"ENETUNREACH"}}', 1], ['invalid', 1],
    [report(0), null], ['null', 0], ['{"metadata":{"vulnerabilities":{"total":0}}}', 0],
    [report(2).replace('"total":2', '"total":1'), 1]]) {
    assert.equal(classifyAudit(body, code).status, 'collection_error');
  }
});
