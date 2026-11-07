import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import type { TestContext } from 'node:test';
import { z } from 'zod';
import { readState } from './release-test-fixture.ts';
import type { ReleaseState } from './release-test-fixture.ts';
import { bootstrap, checkpoint } from './changelog.ts';
import { selectAssemblySource } from './assembly-source.ts';

const lockSchema = z.object({
  packages: z.object({
    '': z.object({ version: z.string(), workspaces: z.array(z.string()) }),
    'packages/example': z.object({ version: z.string() }),
    'node_modules/fixture-dependency': z.object({
      resolved: z.string(),
      link: z.boolean(),
    }),
  }),
});

const releaseScript = fileURLToPath(new URL('./release.ts', import.meta.url));
function fixture(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), 'public-release-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args: string[]) =>
    execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  git('init', '-b', 'main');
  git('config', 'user.name', 'Fixture');
  git('config', 'user.email', 'fixture@example.com');
  const remote = join(root, 'remote.git');
  git('init', '--bare', remote);
  git('remote', 'add', 'origin', remote);
  const pkg = {
    name: 'release-fixture',
    version: '0.1.0',
    workspaces: ['packages/*'],
    dependencies: { 'fixture-dependency': '*' },
    scripts: { check: 'node -e "process.exit(0)"', 'package:generate': `node -e "const f=require('fs');f.writeFileSync('plugins/arda-cards-operations/fixture',JSON.parse(f.readFileSync('package.json','utf8')).version)"` },
  };
  writeFileSync(join(root, 'package.json'), JSON.stringify(pkg));
  writeFileSync(
    join(root, 'package-lock.json'),
    JSON.stringify({
      version: pkg.version,
      packages: {
        '': { version: pkg.version, workspaces: pkg.workspaces, dependencies: pkg.dependencies },
        'packages/example': { name: 'fixture-dependency', version: '0.1.0' },
        'node_modules/fixture-dependency': { resolved: 'packages/example', link: true },
      },
    }),
  );
  writeFileSync(join(root, 'CHANGELOG.md'), bootstrap);
  mkdirSync(join(root, '.claude-plugin'));
  mkdirSync(join(root, 'plugins/arda-cards-operations'), { recursive: true });
  writeFileSync(join(root, '.claude-plugin/marketplace.json'), '{}');
  writeFileSync(join(root, 'plugins/arda-cards-operations/fixture'), pkg.version);
  git('add', 'package.json', 'package-lock.json', 'CHANGELOG.md', '.claude-plugin', 'plugins');
  git('commit', '-m', 'Initialize repository');
  const commits: string[] = [];
  for (const number of [1, 2]) {
    if (number === 1) {
      mkdirSync(join(root, '.github/workflows'), { recursive: true });
      writeFileSync(join(root, '.github/workflows/changelog-assembly.yaml'), 'name: fixture\n');
      git('add', '.github/workflows/changelog-assembly.yaml');
    }
    writeFileSync(join(root, 'change.txt'), `Change ${number}`);
    git('add', 'change.txt');
    git('commit', '-m', `Merge #${number}`);
    commits.push(git('rev-parse', 'HEAD'));
  }
  git('push', 'origin', 'main');
  const statePath = join(root, 'api.json');
  const output = join(root, 'outputs');
  const state: ReleaseState = {
    commits: Object.fromEntries(commits.map((sha, i) => [sha, i + 1])),
    releases: [],
    failRelease: false,
    transientBefore: false,
    transientAfter: false,
    posts: 0,
    calls: 0,
  };
  const save = () => writeFileSync(statePath, JSON.stringify(state));
  save();
  const preload = fileURLToPath(new URL('./release-test-fixture.ts', import.meta.url));
  const run = (source = commits[1]) => {
    writeFileSync(output, '');
    return spawnSync(process.execPath, ['--import', preload, releaseScript], {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        GITHUB_SHA: source,
        GITHUB_REPOSITORY: 'fixture/repository',
        GITHUB_TOKEN: 'dummy-test-token',
        GITHUB_OUTPUT: output,
        FIXTURE_API: statePath,
      },
    });
  };
  return { root, git, commits, state, save, run, output, statePath };
}

