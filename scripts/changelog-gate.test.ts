/* eslint @typescript-eslint/require-await: off -- mocked GitHub methods return asynchronous responses */
import assert from 'node:assert/strict';
import test from 'node:test';
import { checkChangelogEvent } from './changelog-gate.ts';

const repo = { owner: 'Arda-cards', repo: 'mcp-cloudflare' };
const fullName = `${repo.owner}/${repo.repo}`;
const sha = (number: number) => number.toString(16).padStart(40, '0');
const validBody = '## CHANGELOG\n### Fixed\n- Preserve the approved outcome.';
function required<T>(value: T | undefined): T {
  assert.ok(value !== undefined);
  return value;
}
type GitHub = Parameters<typeof checkChangelogEvent>[2];
type ApiArguments = Parameters<GitHub['rest']['pulls']['get']>[0];
type PullRequestFixture = {
  number: number;
  state: string;
  title: string;
  body: string;
  base: { ref: string; sha: string; repo: { full_name: string } };
  head: { sha: string };
  changed_files: number;
};
class FixtureMap<K, V> extends Map<K, V> {
  override get(key: K): V {
    const value = super.get(key);
    assert.ok(value !== undefined, `Missing fixture key ${String(key)}`);
    return value;
  }
}
function fixture() {
  const prs = new FixtureMap<number, PullRequestFixture>(
    [1, 2].map((number) => [
      number,
      {
        number,
        state: 'open',
        title: `Change ${number}`,
        body: validBody,
        base: { ref: 'main', sha: sha(0), repo: { full_name: fullName } },
        head: { sha: sha(number) },
        changed_files: 1,
      },
    ]),
  );
  const files = new FixtureMap<
    number,
    { filename: string; status?: string; previous_filename?: string }[]
  >([1, 2].map((number) => [number, [{ filename: `source-${number}.ts`, status: 'modified' }]]));
  const calls: { name: string; args: ApiArguments }[] = [];
  const page = <T>(items: T[], args: ApiArguments) => {
    assert.ok(args.page && args.per_page);
    return items.slice((args.page - 1) * args.per_page, args.page * args.per_page);
  };
  const commits = [{ sha: sha(1) }, { sha: sha(2) }, { sha: sha(3) }];
  const associations = new Map([
    [sha(1), [prs.get(1)]],
    [sha(2), [prs.get(1), prs.get(2)]],
    [sha(3), []],
  ]);
  const invoke =
    <T>(name: string, fn: (args: ApiArguments) => T) =>
    async (args: ApiArguments) => {
      calls.push({ name, args });
      return { data: fn(args) };
    };
  const entries: {
    headCommit: { oid: string };
    baseCommit: { oid: string };
    pullRequest: { number: number; headRefOid: string };
  }[] = [];
  const github: GitHub = {
    graphql: async () => ({
      repository: {
        mergeQueue: {
          entries: { nodes: entries, pageInfo: { hasNextPage: false, endCursor: null } },
        },
      },
    }),
    rest: {
      pulls: {
        get: invoke('get', (args) => structuredClone(prs.get(required(args.pull_number)))),
        listFiles: invoke('files', (args) => page(files.get(required(args.pull_number)), args)),
      },
      repos: {
        getContent: () => Promise.resolve({}),
        compareCommitsWithBasehead: invoke('compare', (args) => ({
          status: 'ahead',
          total_commits: commits.length,
          base_commit: { sha: sha(0) },
          merge_base_commit: { sha: sha(0) },
          commits: page(commits, args),
        })),
        listPullRequestsAssociatedWithCommit: invoke('associated', (args) =>
          page(associations.get(required(args.commit_sha)) ?? [], args),
        ),
      },
    },
  };
  const prEvent = {
    number: 1,
    repository: { full_name: fullName },
    pull_request: structuredClone(prs.get(1)),
  };
  const queueEvent = {
    repository: { full_name: fullName },
    merge_group: { base_sha: sha(0), head_sha: sha(3), base_ref: 'refs/heads/main' },
  };
  return { prs, files, calls, commits, associations, entries, github, prEvent, queueEvent };
}

await test('PR checks use current metadata after a body edit, not stale event body', async () => {
  const f = fixture();
  f.prEvent.pull_request.body = '';
  assert.deepEqual(await checkChangelogEvent(f.prEvent, repo, f.github), {
    pullRequests: [1],
    entries: 1,
  });
  f.prs.get(1).body = '';
  await assert.rejects(checkChangelogEvent(f.prEvent, repo, f.github), /nonempty.*CHANGELOG/);
});

