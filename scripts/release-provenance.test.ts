/* eslint @typescript-eslint/require-await: off -- mocked asynchronous transport */
import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyReleaseTag } from './release-provenance.ts';

const assembly = 'a'.repeat(40);
const tag = 'v1.0.0';
const commit = { type: 'commit', sha: assembly };

await test('lightweight tags bind the exact assembly without another request', async () => {
  await verifyReleaseTag(tag, assembly, commit, async () => {
    throw new Error('Lightweight tag must not be dereferenced');
  });
});

await test('annotated tags resolve up to five objects to the exact assembly', async () => {
  for (const depth of [1, 5]) {
    const requested: string[] = [];
    const tagged = (index: number) => ({ type: 'tag', sha: String(index).repeat(40) });
    await verifyReleaseTag(tag, assembly, tagged(1), async (sha) => {
      requested.push(sha);
      return requested.length === depth ? commit : tagged(requested.length + 1);
    });
    assert.deepEqual(
      requested,
      Array.from({ length: depth }, (_, index) => tagged(index + 1).sha),
    );
  }
});

await test('wrong commits and non-commit terminal objects never authorize delivery', async () => {
  for (const terminal of [
    { type: 'commit', sha: 'b'.repeat(40) },
    { type: 'tree', sha: assembly },
  ]) {
    await assert.rejects(
      verifyReleaseTag(tag, assembly, terminal, async () => commit),
      /does not target assembly/,
    );
    await assert.rejects(
      verifyReleaseTag(tag, assembly, { type: 'tag', sha: 'c'.repeat(40) }, async () => terminal),
      /does not target assembly/,
    );
  }
});

await test('malformed refs and annotated responses fail closed', async () => {
  for (const invalid of [undefined, null, {}, { type: 'tag', sha: 'main' }, { sha: assembly }]) {
    let reads = 0;
    await assert.rejects(
      verifyReleaseTag(tag, assembly, invalid, async () => {
        reads++;
        return commit;
      }),
      /Invalid tag/,
    );
    assert.equal(reads, 0);
    await assert.rejects(
      verifyReleaseTag(tag, assembly, { type: 'tag', sha: 'c'.repeat(40) }, async () => invalid),
      /Invalid tag/,
    );
  }
  await assert.rejects(
    verifyReleaseTag(tag, 'main', commit, async () => commit),
    /Invalid assembly/,
  );
});

await test('cycles and chains beyond five annotated objects stop within the read budget', async () => {
  for (const cycle of [true, false]) {
    let reads = 0;
    await assert.rejects(
      verifyReleaseTag(tag, assembly, { type: 'tag', sha: '1'.repeat(40) }, async () => {
        reads++;
        return { type: 'tag', sha: String(cycle ? 1 : reads + 1).repeat(40) };
      }),
      /does not target assembly/,
    );
    assert.equal(reads, 5);
  }
});

await test('missing annotated objects and API failures cannot authorize delivery', async () => {
  await assert.rejects(
    verifyReleaseTag(tag, assembly, { type: 'tag', sha: 'c'.repeat(40) }, async () => {
      throw new Error('GitHub GET tag failed: 404');
    }),
    /404/,
  );
});
