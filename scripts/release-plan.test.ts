import assert from 'node:assert/strict';
import test from 'node:test';
import { planRelease } from './release-plan.ts';

const item = { number: 12, body: '## CHANGELOG\n### Fixed\n- Preserve reviewed behavior.' };
await test('plans a dated release and retains previous changelog without mutating input', () => {
  const result = planRelease({ version: '0.4.1', changelog: '# Changelog\n\n## [0.4.0] - 2026-11-01\n\nOld.\n', date: '2026-11-06', pullRequests: [item] });
  assert.equal(result.version, '0.4.1');
  assert.match(result.changelog, /## \[0\.4\.1\] - 2026-11-06/);
  assert.match(result.changelog, /Preserve reviewed behavior\. \(#12\)/);
  assert.match(result.changelog, /## \[0\.4\.0\]/);
});
await test('rejects malformed dates and duplicate pull requests', () => {
  const base = { version: '0.4.0', changelog: '# Changelog\n', date: '2026-11-06', pullRequests: [item] };
  assert.throws(() => planRelease({ ...base, date: '2026-02-30' }), /date/);
  assert.throws(() => planRelease({ ...base, pullRequests: [item, item] }), /duplicate/);
});

await test('dates the initial release and preserves unreleased notes', () => {
  const result = planRelease({ version: '0.1.0', changelog: '# Changelog\n\n## [0.1.0] - Unreleased\n\n- Existing note.\n', date: '2026-11-06', pullRequests: [item] });
  assert.equal(result.version, '0.1.0');
  assert.match(result.changelog, /Existing note/);
  assert.doesNotMatch(result.changelog, /Unreleased/);
});

await test('keeps explanatory material preceding an unreleased section', () => {
  const result = planRelease({ version: '0.1.0', changelog: '# Changelog\n\nPolicy text.\n\n## [0.1.0] - Unreleased\n\n- Existing.\n', date: '2026-11-06', pullRequests: [item] });
  assert.match(result.changelog, /Policy text/);
  assert.match(result.changelog, /Existing/);
});