await test('rejects generated edits and renames unconditionally, including bootstrap creation', async () => {
  for (const file of [
    { filename: 'CHANGELOG.md', status: 'added' },
    { filename: 'CHANGELOG.md', status: 'modified' },
    { filename: 'old.md', previous_filename: 'CHANGELOG.md', status: 'renamed' },
  ]) {
    const f = fixture();
    f.files.set(1, [file]);
    await assert.rejects(
      checkChangelogEvent(f.prEvent, repo, f.github),
      /Do not edit CHANGELOG.md/,
    );
  }
});

await test('rejects unknown changelog categories and reserved assembly titles', async () => {
  const f = fixture();
  f.prs.get(1).body = '## CHANGELOG\n### Misc\n- Something';
  await assert.rejects(
    checkChangelogEvent(f.prEvent, repo, f.github),
    /Unknown changelog category/,
  );
  f.prs.get(1).body = validBody;
  f.prs.get(1).title = 'CHORE: ASSEMBLE CHANGELOG fake';
  await assert.rejects(checkChangelogEvent(f.prEvent, repo, f.github), /reserved/);
});

await test('rejects stale head, closed PR, foreign base repository and changed base', async () => {
  for (const mutate of [
    (f: ReturnType<typeof fixture>) => {
      f.prs.get(1).head.sha = sha(99);
    },
    (f: ReturnType<typeof fixture>) => {
      f.prs.get(1).state = 'closed';
    },
    (f: ReturnType<typeof fixture>) => {
      f.prs.get(1).base.repo.full_name = 'other/repository';
    },
    (f: ReturnType<typeof fixture>) => {
      f.prs.get(1).base.ref = 'dev';
    },
    (f: ReturnType<typeof fixture>) => {
      f.prEvent.repository.full_name = 'other/repository';
    },
  ]) {
    const f = fixture();
    mutate(f);
    await assert.rejects(checkChangelogEvent(f.prEvent, repo, f.github));
  }
});

await test('queue validates and rechecks every associated eligible PR and uses exact base/head range', async () => {
  const f = fixture();
  assert.deepEqual(await checkChangelogEvent(f.queueEvent, repo, f.github), {
    pullRequests: [1, 2],
    entries: 2,
  });
  assert.deepEqual(
    f.calls.filter((c) => c.name === 'get').map((c) => c.args.pull_number),
    [1, 1, 2, 2],
  );
  assert.equal(
    required(f.calls.find((c) => c.name === 'compare')).args.basehead,
    `${sha(0)}...${sha(3)}`,
  );
  f.prs.get(2).body = '';
  await assert.rejects(checkChangelogEvent(f.queueEvent, repo, f.github), /nonempty.*CHANGELOG/);
});

await test('queue fails closed for no eligible PRs, foreign-only associations and stale live heads', async () => {
  for (const mutate of [
    (f: ReturnType<typeof fixture>) => {
      f.associations.clear();
    },
    (f: ReturnType<typeof fixture>) => {
      for (const pr of f.prs.values()) pr.base.repo.full_name = 'other/repository';
    },
    (f: ReturnType<typeof fixture>) => {
      f.prs.get(2).head.sha = sha(99);
    },
  ]) {
    const f = fixture();
    mutate(f);
    await assert.rejects(checkChangelogEvent(f.queueEvent, repo, f.github));
  }
});

await test('bounded pagination validates all commits, associations and files beyond first page', async () => {
  const f = fixture();
  f.commits.splice(
    0,
    f.commits.length,
    ...Array.from({ length: 101 }, (_, index) => ({ sha: sha(index + 1) })),
  );
  f.queueEvent.merge_group.head_sha = sha(101);
  f.associations.clear();
  f.associations.set(sha(101), [f.prs.get(1)]);
  f.prs.get(1).changed_files = 101;
  f.files.set(
    1,
    Array.from({ length: 101 }, (_, index) => ({
      filename: index === 100 ? 'CHANGELOG.md' : `file-${index}.ts`,
    })),
  );
  await assert.rejects(
    checkChangelogEvent(f.queueEvent, repo, f.github),
    /Do not edit CHANGELOG.md/,
  );
  assert.ok(f.calls.some((c) => c.name === 'compare' && c.args.page === 2));
  assert.ok(f.calls.some((c) => c.name === 'files' && c.args.page === 2));
});

await test('associated PR pagination finds a queued PR after a full page of closed PRs', async () => {
  const f = fixture();
  f.associations.clear();
  f.associations.set(sha(1), [
    ...Array.from({ length: 100 }, (_, index) => ({
      ...f.prs.get(1),
      number: 1000 + index,
      state: 'closed',
    })),
    f.prs.get(1),
  ]);
  assert.deepEqual(await checkChangelogEvent(f.queueEvent, repo, f.github), {
    pullRequests: [1],
    entries: 1,
  });
  assert.ok(f.calls.some((c) => c.name === 'associated' && c.args.page === 2));
});

