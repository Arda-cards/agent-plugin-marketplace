import { checkPullRequestTitle, parseChangelog } from './changelog.ts';

interface Repository {
  owner: string;
  repo: string;
}
interface PullRequest {
  number: number;
  state: string;
  base?: { ref?: string; sha?: string; repo?: { full_name?: string } };
  head: { sha: string };
  body?: unknown;
  title?: unknown;
  changed_files: number;
}
interface FileMetadata {
  filename: string;
  previous_filename?: unknown;
  status?: string;
}
interface Commit {
  sha: string;
}
interface MergeGroup {
  base_ref: string;
  base_sha: string;
  head_sha: string;
}
interface Comparison {
  status: string;
  base_commit?: Commit;
  merge_base_commit?: Commit;
  total_commits: number;
  commits: Commit[];
}
type ApiArguments = Repository & {
  per_page?: number;
  page?: number;
  pull_number?: number;
  commit_sha?: string;
  basehead?: string;
};
type ApiMethod<T> = (args: ApiArguments) => Promise<{ data: T }>;
interface QueueEntry {
  headCommit: { oid: string } | null;
  baseCommit: { oid: string } | null;
  pullRequest: { number: number; headRefOid: string } | null;
}
interface QueueResponse {
  repository: {
    mergeQueue: {
      entries: {
        nodes: QueueEntry[];
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      };
    } | null;
  } | null;
}
interface GitHub {
  graphql: (query: string, variables: Record<string, unknown>) => Promise<QueueResponse>;
  rest: {
    pulls: { get: ApiMethod<PullRequest>; listFiles: ApiMethod<FileMetadata[]> };
    repos: {
      getContent: (args: Repository & { path: string; ref: string }) => Promise<unknown>;
      compareCommitsWithBasehead: ApiMethod<Comparison>;
      listPullRequestsAssociatedWithCommit: ApiMethod<PullRequest[]>;
    };
  };
}
interface ChangelogEvent {
  repository?: { full_name?: string };
  number?: number;
  pull_request?: PullRequest;
  merge_group?: MergeGroup;
}

const limits = {
  commits: 1000,
  associations: 1000,
  pullRequests: 20,
  files: 3000,
  bodyBytes: 256 * 1024,
};
const validSha = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const validNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
const fullName = (repo: Repository) => `${repo.owner}/${repo.repo}`;

function eligible(pr: PullRequest, repo: Repository, expectedBase = 'main') {
  return (
    pr.state === 'open' &&
    pr.base?.ref === expectedBase &&
    pr.base?.repo?.full_name === fullName(repo)
  );
}

function requirePullRequest(pr: PullRequest) {
  if (
    !pr ||
    !validNumber(pr.number) ||
    !['open', 'closed'].includes(pr.state) ||
    typeof pr.base?.ref !== 'string' ||
    !pr.base.ref ||
    !validSha(pr.base.sha) ||
    typeof pr.base?.repo?.full_name !== 'string' ||
    !validSha(pr.head?.sha)
  ) {
    throw new Error('Malformed pull request metadata; cannot establish changelog scope.');
  }
}

async function arrayPages<T>(
  method: ApiMethod<T[]>,
  args: ApiArguments,
  limit: number,
  label: string,
  expected?: number,
) {
  const items: T[] = [];
  for (let page = 1; ; page++) {
    const { data } = await method({ ...args, per_page: 100, page });
    if (!Array.isArray(data) || data.length > 100) throw new Error(`Malformed ${label} page.`);
    items.push(...data);
    if (items.length > limit) throw new Error(`${label} exceeds supported limit ${limit}.`);
    if (expected !== undefined && items.length >= expected) {
      if (items.length !== expected) throw new Error(`${label} count changed or is incomplete.`);
      return items;
    }
    if (data.length < 100) {
      if (expected !== undefined && items.length !== expected)
        throw new Error(`${label} listing is incomplete.`);
      return items;
    }
    // Refuse an unbounded additional request when no authoritative total is available.
    if (items.length === limit)
      throw new Error(
        `${label} reached the supported pagination limit ${limit}; completeness is unknown.`,
      );
  }
}

