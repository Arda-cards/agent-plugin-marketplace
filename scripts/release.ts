import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import {
  assemblyPrefix,
  checkpoint,
  parseChangelog,
} from './changelog.ts';
import { releaseGithub } from './release-github.ts';
import { planRelease } from './release-plan.ts';

interface PackageVersion {
  version: string;
  [key: string]: unknown;
}
interface PullRequest {
  number: number;
  merged_at: string | null;
  base: { ref: string };
  body: string | null;
}

const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const source = process.env.GITHUB_SHA ?? '';
const repository = process.env.GITHUB_REPOSITORY ?? '';
const token = process.env.GITHUB_TOKEN;
if (
  !/^[a-f0-9]{40}$/.test(source ?? '') ||
  !/^[\w.-]+\/[\w.-]+$/.test(repository ?? '') ||
  !token
) {
  throw new Error('Expected GitHub SHA, repository, and token');
}
const github = releaseGithub(repository, token);
// Publishes the release of every assembly on main that lacks one, oldest first, from the version
// and notes in that assembly's own tree. A run can push its assembly and then fail to publish; a
// later run, for the same source or a newer one, publishes it here. The walk stops at the newest
// assembly already released, because every run reconciles before it assembles.
async function publishMissingReleases() {
  const missing: { sha: string; version: string }[] = [];
  for (const line of git('log', '--first-parent', '--format=%H%x09%s').split('\n')) {
    if (!line.slice(41).startsWith(assemblyPrefix)) continue;
    const sha = line.slice(0, 40);
    const version = (JSON.parse(git('show', `${sha}:package.json`)) as PackageVersion).version;
    if (await github.published(`v${version}`, sha)) break;
    missing.unshift({ sha, version });
  }
  for (const { sha, version } of missing) {
    const notes = git('show', `${sha}:CHANGELOG.md`)
      .split(/^## /m)[1]
      ?.split('\n')
      .slice(1)
      .join('\n')
      .trim();
    if (notes === undefined) throw new Error('Assembly has no release notes');
    await github.publish({
      tag_name: `v${version}`,
      target_commitish: sha,
      name: `v${version}`,
      body: notes,
    });
  }
}
function output(sha: string, deploy: boolean) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) throw new Error('Expected GitHub output path');
  appendFileSync(outputPath, `sha=${sha}\ndeploy=${deploy}\n`);
}

const head = git('rev-parse', 'HEAD');
const currentCheckpoint = checkpoint(git('log', '-1', '--format=%B'));
const recovering = currentCheckpoint && (currentCheckpoint === source || head === source);
if (head !== source && !recovering) {
  console.log('Main has moved; a newer checked run will assemble any outstanding merges.');
  output(head, false);
} else {
  await publishMissingReleases();
  if (!recovering) {
    const history = git('log', '--first-parent', '--format=%H%x09%s').split('\n');
    const last = history.find((line) => line.slice(41).startsWith(assemblyPrefix));
    let from = last ? checkpoint(git('log', '-1', '--format=%B', last.slice(0, 40))) : undefined;
    if (last && !from) throw new Error('Last assembly has no valid checkpoint');
    if (!last) {
      // Earlier PRs used the old changelog model; start with the workflow's introduction.
      const introduced = git('log', '--reverse', '--first-parent', '--diff-filter=A', '--format=%H',
        source, '--', '.github/workflows/changelog-assembly.yaml').split('\n')[0];
      if (!introduced) throw new Error('Cannot identify the assembly workflow introduction');
      const parents = git('rev-list', '--parents', '-n', '1', introduced).split(' ');
      from = parents[1];
    }
    if (from) git('merge-base', '--is-ancestor', from, source);
    const commits = git(
      'rev-list',
      '--reverse',
      '--first-parent',
      ...(from ? [`${from}..${source}`] : [source]),
    ).split('\n');
    const prs = new Map<number, PullRequest>();
    for (const sha of commits) {
      if (checkpoint(git('log', '-1', '--format=%B', sha))) continue;
      // The root commit initializes the repository and cannot have a merged PR.
      if (git('rev-list', '--parents', '-n', '1', sha).split(' ').length === 1) continue;
      let merged: PullRequest[] = [];
      for (let attempt = 0; attempt < 3; attempt++) {
        const associated = await github.json<PullRequest[]>(`/commits/${sha}/pulls?per_page=100`);
        merged = associated.filter((pr) => pr.merged_at && pr.base.ref === 'main');
        if (merged.length) break;
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
      if (!merged.length)
        throw new Error(`No merged PR found for ${sha}; direct main pushes are unsupported`);
      for (const pr of merged) prs.set(pr.number, pr);
    }
    if (!prs.size) throw new Error('No merged PRs to release');
    for (const number of prs.keys()) {
      const pr = await github.json<PullRequest>(`/pulls/${number}`);
      parseChangelog(pr.body ?? '');
      prs.set(number, pr);
    }
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as PackageVersion;
    const changelog = readFileSync('CHANGELOG.md', 'utf8');
    const lastVersion = changelog.match(/^## \[(\d+\.\d+\.\d+)\] - \d{4}-\d{2}-\d{2}$/m)?.[1];
    if (lastVersion) {
      const previous = lastVersion.split('.').map(Number);
      const current = pkg.version.split('.').map(Number);
      if (previous.length !== 3 || current.length !== 3 || current.some((part) => !Number.isSafeInteger(part) || part < 0))
        throw new Error('Invalid public package version');
      const difference = current.findIndex((part, index) => part !== previous[index]);
      if (difference < 0) {
        console.log('Public package version is unchanged; accumulating entries until the next promotion.');
        output(head, false);
        process.exit(0);
      }
      if ((current[difference] ?? -1) < (previous[difference] ?? 0)) throw new Error('Public package version must increase');
    }
    const plan = planRelease({ version: pkg.version, changelog,
      date: new Date().toISOString().slice(0,10),
      pullRequests: [...prs.entries()].map(([number, pr]) => ({ number, body: pr.body ?? '' })) });
    const version = plan.version;
    writeFileSync('CHANGELOG.md', plan.changelog);
    execFileSync('npm', ['run', 'check'], { stdio: 'inherit' });
    git('config', 'user.name', 'github-actions[bot]');
    git('config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com');
    git('add', 'CHANGELOG.md');
    git('commit', '-m', `${assemblyPrefix}${version}`, '-m', `Changelog-Source: ${source}`);
    // Do not rebase onto newer unchecked application code. A race fails and the next run recovers.
    git('push', 'origin', 'HEAD:main');
    await publishMissingReleases();
  }
  output(git('rev-parse', 'HEAD'), true);
}