await test('queue refuses oversized, truncated, duplicate and non-descendant commit comparisons', async () => {
  for (const comparison of [
    { total_commits: 1001 },
    { total_commits: 4 },
    { commits: [{ sha: sha(1) }, { sha: sha(1) }, { sha: sha(3) }] },
    { status: 'diverged' },
    { merge_base_commit: { sha: sha(99) } },
    { commits: [{ sha: sha(1) }, { sha: sha(2) }, { sha: sha(4) }] },
  ]) {
    const f = fixture();
    const original = f.github.rest.repos.compareCommitsWithBasehead;
    f.github.rest.repos.compareCommitsWithBasehead = async (args) => {
      const response = await original(args);
      return { data: { ...response.data, ...comparison } };
    };
    await assert.rejects(checkChangelogEvent(f.queueEvent, repo, f.github));
  }
});

await test('malformed, incomplete, oversized and API-error inputs never silently pass', async () => {
  const f = fixture();
  for (const event of [
    {},
    { ...f.prEvent, merge_group: f.queueEvent.merge_group },
    { ...f.queueEvent, merge_group: { ...f.queueEvent.merge_group, base_ref: 'refs/heads/dev' } },
  ])
    await assert.rejects(checkChangelogEvent(event, repo, f.github));
  f.prs.get(1).changed_files = 2;
  await assert.rejects(checkChangelogEvent(f.prEvent, repo, f.github), /incomplete/i);
  f.prs.get(1).changed_files = 3001;
  await assert.rejects(checkChangelogEvent(f.prEvent, repo, f.github), /limit/i);
  f.prs.get(1).changed_files = 1;
  f.prs.get(1).body = 'x'.repeat(262145);
  await assert.rejects(checkChangelogEvent(f.prEvent, repo, f.github), /limit/i);
  f.github.rest.pulls.get = async () => {
    throw Object.assign(new Error('Forbidden'), { status: 403 });
  };
  await assert.rejects(checkChangelogEvent(f.prEvent, repo, f.github), /Forbidden/);
});

await test('stacked PRs validate their same-repository event base and refuse retargeting races', async () => {
  const f = fixture();
  f.prEvent.pull_request.base.ref = 'jmpicnic-ag/email-inspection';
  f.prs.get(1).base.ref = 'jmpicnic-ag/email-inspection';
  assert.equal((await checkChangelogEvent(f.prEvent, repo, f.github)).entries, 1);
  f.prs.get(1).base.ref = 'main';
  await assert.rejects(checkChangelogEvent(f.prEvent, repo, f.github), /target|base/);
});

await test('retargeting or changing PR identity during file pagination fails closed', async () => {
  for (const mutate of [
    (pr: PullRequestFixture) => {
      pr.base.ref = 'other-base';
    },
    (pr: PullRequestFixture) => {
      pr.base.sha = sha(98);
    },
    (pr: PullRequestFixture) => {
      pr.base.repo.full_name = 'other/repository';
    },
    (pr: PullRequestFixture) => {
      pr.head.sha = sha(99);
    },
    (pr: PullRequestFixture) => {
      pr.number = 99;
    },
    (pr: PullRequestFixture) => {
      pr.state = 'closed';
    },
  ]) {
    const f = fixture();
    const listFiles = f.github.rest.pulls.listFiles;
    f.github.rest.pulls.listFiles = async (args) => {
      const result = await listFiles(args);
      mutate(f.prs.get(1));
      return result;
    };
    await assert.rejects(
      checkChangelogEvent(f.prEvent, repo, f.github),
      /changed|base|target|metadata/,
    );
  }
});

await test('a base commit changed since the event refuses before listing any diff files', async () => {
  const f = fixture();
  f.prs.get(1).base.sha = sha(98);
  await assert.rejects(
    checkChangelogEvent(f.prEvent, repo, f.github),
    /base.*changed|base.*commit/i,
  );
  assert.equal(f.calls.filter((call) => call.name === 'files').length, 0);
});

await test('squash queue commits resolve via authenticated queue entries and validate every PR', async () => {
  const f = fixture();
  f.commits.splice(0, f.commits.length, { sha: sha(10) }, { sha: sha(11) });
  f.queueEvent.merge_group.head_sha = sha(11);
  f.associations.clear();
  f.entries.push(
    {
      headCommit: { oid: sha(10) },
      baseCommit: { oid: sha(0) },
      pullRequest: { number: 1, headRefOid: sha(1) },
    },
    {
      headCommit: { oid: sha(11) },
      baseCommit: { oid: sha(10) },
      pullRequest: { number: 2, headRefOid: sha(2) },
    },
  );
  assert.deepEqual(await checkChangelogEvent(f.queueEvent, repo, f.github), {
    pullRequests: [1, 2],
    entries: 2,
  });
  f.prs.get(2).body = '';
  await assert.rejects(checkChangelogEvent(f.queueEvent, repo, f.github), /nonempty.*CHANGELOG/);
});