await test('assembly recovers queued merges, pushes one checked version, and targets that exact commit', (t) => {
  const f = fixture(t);
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  const sha = f.git('rev-parse', 'HEAD');
  assert.equal(checkpoint(f.git('log', '-1', '--format=%B')), f.commits[1]);
  assert.equal(f.git('ls-remote', 'origin', 'refs/heads/main').split(/\s/)[0], sha);
  const release = readState(f.statePath).releases[0];
  assert.ok(release);
  assert.equal(release.target_commitish, sha);
  assert.equal(release.tag_name, 'v0.1.0');
  assert.match(release.body, /Change 1\. \(#1\)/);
  assert.match(release.body, /Change 2\. \(#2\)/);
  const lock = lockSchema.parse(
    JSON.parse(readFileSync(join(f.root, 'package-lock.json'), 'utf8')),
  );
  assert.equal(lock.packages['packages/example'].version, '0.1.0');
  assert.deepEqual(lock.packages['node_modules/fixture-dependency'], {
    resolved: 'packages/example',
    link: true,
  });
  assert.deepEqual(lock.packages[''].workspaces, ['packages/*']);
  assert.equal(
    lockSchema.parse(JSON.parse(readFileSync(join(f.root, 'package-lock.json'), 'utf8'))).packages[
      ''
    ].version,
    '0.1.0',
  );
  assert.match(readFileSync(f.output, 'utf8'), /deploy=true/);
});

await test('failed release creation retries without another version bump and supports manual recovery', (t) => {
  const f = fixture(t);
  f.state.failRelease = true;
  f.save();
  assert.equal(f.run().status, 1);
  const assembly = f.git('rev-parse', 'HEAD');
  assert.equal(f.run().status, 0);
  assert.equal(f.git('rev-parse', 'HEAD'), assembly);
  assert.equal(f.run(assembly).status, 0);
  const releases = readState(f.statePath).releases;
  assert.deepEqual(
    releases.map((release) => [release.tag_name, release.target_commitish]),
    [['v0.1.0', assembly]],
  );
  assert.ok(releases[0]);
  assert.match(releases[0].body, /Change 1\. \(#1\)/);
});

await test('a release whose publication failed is published when another PR merges before recovery', (t) => {
  const f = fixture(t);
  f.state.failRelease = true;
  f.save();
  assert.equal(f.run().status, 1);
  const firstAssembly = f.git('rev-parse', 'HEAD');
  writeFileSync(join(f.root, 'change.txt'), 'Change 3');
  f.git('add', 'change.txt');
  f.git('commit', '-m', 'Merge #3');
  f.git('push', 'origin', 'main');
  const third = f.git('rev-parse', 'HEAD');
  const state = readState(f.statePath);
  state.commits[third] = 3;
  writeFileSync(f.statePath, JSON.stringify(state));

  const result = f.run(third);
  assert.equal(result.status, 0, result.stderr);
  const releases = readState(f.statePath).releases;
  assert.deepEqual(releases.map((release) => [release.tag_name, release.target_commitish]),
    [['v0.1.0', firstAssembly]]);
  assert.match(readFileSync(f.output, 'utf8'), /deploy=false/);
  assert.match(readFileSync(f.output, 'utf8'), new RegExp(`published_sha=${firstAssembly}\\npublished_tag=v0\\.1\\.0`));
  assert.equal(f.git('rev-parse', 'HEAD'), third);

});

await test('a superseded source neither assembles nor deploys unchecked newer code', (t) => {
  const f = fixture(t);
  assert.equal(f.run(f.commits[0]).status, 0);
  assert.equal(f.git('rev-parse', 'HEAD'), f.commits[1]);
  assert.match(readFileSync(f.output, 'utf8'), /deploy=false/);
  assert.equal(readState(f.statePath).calls, 0);
});

for (const failure of ['transientBefore', 'transientAfter'] as const) {
  await test(`publication recovers ${failure} in one run with one assembly and no duplicate release`, (t) => {
    const f = fixture(t);
    f.state[failure] = true;
    f.save();
    const result = f.run();
    assert.equal(result.status, 0, result.stderr);
    const assembly = f.git('rev-parse', 'HEAD');
    assert.match(readFileSync(f.output, 'utf8'), new RegExp(`sha=${assembly}\\ndeploy=true`));
    assert.equal(
      f
        .git('log', '--format=%s')
        .split('\n')
        .filter((s) => s.startsWith('chore: assemble CHANGELOG ')).length,
      1,
    );
    assert.equal(f.run().status, 0);
    const state = readState(f.statePath);
    assert.equal(state.releases.length, 1);
    assert.equal(state.posts, failure === 'transientAfter' ? 1 : 2);
    assert.equal(f.git('rev-parse', 'HEAD'), assembly);
  });
}

await test('permanent publication failure withholds all delivery outputs', (t) => {
  const f = fixture(t);
  f.state.failRelease = true;
  f.save();
  const result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /POST \/releases failed: 422/);
  assert.equal(readFileSync(f.output, 'utf8'), '');
});

await test('tag provenance failure withholds delivery outputs after release creation', (t) => {
  const f = fixture(t);
  f.state.wrongTag = true;
  f.save();
  const result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /does not target assembly/);
  assert.equal(readFileSync(f.output, 'utf8'), '');
});

await test('full rerun refreshes stale source outputs and recovers the pushed assembly', (t) => {
  const f = fixture(t);
  const sourceSha = f.commits[1];
  assert.ok(sourceSha);
  const initial = selectAssemblySource({ sourceSha, mainSha: sourceSha });
  f.state.failRelease = true;
  f.save();
  assert.equal(f.run(sourceSha).status, 1);
  const mainSha = f.git('rev-parse', 'HEAD');
  assert.equal(initial.checkoutSha, sourceSha, 'failed-job-only reruns retain pre-assembly output');
  assert.notEqual(initial.checkoutSha, mainSha);
  const refreshed = selectAssemblySource({
    sourceSha,
    mainSha,
    headMessage: f.git('log', '-1', '--format=%B'),
    headParents: [sourceSha],
    changedFiles: f
      .git('diff', '--name-only', sourceSha, mainSha)
      .split('\n')
      .map((filename) => ({ filename, status: 'modified' })),
  });
  assert.deepEqual(refreshed, { assemble: true, checkoutSha: mainSha });
  f.git('checkout', '--detach', refreshed.checkoutSha);
  const recovered = f.run(sourceSha);
  assert.equal(recovered.status, 0, recovered.stderr);
  assert.equal(f.git('rev-parse', 'HEAD'), mainSha);
  assert.equal(readState(f.statePath).releases.length, 1);
  assert.match(readFileSync(f.output, 'utf8'), new RegExp(`sha=${mainSha}\\ndeploy=true`));
});

await test('accumulated entries are released when the promoted package version increases', (t) => {
  const f = fixture(t);
  assert.equal(f.run().status, 0);
  writeFileSync(join(f.root, 'change.txt'), 'Change 3');
  f.git('add', 'change.txt');
  f.git('commit', '-m', 'Merge #3');
  f.git('push', 'origin', 'main');
  const third = f.git('rev-parse', 'HEAD');
  const state = readState(f.statePath);
  state.commits[third] = 3;
  writeFileSync(f.statePath, JSON.stringify(state));
  assert.equal(f.run(third).status, 0);
  assert.match(readFileSync(f.output, 'utf8'), /deploy=false/);
  const packageFile = join(f.root, 'package.json');
  const pkg = JSON.parse(readFileSync(packageFile, 'utf8')) as Record<string, unknown>;
  pkg.version = '0.2.0';
  writeFileSync(packageFile, JSON.stringify(pkg));
  f.git('add', 'package.json');
  f.git('commit', '-m', 'Merge #4');
  f.git('push', 'origin', 'main');
  const fourth = f.git('rev-parse', 'HEAD');
  state.commits[fourth] = 4;
  writeFileSync(f.statePath, JSON.stringify(state));
  const result = f.run(fourth);
  assert.equal(result.status, 0, result.stderr);
  const releases = readState(f.statePath).releases;
  assert.deepEqual(releases.map((release) => release.tag_name), ['v0.1.0', 'v0.2.0']);
  assert.match(releases[1]?.body ?? '', /Change 3\. \(#3\)/);
  assert.match(releases[1]?.body ?? '', /Change 4\. \(#4\)/);
});