async function validatePullRequest(
  number: number,
  expectedHead: string,
  repo: Repository,
  github: GitHub,
  expectedBase: string,
  expectedBaseSha?: string,
) {
  const { data: pr } = await github.rest.pulls.get({ ...repo, pull_number: number });
  requirePullRequest(pr);
  if (pr.number !== number || !eligible(pr, repo, expectedBase))
    throw new Error(
      `PR #${number} is not an open pull request targeting this repository's expected base branch.`,
    );
  if (expectedBaseSha !== undefined && pr.base?.sha !== expectedBaseSha)
    throw new Error(`PR #${number} base commit changed since the event; rerun the changelog gate.`);
  if (pr.head.sha !== expectedHead)
    throw new Error(`PR #${number} head changed; rerun the changelog gate for its current head.`);
  if (typeof pr.body !== 'string' || Buffer.byteLength(pr.body, 'utf8') > limits.bodyBytes)
    throw new Error(`PR #${number} body is missing or exceeds the supported byte limit.`);
  if (typeof pr.title !== 'string') throw new Error(`PR #${number} title is unknown.`);
  checkPullRequestTitle(pr.title);
  const entries = parseChangelog(pr.body);
  if (
    !Number.isSafeInteger(pr.changed_files) ||
    pr.changed_files < 0 ||
    pr.changed_files > limits.files
  )
    throw new Error(`PR #${number} changed-file count is unknown or exceeds the supported limit.`);
  const files = await arrayPages(
    github.rest.pulls.listFiles,
    { ...repo, pull_number: number },
    limits.files,
    `PR #${number} files`,
    pr.changed_files,
  );
  const seen = new Set<string>();
  for (const file of files) {
    if (
      !file ||
      typeof file.filename !== 'string' ||
      !file.filename ||
      seen.has(file.filename) ||
      (file.previous_filename !== undefined && typeof file.previous_filename !== 'string')
    )
      throw new Error(`Malformed or duplicate file metadata for PR #${number}.`);
    seen.add(file.filename);
    if (file.filename === 'CHANGELOG.md' && file.status === 'added' && !file.previous_filename) {
      // Permit only the initial changelog bootstrap when the exact PR base has no file.
      let absent = false;
      try {
        await github.rest.repos.getContent({ ...repo, path: 'CHANGELOG.md', ref: pr.base?.sha ?? '' });
      } catch (error) {
        if (typeof error !== 'object' || error === null || !('status' in error) || error.status !== 404) throw error;
        absent = true;
      }
      if (!absent) throw new Error('Do not edit CHANGELOG.md; update ## CHANGELOG in the PR description.');
    } else if (file.filename === 'CHANGELOG.md' || file.previous_filename === 'CHANGELOG.md')
      throw new Error('Do not edit CHANGELOG.md; update ## CHANGELOG in the PR description.');
  }
  const { data: current } = await github.rest.pulls.get({ ...repo, pull_number: number });
  requirePullRequest(current);
  if (
    current.number !== number ||
    !eligible(current, repo, expectedBase) ||
    current.head.sha !== expectedHead ||
    current.base?.sha !== pr.base?.sha ||
    current.changed_files !== pr.changed_files ||
    current.body !== pr.body ||
    current.title !== pr.title
  )
    throw new Error(
      `PR #${number} changed during changelog validation; rerun for its current metadata.`,
    );
  return entries.length;
}