await test('squash queue rejects missing entries, incorrect base and stale PR heads', async () => {
  for (const variant of ['missing', 'base', 'stale'] as const) {
    const f = fixture();
    f.commits.splice(0, f.commits.length, { sha: sha(10) }, { sha: sha(11) });
    f.queueEvent.merge_group.head_sha = sha(11);
    f.associations.clear();
    f.entries.push(
      {
        headCommit: { oid: sha(10) },
        baseCommit: { oid: sha(0) },
        pullRequest: { number: 1, headRefOid: sha(1) },
      },
      {
        headCommit: { oid: sha(11) },
        baseCommit: { oid: sha(10) },
        pullRequest: { number: 2, headRefOid: sha(2) },
      },
    );
    if (variant === 'missing') f.entries.pop();
    if (variant === 'base') required(f.entries[1]).baseCommit.oid = sha(98);
    if (variant === 'stale') f.prs.get(2).head.sha = sha(99);
    await assert.rejects(checkChangelogEvent(f.queueEvent, repo, f.github));
  }
});

await test('unrelated incomplete queue entries do not block a complete squash group', async () => {
  const f = fixture();
  f.commits.splice(0, f.commits.length, { sha: sha(10) });
  f.queueEvent.merge_group.head_sha = sha(10);
  f.associations.clear();
  const current = {
    headCommit: { oid: sha(10) },
    baseCommit: { oid: sha(0) },
    pullRequest: { number: 1, headRefOid: sha(1) },
  };
  f.github.graphql = async () => ({
    repository: {
      mergeQueue: {
        entries: {
          nodes: [{ headCommit: null, baseCommit: null, pullRequest: null }, current],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      },
    },
  });
  assert.deepEqual(await checkChangelogEvent(f.queueEvent, repo, f.github), {
    pullRequests: [1],
    entries: 1,
  });
  f.github.graphql = async () => ({
    repository: {
      mergeQueue: {
        entries: {
          nodes: [{ ...current, baseCommit: null }],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      },
    },
  });
  await assert.rejects(
    checkChangelogEvent(f.queueEvent, repo, f.github),
    /Incomplete merge queue entry/,
  );
});

await test('queue pagination limit counts unrelated incomplete entries', async () => {
  const f = fixture();
  let page = 0;
  f.github.graphql = async () => ({
    repository: {
      mergeQueue: {
        entries: {
          nodes: Array.from({ length: 100 }, () => ({
            headCommit: null,
            baseCommit: null,
            pullRequest: null,
          })),
          pageInfo: { hasNextPage: true, endCursor: String(++page) },
        },
      },
    },
  });
  await assert.rejects(checkChangelogEvent(f.queueEvent, repo, f.github), /pagination|limit/);
  assert.equal(page, 10);
});

await test('only permits the initial changelog when absent on the exact base', async () => {
  const f = fixture();
  f.files.set(1, [{ filename: 'CHANGELOG.md', status: 'added' }]);
  f.github.rest.repos.getContent = () => Promise.reject(Object.assign(new Error('Not found'), { status: 404 }));
  assert.equal((await checkChangelogEvent(f.prEvent, repo, f.github)).entries, 1);
  f.github.rest.repos.getContent = () => Promise.reject(Object.assign(new Error('Forbidden'), { status: 403 }));
  await assert.rejects(checkChangelogEvent(f.prEvent, repo, f.github), /Forbidden/);
});

await test('merge-method groups validate source commits and the queue entry chain', async () => {
  const f = fixture();
  f.commits.splice(0, f.commits.length, { sha: sha(1) }, { sha: sha(10) }, { sha: sha(2) }, { sha: sha(11) });
  f.queueEvent.merge_group.head_sha = sha(11);
  f.associations.clear();
  f.associations.set(sha(1), [f.prs.get(1)]);
  f.associations.set(sha(2), [f.prs.get(2)]);
  f.entries.push(
    { headCommit: { oid: sha(10) }, baseCommit: { oid: sha(0) }, pullRequest: { number: 1, headRefOid: sha(1) } },
    { headCommit: { oid: sha(11) }, baseCommit: { oid: sha(10) }, pullRequest: { number: 2, headRefOid: sha(2) } },
  );
  assert.deepEqual(await checkChangelogEvent(f.queueEvent, repo, f.github), { pullRequests: [1, 2], entries: 2 });
  f.associations.delete(sha(2));
  await assert.rejects(checkChangelogEvent(f.queueEvent, repo, f.github), /not associated/);
});
