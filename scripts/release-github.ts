import { setTimeout } from 'node:timers/promises';
import { verifyReleaseTag } from './release-provenance.ts';

interface Release {
  tag_name: string;
  target_commitish: string;
  name: string;
  body: string;
}
interface Options {
  fetch?: typeof fetch;
  wait?: (milliseconds: number) => Promise<void>;
}
class GithubFailure extends Error {
  readonly retryAfter: number | undefined;
  constructor(message: string, retryAfter?: number) {
    super(message);
    this.retryAfter = retryAfter;
  }
}
const attempts = 3;
const maximumDelay = 30_000;
function transportFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = 'code' in error ? error.code : undefined;
  return (
    [
      'EPIPE',
      'ECONNRESET',
      'ETIMEDOUT',
      'EAI_AGAIN',
      'UND_ERR_SOCKET',
      'UND_ERR_CONNECT_TIMEOUT',
      'UND_ERR_HEADERS_TIMEOUT',
      'UND_ERR_BODY_TIMEOUT',
    ].includes(String(code)) ||
    error.name === 'TimeoutError' ||
    transportFailure(error.cause)
  );
}
function retryDelay(response: Response): number | undefined {
  const header = response.headers.get('Retry-After');
  let delay: number | undefined;
  if (header !== null) {
    const value = /^\d+$/.test(header) ? Number(header) * 1000 : Date.parse(header) - Date.now();
    if (Number.isFinite(value)) delay = Math.max(0, value);
  }
  if (response.status >= 500 && response.status <= 599) return delay ?? 1000;
  if ((response.status === 429 || response.status === 403) && delay !== undefined) return delay;
  return undefined;
}

/** Reads may retry; ambiguous publication writes must reconcile first. */
export function releaseGithub(repository: string, token: string, options: Options = {}) {
  const send = options.fetch ?? fetch;
  const wait =
    options.wait ??
    (async (ms: number) => {
      await setTimeout(ms);
    });
  async function request(path: string, method = 'GET', body?: Release) {
    try {
      const response = await send(`https://api.github.com/repos/${repository}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(30_000),
      });
      // Consume each response before returning or retrying, including unsuccessful responses.
      const text = await response.text();
      if (!response.ok && !(method === 'GET' && response.status === 404))
        throw new GithubFailure(
          `GitHub ${method} ${path} failed: ${response.status}`,
          retryDelay(response),
        );
      return { status: response.status, data: text ? (JSON.parse(text) as unknown) : undefined };
    } catch (error) {
      if (error instanceof GithubFailure) throw error;
      throw new GithubFailure(
        `GitHub ${method} ${path} failed: ${transportFailure(error) ? 'transient transport error' : 'invalid response or transport error'}`,
        transportFailure(error) ? 1000 : undefined,
      );
    }
  }
  async function backoff(error: unknown, attempt: number) {
    if (!(error instanceof GithubFailure) || error.retryAfter === undefined) throw error;
    const delay = Math.max(error.retryAfter, 1000 * 2 ** attempt);
    if (delay > maximumDelay)
      throw new Error(`${error.message}; Retry-After exceeds ${maximumDelay}ms retry budget`);
    console.warn(
      `${error.message}; reconciling/retrying after ${delay}ms (${attempt + 1}/${attempts})`,
    );
    await wait(delay);
  }
  async function get(path: string) {
    for (let attempt = 0; ; attempt++) {
      try {
        return await request(path);
      } catch (error) {
        if (attempt === attempts - 1)
          throw new Error(`GitHub GET ${path} failed after ${attempts} attempts`, { cause: error });
        await backoff(error, attempt);
      }
    }
  }
  async function published(tag: string, sha: string) {
    const release = await get(`/releases/tags/${encodeURIComponent(tag)}`);
    if (release.status !== 404) {
      const data = release.data as { tag_name?: string; draft?: boolean };
      if (data.tag_name !== tag || data.draft !== false)
        throw new Error(`Invalid published release ${tag}`);
    }
    const ref = await get(`/git/ref/tags/${encodeURIComponent(tag)}`);
    if (ref.status === 404) {
      if (release.status !== 404) throw new Error(`Published release ${tag} has no tag`);
      return false;
    }
    const object = (data: unknown) =>
      data && typeof data === 'object' && 'object' in data ? data.object : undefined;
    await verifyReleaseTag(tag, sha, object(ref.data), async (tagSha) =>
      object((await get(`/git/tags/${tagSha}`)).data),
    );
    return release.status !== 404;
  }
  async function publish(release: Release) {
    for (let attempt = 0; attempt < attempts; attempt++) {
      if (await published(release.tag_name, release.target_commitish)) return;
      try {
        await request('/releases', 'POST', release);
      } catch (error) {
        if (!(error instanceof GithubFailure) || error.retryAfter === undefined) throw error;
        if (attempt === attempts - 1) {
          if (await published(release.tag_name, release.target_commitish)) return;
          throw new Error(`GitHub POST /releases failed after ${attempts} attempts`, {
            cause: error,
          });
        }
        await backoff(error, attempt);
        continue;
      }
      if (!(await published(release.tag_name, release.target_commitish)))
        throw new Error(`Release ${release.tag_name} not visible after creation`);
      return;
    }
  }
  return {
    published,
    publish,
    async json<T>(path: string): Promise<T> {
      const response = await get(path);
      if (response.status === 404) throw new Error(`GitHub GET ${path} failed: 404`);
      return response.data as T;
    },
  };
}
