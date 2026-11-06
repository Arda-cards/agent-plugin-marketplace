import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { blockingFindings, checkDirectory } from './codeql-gate.ts';

interface SarifFixture {
  version: string;
  runs: [
    {
      tool: {
        driver: { name: string; rules: [{ id: string; properties: Record<string, unknown> }] };
      };
      results: [{ ruleId: string; level: string }];
      invocations?: { executionSuccessful: boolean }[];
    },
  ];
}

function sarif(score: unknown, level = 'warning'): SarifFixture {
  return {
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'CodeQL',
            rules: [{ id: 'example', properties: { 'security-severity': score } }],
          },
        },
        results: [{ ruleId: 'example', level }],
      },
    ],
  };
}

await test('high/critical findings and errors block; medium warnings do not', () => {
  for (const score of ['7', '9.8', 10]) assert.equal(blockingFindings(sarif(score)), 1);
  assert.equal(blockingFindings(sarif('6.9')), 0);
  assert.equal(blockingFindings(sarif(undefined, 'error')), 1);
});

await test('existing, suppressed and baseline findings cannot silently pass', () => {
  const report = sarif('9');
  Object.assign(report.runs[0].results[0], {
    baselineState: 'unchanged',
    suppressions: [{ kind: 'inSource', status: 'accepted' }],
  });
  assert.equal(blockingFindings(report), 1);
});

await test('missing reports, failed analyses and invalid severities fail closed', () => {
  for (const report of [
    {},
    { version: '2.1.0', runs: [] },
    ...['', 'invalid', '-1', '11', null, false].map((score) => sarif(score)),
  ]) {
    assert.throws(() => blockingFindings(report));
  }
  const report = sarif('1');
  report.runs[0].invocations = [{ executionSuccessful: false }];
  assert.throws(() => blockingFindings(report), /unsuccessful/);
  delete report.runs[0].invocations;
  report.runs[0].results[0].ruleId = 'unknown';
  assert.throws(() => blockingFindings(report), /matching/);
  report.runs[0].results[0].ruleId = 'example';
  report.runs[0].tool.driver.rules[0].properties = { tags: ['security'] };
  assert.throws(() => blockingFindings(report), /severity/);
});

await test('both language reports are mandatory and every SARIF report is evaluated', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'codeql-gate-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  writeFileSync(join(directory, 'actions.sarif'), JSON.stringify(sarif('1')));
  assert.throws(() => checkDirectory(directory), /javascript.sarif/);
  writeFileSync(join(directory, 'javascript.sarif'), JSON.stringify(sarif('1')));
  assert.deepEqual(checkDirectory(directory), { files: 2, blockingFindings: 0 });
  writeFileSync(join(directory, 'additional.sarif'), JSON.stringify(sarif('8')));
  assert.throws(() => checkDirectory(directory), /1 blocking/);
});

await test('resolves SARIF grouped extension rules and rejects invalid references', () => {
  const properties = { 'security-severity': '6.9' };
  const component = { index: 0, name: 'security-queries' };
  const grouped = {
    version: '2.1.0',
    runs: [{
      tool: { driver: { name: 'CodeQL', rules: [] }, extensions: [
        { name: 'security-queries', rules: [{ id: 'example', properties }] },
      ] },
      results: [{ ruleId: 'example', level: 'warning', rule: { index: 0, toolComponent: component } }],
    }],
  };
  assert.equal(blockingFindings(grouped), 0);
  properties['security-severity'] = '9';
  assert.equal(blockingFindings(grouped), 1);
  component.index = 1;
  assert.throws(() => blockingFindings(grouped), /component/);
});
