import assert from 'node:assert/strict';
import test from 'node:test';
import { validateCiSource, validateDeliverySource } from './lifecycle-source.ts';

const repository = 'Arda-cards/mcp-cloudflare';
const sourceSha = 'a'.repeat(40);
const releaseSha = 'b'.repeat(40);
const run = {
  path: '.github/workflows/validate.yaml',
  name: 'Validate marketplace',
  head_repository: { full_name: repository },
  head_branch: 'main',
  event: 'push',
  status: 'completed',
  conclusion: 'success',
  head_sha: sourceSha,
};

await test('a successful trusted main push CI supplies its exact source for assembly', () => {
  assert.deepEqual(validateCiSource(run, repository, 'Merge pull request #26'), {
    sourceSha,
    assemble: true,
  });
});

await test('only the assembly title prefix suppresses a new assembly, not a mention in a merge body', () => {
  assert.deepEqual(validateCiSource(run, repository, 'chore: assemble CHANGELOG v0.4.0'), {
    sourceSha,
    assemble: false,
  });
  assert.equal(
    validateCiSource(run, repository, 'Fix assembly\n\nchore: assemble CHANGELOG example').assemble,
    true,
  );
});

await test('other workflows, repositories, branches, events and unfinished or failed CI cannot authorize assembly', () => {
  for (const patch of [
    { path: '.github/workflows/other.yaml' },
    { name: 'Pretend CI' },
    { head_repository: { full_name: 'untrusted/mcp-cloudflare' } },
    { head_repository: null },
    { head_branch: 'feature' },
    { event: 'pull_request' },
    { event: 'workflow_dispatch' },
    { event: 'merge_group' },
    { status: 'in_progress' },
    { conclusion: 'failure' },
    { conclusion: 'skipped' },
    { head_sha: 'main' },
    { head_sha: `${sourceSha}\n` },
  ])
    assert.throws(() => validateCiSource({ ...run, ...patch }, repository, 'Merge'));
  for (const malformed of [null, undefined, [], 'CI'])
    assert.throws(() => validateCiSource(malformed, repository, 'Merge'));
  assert.throws(() => validateCiSource(run, '', 'Merge'));
  assert.throws(() =>
    validateCiSource(
      { ...run, head_repository: { full_name: `${repository}\n` } },
      `${repository}\n`,
      'Merge',
    ),
  );
  assert.throws(() => validateCiSource(run, repository, null));
});

await test('automatic delivery uses the trusted released assembly instead of the trigger commit', () => {
  assert.deepEqual(
    validateDeliverySource({
      event: 'workflow_run',
      ref: 'refs/heads/main',
      sha: sourceSha,
      releaseSha,
      ciSourceSha: sourceSha,
    }),
    {
      sourceSha: releaseSha,
      manual: false,
    },
  );
});

await test('automatic delivery fails closed without exact release and CI provenance or main context', () => {
  const input = {
    event: 'workflow_run',
    ref: 'refs/heads/main',
    releaseSha,
    ciSourceSha: sourceSha,
  };
  for (const patch of [
    { ref: 'refs/heads/feature' },
    { ref: 'refs/tags/v0.4.0' },
    { releaseSha: '' },
    { releaseSha: 'main' },
    { ciSourceSha: undefined },
    { ciSourceSha: `${sourceSha}\n` },
  ])
    assert.throws(() => validateDeliverySource({ ...input, ...patch }));
});

await test('explicit manual delivery pins a dispatched branch commit and cannot mix release authority', () => {
  for (const ref of ['refs/heads/feature', 'refs/heads/qualification/test'])
    assert.deepEqual(validateDeliverySource({ event: 'workflow_dispatch', ref, sha: sourceSha }), {
      sourceSha,
      manual: true,
    });
  assert.deepEqual(
    validateDeliverySource({
      event: 'workflow_dispatch',
      ref: 'refs/heads/qualification/test',
      sha: sourceSha,
      releaseSha: '',
      ciSourceSha: '',
    }),
    { sourceSha, manual: true },
  );
  for (const patch of [
    { ref: 'refs/heads/main' },
    { ref: 'refs/tags/v0.4.0' },
    { ref: 'refs/heads/' },
    { sha: 'main' },
    { releaseSha },
    { ciSourceSha: sourceSha },
  ])
    assert.throws(() =>
      validateDeliverySource({
        event: 'workflow_dispatch',
        ref: 'refs/heads/qualification/test',
        sha: sourceSha,
        ...patch,
      }),
    );
});

await test('ordinary pushes, PR events and malformed delivery metadata do not become manual dispatches', () => {
  for (const event of ['push', 'pull_request', 'merge_group', '', undefined])
    assert.throws(() => validateDeliverySource({ event, ref: 'refs/heads/main', sha: sourceSha }));
  assert.throws(() => validateDeliverySource(null));
});