async function queuePullRequests(group: MergeGroup | undefined, repo: Repository, github: GitHub) {
  if (
    !group ||
    group.base_ref !== 'refs/heads/main' ||
    !validSha(group.base_sha) ||
    !validSha(group.head_sha) ||
    group.base_sha === group.head_sha
  )
    throw new Error('Malformed merge group or a merge group outside main.');
  const commits: Commit[] = [];
  let total;
  for (let page = 1; ; page++) {
    const { data } = await github.rest.repos.compareCommitsWithBasehead({
      ...repo,
      basehead: `${group.base_sha}...${group.head_sha}`,
      per_page: 100,
      page,
    });
    if (
      !data ||
      data.status !== 'ahead' ||
      data.base_commit?.sha !== group.base_sha ||
      data.merge_base_commit?.sha !== group.base_sha ||
      !Number.isSafeInteger(data.total_commits) ||
      data.total_commits < 1 ||
      !Array.isArray(data.commits) ||
      data.commits.length > 100
    )
      throw new Error('Malformed or non-descendant merge-group comparison.');
    if (data.total_commits > limits.commits)
      throw new Error(`Merge group exceeds the supported commit limit ${limits.commits}.`);
    if (total !== undefined && total !== data.total_commits)
      throw new Error('Merge-group comparison changed during pagination.');
    total = data.total_commits;
    commits.push(...data.commits);
    if (commits.length > total)
      throw new Error('Merge-group comparison has inconsistent commit counts.');
    if (commits.length === total) break;
    if (data.commits.length < 100) throw new Error('Merge-group comparison is incomplete.');
  }
  const commitShas = new Set<string>();
  for (const commit of commits) {
    if (!validSha(commit?.sha) || commitShas.has(commit.sha))
      throw new Error('Malformed or duplicate merge-group commits.');
    commitShas.add(commit.sha);
  }
  if (!commitShas.has(group.head_sha))
    throw new Error('Merge-group head is missing from the comparison.');
  // Squash queue commits are synthetic and GitHub does not associate them with
  // the source PR. Resolve each queued commit through GitHub's merge queue entry,
  // matching its generated head and base, never a user-controlled commit title.
  const queued = new Map<string, QueueEntry>();
  let cursor: string | null = null;
  const seenCursors = new Set<string>();
  let scannedEntries = 0;
  for (;;) {
    const result = await github.graphql(
      `query($owner: String!, $repo: String!, $cursor: String) {
      repository(owner: $owner, name: $repo) {
        mergeQueue(branch: "main") { entries(first: 100, after: $cursor) {
          nodes { headCommit { oid } baseCommit { oid } pullRequest { number headRefOid } }
          pageInfo { hasNextPage endCursor }
        } }
      }
    }`,
      { ...repo, cursor },
    );
    const page = result.repository?.mergeQueue?.entries;
    if (
      !page ||
      !Array.isArray(page.nodes) ||
      page.nodes.length > 100 ||
      !page.pageInfo ||
      typeof page.pageInfo.hasNextPage !== 'boolean'
    )
      throw new Error('Malformed merge queue entry page.');
    scannedEntries += page.nodes.length;
    if (scannedEntries > limits.associations)
      throw new Error('Merge queue exceeds supported limit.');
    for (const entry of page.nodes) {
      if (!entry || !validSha(entry.headCommit?.oid) || !commitShas.has(entry.headCommit.oid))
        continue;
      if (
        !validSha(entry.baseCommit?.oid) ||
        !entry.pullRequest ||
        !validNumber(entry.pullRequest.number) ||
        !validSha(entry.pullRequest.headRefOid)
      )
        throw new Error('Incomplete merge queue entry; cannot establish changelog scope.');
      if (queued.has(entry.headCommit.oid)) throw new Error('Duplicate merge queue head.');
      queued.set(entry.headCommit.oid, entry);
    }
    if (!page.pageInfo.hasNextPage) break;
    const next = page.pageInfo.endCursor;
    if (!next || seenCursors.has(next) || scannedEntries >= limits.associations)
      throw new Error('Incomplete or oversized merge queue pagination.');
    seenCursors.add(next);
    cursor = next;
  }
  const prs = new Map<number, string>();
  let previous = group.base_sha;
  let mapped = 0;
  for (const commit of commits) {
    const entry = queued.get(commit.sha);
    if (entry) {
      if (
        entry.baseCommit?.oid !== previous ||
        !entry.pullRequest ||
        prs.has(entry.pullRequest.number)
      )
        throw new Error('Merge queue entry does not match the queued commit chain.');
      prs.set(entry.pullRequest.number, entry.pullRequest.headRefOid);
      mapped++;
    }
    previous = commit.sha;
  }
  if (mapped > 0) {
    if (mapped !== commits.length || prs.size > limits.pullRequests)
      throw new Error('Merge queue commit chain is incomplete or exceeds the PR limit.');
    return prs;
  }
  let associationCount = 0;
  for (const commit of commits) {
    const associated = await arrayPages(
      github.rest.repos.listPullRequestsAssociatedWithCommit,
      { ...repo, commit_sha: commit.sha },
      limits.associations,
      'Associated pull requests',
    );
    associationCount += associated.length;
    if (associationCount > limits.associations)
      throw new Error('Merge group exceeds the supported association limit.');
    for (const pr of associated) {
      requirePullRequest(pr);
      if (!eligible(pr, repo)) continue;
      if (!commitShas.has(pr.head.sha))
        throw new Error(`PR #${pr.number} current head is not in this merge group.`);
      if (prs.has(pr.number) && prs.get(pr.number) !== pr.head.sha)
        throw new Error(`PR #${pr.number} head changed during queue discovery.`);
      prs.set(pr.number, pr.head.sha);
      if (prs.size > limits.pullRequests)
        throw new Error('Merge group exceeds the supported pull request limit.');
    }
  }
  if (!prs.size)
    throw new Error(
      'No eligible open main pull requests found for the merge group; refusing an empty queue pass.',
    );
  return prs;
}

/** Read-only, injected Octokit API. Failures propagate to the required workflow check. */
export async function checkChangelogEvent(
  payload: ChangelogEvent,
  repo: Repository,
  github: GitHub,
) {
  if (
    !repo ||
    typeof repo.owner !== 'string' ||
    !repo.owner ||
    typeof repo.repo !== 'string' ||
    !repo.repo
  )
    throw new Error('Expected a trusted current repository identity.');
  if (!payload || payload.repository?.full_name !== fullName(repo))
    throw new Error('Foreign or missing event repository.');
  if (!!payload.pull_request === !!payload.merge_group)
    throw new Error('Changelog gate requires exactly one pull_request or merge_group event.');
  let requests;
  let expectedBase = 'main';
  let expectedBaseSha: string | undefined;
  if (payload.pull_request) {
    const pr = payload.pull_request;
    requirePullRequest(pr);
    expectedBase = pr.base?.ref ?? '';
    expectedBaseSha = pr.base?.sha;
    if (
      !eligible(pr, repo, expectedBase) ||
      (payload.number !== undefined && payload.number !== pr.number)
    )
      throw new Error('Foreign, closed, or mismatched pull request event.');
    requests = new Map([[pr.number, pr.head.sha]]);
  } else requests = await queuePullRequests(payload.merge_group, repo, github);
  let entries = 0;
  const ordered = [...requests].sort(([left], [right]) => left - right);
  for (const [number, head] of ordered)
    entries += await validatePullRequest(number, head, repo, github, expectedBase, expectedBaseSha);
  return { pullRequests: ordered.map(([number]) => number), entries };
}
