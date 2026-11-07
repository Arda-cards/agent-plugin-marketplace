/* eslint @typescript-eslint/require-await: off -- mocked asynchronous transport */
import assert from 'node:assert/strict';
import test from 'node:test';
import { releaseGithub } from './release-github.ts';

const sha = 'a'.repeat(40);
const release = { tag_name: 'v1.0.0', target_commitish: sha, name: 'v1.0.0', body: 'Notes' };
interface Step {
  path: string;
  body?: unknown;
  status?: number;
  headers?: HeadersInit | undefined;
  error?: Error;
}
function fixture(steps: Step[]) {
  const calls: [string, string][] = [];
  const delays: number[] = [];
  const api = releaseGithub('fixture/repository', 'dummy', {
    fetch: async (url, options = {}) => {
      const path = new URL(url instanceof Request ? url.url : url).pathname.replace(
        '/repos/fixture/repository',
        '',
      );
      calls.push([options.method ?? 'GET', path]);
      const step = steps.shift();
      assert.ok(step, `Unexpected request ${path}`);
      assert.equal(path, step.path);
      if (step.error) throw step.error;
      return new Response(JSON.stringify(step.body ?? {}), {
        status: step.status ?? 200,
        ...(step.headers ? { headers: step.headers } : {}),
      });
    },
    wait: async (ms) => {
      delays.push(ms);
    },
  });
  return { api, calls, delays, steps };
}
const missing = (): [Step, Step] => [
  { path: '/releases/tags/v1.0.0', status: 404 },
  { path: '/git/ref/tags/v1.0.0', status: 404 },
];
const existing = (): [Step, Step] => [
  { path: '/releases/tags/v1.0.0', body: { tag_name: 'v1.0.0', draft: false } },
  { path: '/git/ref/tags/v1.0.0', body: { object: { type: 'commit', sha } } },
];
const pipe = () =>
  new TypeError('fetch failed', {
    cause: Object.assign(new Error('write EPIPE'), { code: 'EPIPE' }),
  });

await test('transient failure before write reconciles before retrying creation', async () => {
  const f = fixture([
    ...missing(),
    { path: '/releases', error: pipe() },
    ...missing(),
    { path: '/releases', status: 201 },
    ...existing(),
  ]);
  await f.api.publish(release);
  assert.deepEqual(f.delays, [1000]);
  assert.equal(f.steps.length, 0);
});

await test('lost response after write reconciles without duplicate publication', async () => {
  const f = fixture([...missing(), { path: '/releases', error: pipe() }, ...existing()]);
  await f.api.publish(release);
  assert.equal(f.calls.filter(([method]) => method === 'POST').length, 1);
  assert.equal(f.steps.length, 0);
});

await test('already published release and tag are verified without a write', async () => {
  const f = fixture(existing());
  await f.api.publish(release);
  assert.equal(f.calls.length, 2);
  assert.deepEqual(f.delays, []);
});

await test('existing matching tag without release is completed', async () => {
  const f = fixture([
    { path: '/releases/tags/v1.0.0', status: 404 },
    existing()[1],
    { path: '/releases', status: 201 },
    ...existing(),
  ]);
  await f.api.publish(release);
  assert.equal(f.steps.length, 0);
});

await test('permanent auth and validation failures stop immediately', async () => {
  for (const status of [401, 403, 422]) {
    const f = fixture([...missing(), { path: '/releases', status }]);
    await assert.rejects(f.api.publish(release), new RegExp(`POST /releases failed: ${status}`));
    assert.deepEqual(f.delays, []);
    assert.equal(f.calls.length, 3);
  }
});

await test('reads retry 5xx, rate limits honor Retry-After, and error bodies are consumed', async () => {
  for (const status of [500, 502, 503, 504, 429, 403]) {
    const f = fixture([
      { path: '/example', status, headers: { 'Retry-After': '2' } },
      { path: '/example', body: { ok: true } },
    ]);
    assert.deepEqual(await f.api.json('/example'), { ok: true });
    assert.deepEqual(f.delays, [2000]);
  }
});

await test('retries are bounded and unknown transport failures are permanent', async () => {
  const f = fixture(Array.from({ length: 3 }, () => ({ path: '/example', error: pipe() })));
  await assert.rejects(f.api.json('/example'), /GET \/example.*3 attempts/);
  assert.deepEqual(f.delays, [1000, 2000]);
  const unknown = fixture([{ path: '/example', error: new TypeError('bad URL') }]);
  await assert.rejects(unknown.api.json('/example'), /GET \/example/);
  assert.deepEqual(unknown.delays, []);
});

