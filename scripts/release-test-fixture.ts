/* eslint @typescript-eslint/require-await: off -- mock HTTP transport */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { z } from 'zod';

const releaseSchema = z.object({
  tag_name: z.string(),
  target_commitish: z.string(),
  name: z.string(),
  body: z.string(),
  draft: z.boolean().optional(),
});
export const stateSchema = z.object({
  commits: z.record(z.string(), z.number()),
  releases: z.array(releaseSchema),
  failRelease: z.boolean(),
  transientBefore: z.boolean(),
  transientAfter: z.boolean(),
  posts: z.number(),
  calls: z.number(),
  wrongTag: z.boolean().optional(),
  failVerificationReads: z.number().optional(),
  priorConclusion: z.string().optional(),
});
export type ReleaseState = z.infer<typeof stateSchema>;
export const readState = (path: string): ReleaseState =>
  stateSchema.parse(JSON.parse(readFileSync(path, 'utf8')));

const statePath = process.env.FIXTURE_API;
if (statePath) {
  globalThis.fetch = async (input, options = {}) => {
    const state = readState(statePath);
    state.calls++;
    const path = new URL(input instanceof Request ? input.url : input).pathname;
    let data: unknown;
    let status = 200;
    if (path.includes('/actions/runs/')) {
      data = { total_count: 1, jobs: [{ name: 'Assemble changelog and release', conclusion: state.priorConclusion ?? 'failure' }] };
    } else if (path.includes('/commits/')) {
      const sha = path.split('/')[5];
      assert.ok(sha && state.commits[sha], `Unexpected commit ${sha}`);
      data = [{ number: state.commits[sha], merged_at: '2026-10-16', base: { ref: 'main' } }];
    } else if (path.includes('/pulls/')) {
      data = { body: '## CHANGELOG\n### Added\n- Change ' + path.split('/').pop() + '.' };
    } else if (path.includes('/releases/tags/')) {
      const tag = path.split('/').pop();
      assert.ok(tag);
      data = state.releases.find((release) => release.tag_name === decodeURIComponent(tag));
      if (data && (state.failVerificationReads ?? 0) > 0) {
        state.failVerificationReads = (state.failVerificationReads ?? 0) - 1;
        status = 503;
        data = { message: 'temporary failure' };
      } else if (!data) {
        status = 404;
        data = { message: 'Not Found' };
      }
    } else if (path.includes('/git/ref/tags/')) {
      const tag = path.split('/').pop();
      assert.ok(tag);
      const release = state.releases.find(
        (release) => release.tag_name === decodeURIComponent(tag),
      );
      if (release)
        data = {
          object: {
            type: 'commit',
            sha: state.wrongTag ? 'b'.repeat(40) : release.target_commitish,
          },
        };
      else {
        status = 404;
        data = {};
      }
    } else if (path.endsWith('/releases') && options.method === 'POST') {
      state.posts++;
      assert.equal(typeof options.body, 'string');
      assert.ok(typeof options.body === 'string');
      const release = { ...releaseSchema.parse(JSON.parse(options.body)), draft: false };
      if (state.transientBefore || state.transientAfter) {
        if (state.transientAfter) state.releases.push(release);
        state.transientBefore = false;
        state.transientAfter = false;
        writeFileSync(statePath, JSON.stringify(state));
        throw new TypeError('fetch failed', {
          cause: Object.assign(new Error('write EPIPE'), { code: 'EPIPE' }),
        });
      }
      if (state.failRelease) {
        state.failRelease = false;
        status = 422;
        data = {};
      } else {
        data = release;
        state.releases.push(release);
      }
    } else if (path.endsWith('/releases')) data = state.releases;
    else throw new Error('Unexpected API path ' + path);
    writeFileSync(statePath, JSON.stringify(state));
    return new Response(JSON.stringify(data), { status });
  };
}
