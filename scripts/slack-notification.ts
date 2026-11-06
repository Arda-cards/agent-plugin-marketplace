import { pathToFileURL } from 'node:url';

function required(value: unknown, pattern: RegExp) {
  if (typeof value !== 'string' || !pattern.test(value))
    throw new Error('Invalid notification metadata');
  return value;
}

export function notificationPayload(env: NodeJS.ProcessEnv) {
  const kind = required(env.NOTIFICATION_KIND, /^(release|deployment|qualification)$/);
  const outcome = required(env.NOTIFICATION_OUTCOME, /^(success|failure|cancelled)$/);
  const repository = required(
    env.GITHUB_REPOSITORY,
    /^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}\/[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/,
  );
  const server = env.GITHUB_SERVER_URL || 'https://github.com';
  if (server !== 'https://github.com') throw new Error('Invalid notification server');
  const run = required(env.NOTIFICATION_RUN_ID || env.GITHUB_RUN_ID, /^[1-9][0-9]{0,19}$/);
  const attempt = required(
    env.NOTIFICATION_RUN_ATTEMPT || env.GITHUB_RUN_ATTEMPT,
    /^[1-9][0-9]{0,8}$/,
  );
  const sha = required(env.NOTIFICATION_SOURCE_SHA, /^[a-f0-9]{40}$/);
  const channel = required(env.SLACK_CHANNEL_ID, /^[CG][A-Z0-9]{8,30}$/);
  const release = env.NOTIFICATION_RELEASE || '';
  const environment = env.NOTIFICATION_ENVIRONMENT || '';
  if (release) required(release, /^[A-Za-z0-9][A-Za-z0-9._/-]{0,119}$/);
  if (environment) required(environment, /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/);
  const base = `${server}/${repository}`;
  const runUrl = `${base}/actions/runs/${run}/attempts/${attempt}`;
  const links = [`<${runUrl}|Workflow run>`, `<${base}/commit/${sha}|Source>`];
  if (release) links.push(`<${base}/releases/tag/${encodeURIComponent(release)}|Release>`);
  return {
    channel,
    text: `${repository} ${kind}: ${outcome}; source ${sha}; release ${release || 'not available'}; environment ${environment || 'not applicable'}; run ${run} attempt ${attempt}`,
    parse: 'none',
    unfurl_links: false,
    unfurl_media: false,
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: `Arda marketplace ${kind}: ${outcome}` } },
      {
        type: 'section',
        fields: [
          `Repository: ${repository}`,
          `Source: ${sha}`,
          `Release: ${release || 'not available'}`,
          `Environment: ${environment || 'not applicable'}`,
          `Run: ${run} (attempt ${attempt})`,
        ].map((text) => ({ type: 'plain_text', text })),
      },
      { type: 'context', elements: [{ type: 'mrkdwn', text: links.join(' · ') }] },
    ],
  };
}

export async function sendNotification(env: NodeJS.ProcessEnv, fetcher: typeof fetch = fetch) {
  if (!env.SLACK_BOT_TOKEN) return 'unconfigured';
  let payload;
  try {
    payload = notificationPayload(env);
  } catch {
    return 'invalid';
  }
  try {
    const response = await fetcher('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return 'failed';
    const body: unknown = await response.json();
    return body !== null && typeof body === 'object' && 'ok' in body && body.ok === true
      ? 'sent'
      : 'failed';
  } catch {
    // A transport failure may follow a successful post. Do not retry or print its details.
    return 'failed';
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await sendNotification(process.env);
  console.log(`Slack notification: ${result}.`);
}
