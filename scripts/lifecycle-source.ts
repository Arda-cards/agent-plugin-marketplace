const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const fullSha = (value: unknown): value is string =>
  typeof value === 'string' && value.length === 40 && /^[a-f0-9]{40}$/i.test(value);

export function validateCiSource(run: unknown, repository: unknown, commitMessage: unknown) {
  if (
    !object(run) ||
    typeof repository !== 'string' ||
    repository !== repository.trim() ||
    !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository) ||
    run.path !== '.github/workflows/validate.yaml' ||
    run.name !== 'Validate marketplace' ||
    (!object(run.head_repository) ? undefined : run.head_repository.full_name) !== repository ||
    run.head_branch !== 'main' ||
    run.event !== 'push' ||
    run.status !== 'completed' ||
    run.conclusion !== 'success' ||
    !fullSha(run.head_sha) ||
    typeof commitMessage !== 'string'
  )
    throw new Error('Untrusted CI source');
  return {
    sourceSha: run.head_sha,
    assemble: !commitMessage.startsWith('chore: assemble CHANGELOG '),
  };
}

/**
 * Pure provenance validation, not approval. The caller alone supplies releaseSha after
 * validating successful CI and release.ts's exact released commit; it must bind ciSourceSha
 * to that validated run. Neither a presentation field nor an arbitrary SHA proves release authority.
 */
export function validateDeliverySource(input: unknown) {
  if (!object(input)) throw new Error('Untrusted delivery source');
  const { event, ref, sha, releaseSha, ciSourceSha } = input;
  if (
    event === 'workflow_run' &&
    ref === 'refs/heads/main' &&
    fullSha(releaseSha) &&
    fullSha(ciSourceSha)
  )
    return { sourceSha: releaseSha, manual: false };
  if (
    event === 'workflow_dispatch' &&
    typeof ref === 'string' &&
    ref !== 'refs/heads/main' &&
    /^refs\/heads\/[^\s\p{Cc}]+$/u.test(ref) &&
    fullSha(sha) &&
    (releaseSha === undefined || releaseSha === '') &&
    (ciSourceSha === undefined || ciSourceSha === '')
  )
    return { sourceSha: sha, manual: true };
  throw new Error('Untrusted delivery source');
}
