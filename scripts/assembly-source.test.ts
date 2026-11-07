import assert from 'node:assert/strict';
import test from 'node:test';
import { selectAssemblySource } from './assembly-source.ts';
const sourceSha = 'a'.repeat(40), mainSha = 'b'.repeat(40);
const recovery = { sourceSha, mainSha, headMessage: `chore: assemble CHANGELOG 0.1.0\n\nChangelog-Source: ${sourceSha}`,
  headParents: [sourceSha], changedFiles: [{ filename: 'CHANGELOG.md', status: 'modified' }] };
await test('accepts checked source and a changelog-only assembly child', () => {
  assert.deepEqual(selectAssemblySource({ sourceSha, mainSha: sourceSha }), { assemble: true, checkoutSha: sourceSha });
  assert.deepEqual(selectAssemblySource(recovery), { assemble: true, checkoutSha: mainSha });
});
await test('refuses unsafe recovery and skips an unrelated newer main', () => {
  assert.throws(() => selectAssemblySource({ ...recovery, changedFiles: [{ filename: 'scripts/release.ts', status: 'modified' }] }), /Unsafe/);
  assert.throws(() => selectAssemblySource({ ...recovery, headParents: [mainSha] }), /Unsafe/);
  assert.deepEqual(selectAssemblySource({ ...recovery, headMessage: 'another commit' }), { assemble: false, checkoutSha: sourceSha });
});
