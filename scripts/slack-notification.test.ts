/* eslint @typescript-eslint/require-await: off -- mock transports return asynchronous responses */
import assert from 'node:assert/strict';
import test from 'node:test';
import { notificationPayload, sendNotification } from './slack-notification.ts';

const context = {
  GITHUB_REPOSITORY: 'Arda-cards/mcp-cloudflare',
  GITHUB_SERVER_URL: 'https://github.com',
  GITHUB_RUN_ID: '123456789',
  GITHUB_RUN_ATTEMPT: '2',
  SLACK_CHANNEL_ID: 'C0C6U59T614',
  SLACK_BOT_TOKEN: 'test-token-never-log',
  NOTIFICATION_KIND: 'deployment',
  NOTIFICATION_OUTCOME: 'success',
  NOTIFICATION_SOURCE_SHA: 'a'.repeat(40),
  NOTIFICATION_RELEASE: 'v0.4.0',
  NOTIFICATION_ENVIRONMENT: 'Alpha002.dev',
};

await test('notification links the exact source, release, environment and workflow attempt', () => {
  const payload = notificationPayload(context);
  const rendered = JSON.stringify(payload);
  assert.equal(payload.channel, context.SLACK_CHANNEL_ID);
  assert.ok(rendered.includes('Alpha002.dev'));
  assert.ok(rendered.includes('v0.4.0'));
  assert.ok(
    rendered.includes(`https://github.com/Arda-cards/mcp-cloudflare/commit/${'a'.repeat(40)}`),
  );
  assert.ok(rendered.includes('/actions/runs/123456789/attempts/2'));
  assert.ok(rendered.includes('/releases/tag/v0.4.0'));
  assert.ok(!rendered.includes(context.SLACK_BOT_TOKEN));
  assert.equal(payload.unfurl_links, false);
  assert.equal(payload.unfurl_media, false);
});

await test('each supported terminal lifecycle outcome builds without requiring a release', () => {
  for (const kind of ['release', 'deployment', 'qualification'])
    for (const outcome of ['success', 'failure', 'cancelled']) {
      const payload = notificationPayload({
        ...context,
        NOTIFICATION_KIND: kind,
        NOTIFICATION_OUTCOME: outcome,
        NOTIFICATION_RELEASE: '',
      });
      assert.ok(payload.text.includes(`${kind}: ${outcome}`));
    }
});
await test('an explicitly supplied caller run and attempt retain the correct notification link', () => {
  const payload = notificationPayload({
    ...context,
    NOTIFICATION_RUN_ID: '987654321',
    NOTIFICATION_RUN_ATTEMPT: '3',
  });
  assert.ok(JSON.stringify(payload).includes('/actions/runs/987654321/attempts/3'));
  assert.ok(!JSON.stringify(payload).includes('/actions/runs/123456789'));
});

await test('invalid or unsafe metadata cannot become a Slack message or an injected link', async () => {
  for (const patch of [
    { GITHUB_REPOSITORY: 'org/repo><!channel>' },
    { GITHUB_SERVER_URL: 'http://github.com' },
    { GITHUB_SERVER_URL: 'https://attacker.example' },
    { GITHUB_RUN_ID: '123|@here' },
    { NOTIFICATION_SOURCE_SHA: 'main' },
    { NOTIFICATION_RELEASE: 'v1\n<!channel>' },
    { NOTIFICATION_ENVIRONMENT: 'dev\n@here' },
    { NOTIFICATION_KIND: 'pull_request' },
    { NOTIFICATION_OUTCOME: 'in_progress' },
    { SLACK_CHANNEL_ID: '#invented-channel' },
  ]) {
    let calls = 0;
    assert.equal(
      await sendNotification({ ...context, ...patch }, async () => {
        calls++;
        throw new Error('Unexpected network request');
      }),
      'invalid',
    );
    assert.equal(calls, 0);
  }
});

await test('unconfigured notification skips without making a network call', async () => {
  let calls = 0;
  assert.equal(
    await sendNotification({ ...context, SLACK_BOT_TOKEN: '' }, async () => {
      calls++;
      throw new Error('Unexpected network request');
    }),
    'unconfigured',
  );
  assert.equal(calls, 0);
});

await test('Slack posting sends one bounded request with token only in the authorization header', async () => {
  let calls = 0;
  const result = await sendNotification(context, async (url, options) => {
    calls++;
    assert.equal(url, 'https://slack.com/api/chat.postMessage');
    assert.ok(options);
    assert.equal(
      new Headers(options.headers).get('Authorization'),
      `Bearer ${context.SLACK_BOT_TOKEN}`,
    );
    assert.equal(typeof options.body, 'string');
    assert.ok(typeof options.body === 'string');
    assert.ok(!options.body.includes(context.SLACK_BOT_TOKEN));
    assert.ok(options.signal instanceof AbortSignal);
    return Response.json({ ok: true });
  });
  assert.equal(result, 'sent');
  assert.equal(calls, 1);
});

await test('HTTP, Slack API and uncertain transport failures return only a generic result without retries', async () => {
  for (const response of [
    () => new Response('sensitive error body', { status: 503 }),
    () => Response.json({ ok: false, error: context.SLACK_BOT_TOKEN }),
    () => {
      throw new Error(context.SLACK_BOT_TOKEN);
    },
    () => new Response('invalid JSON'),
  ]) {
    let calls = 0;
    const result = await sendNotification(context, async () => {
      calls++;
      return response();
    });
    assert.equal(result, 'failed');
    assert.equal(calls, 1);
    assert.ok(!result.includes(context.SLACK_BOT_TOKEN));
  }
});