await test('a conflicting tag, draft release, or missing published tag fails closed', async () => {
  for (const steps of [
    [
      existing()[0],
      { path: '/git/ref/tags/v1.0.0', body: { object: { type: 'commit', sha: 'b'.repeat(40) } } },
    ],
    [{ path: '/releases/tags/v1.0.0', body: { tag_name: 'v1.0.0', draft: true } }],
    [existing()[0], { path: '/git/ref/tags/v1.0.0', status: 404 }],
  ]) {
    const f = fixture(steps);
    await assert.rejects(f.api.publish(release), /release|tag/i);
    assert.equal(
      f.calls.some(([method]) => method === 'POST'),
      false,
    );
  }
});

await test('exhausted creation retries reconcile one last time and never claim success when missing', async () => {
  for (const final of [existing(), missing()]) {
    const f = fixture([
      ...missing(),
      { path: '/releases', status: 503 },
      ...missing(),
      { path: '/releases', status: 503 },
      ...missing(),
      { path: '/releases', error: pipe() },
      ...final,
    ]);
    if (final[0].status === 404) await assert.rejects(f.api.publish(release), /3 attempts/);
    else await f.api.publish(release);
    assert.equal(f.calls.filter(([method]) => method === 'POST').length, 3);
  }
});

await test('annotated tags resolve to the assembly and malformed or cyclic tags fail closed', async () => {
  const tagSha = 'c'.repeat(40);
  const annotated = {
    path: '/git/ref/tags/v1.0.0',
    body: { object: { type: 'tag', sha: tagSha } },
  };
  const f = fixture([
    existing()[0],
    annotated,
    { path: `/git/tags/${tagSha}`, body: { object: { type: 'commit', sha } } },
  ]);
  await f.api.publish(release);
  const invalid = fixture([
    existing()[0],
    { ...annotated, body: { object: { type: 'tag', sha: 'bad' } } },
  ]);
  await assert.rejects(invalid.api.publish(release), /Invalid tag/);
  const cycle = fixture([
    existing()[0],
    annotated,
    ...Array.from({ length: 5 }, () => ({ path: `/git/tags/${tagSha}`, body: annotated.body })),
  ]);
  await assert.rejects(cycle.api.publish(release), /does not target assembly/);
});

await test('rate limits without usable Retry-After fail and long waits exceed the bounded budget', async () => {
  for (const headers of [undefined, { 'Retry-After': 'invalid' }]) {
    const f = fixture([{ path: '/example', status: 429, headers }]);
    await assert.rejects(f.api.json('/example'), /429/);
    assert.deepEqual(f.delays, []);
  }
  const long = fixture([{ path: '/example', status: 429, headers: { 'Retry-After': '31' } }]);
  await assert.rejects(long.api.json('/example'), /retry budget/);
  assert.deepEqual(long.delays, []);
  const date = fixture([
    { path: '/example', status: 429, headers: { 'Retry-After': 'Thu, 01 Jan 1970 00:00:00 GMT' } },
    { path: '/example', body: {} },
  ]);
  await date.api.json('/example');
  assert.deepEqual(date.delays, [1000]);
});

await test('timeout, direct reset and body-read reset are transient; responses are drained', async () => {
  for (const error of [
    new DOMException('timed out', 'TimeoutError'),
    Object.assign(new Error('reset'), { code: 'ECONNRESET' }),
  ]) {
    const f = fixture([{ path: '/example', error }, { path: '/example' }]);
    await f.api.json('/example');
    assert.deepEqual(f.delays, [1000]);
  }
  let reads = 0;
  const api = releaseGithub('fixture/repository', 'dummy', {
    fetch: async () => {
      const response = new Response('{}');
      response.text = async () => {
        if (++reads === 1) throw pipe();
        return '{}';
      };
      return response;
    },
    wait: async () => {},
  });
  await api.json('/example');
  assert.equal(reads, 2);
});

await test('missing reads and successful writes without visible publication fail safely', async () => {
  const absent = fixture([{ path: '/example', status: 404 }]);
  await assert.rejects(absent.api.json('/example'), /404/);
  const invisible = fixture([...missing(), { path: '/releases', status: 201 }, ...missing()]);
  await assert.rejects(invisible.api.publish(release), /not visible/);
  const mismatch = fixture([
    { path: '/releases/tags/v1.0.0', body: { tag_name: 'v2.0.0', draft: false } },
  ]);
  await assert.rejects(mismatch.api.publish(release), /Invalid published release/);
});
