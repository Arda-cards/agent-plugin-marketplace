/** Resolve GitHub lightweight/annotated tags with the same bounded policy in publication and delivery. */
export async function verifyReleaseTag(
  tag: string,
  expectedSha: string,
  reference: unknown,
  readTag: (sha: string) => Promise<unknown>,
): Promise<void> {
  if (!/^[a-f0-9]{40}$/.test(expectedSha)) throw new Error('Invalid assembly SHA');
  const object = (value: unknown): { type: string; sha: string } => {
    if (
      !value ||
      typeof value !== 'object' ||
      !('type' in value) ||
      !('sha' in value) ||
      typeof value.type !== 'string' ||
      typeof value.sha !== 'string' ||
      !/^[a-f0-9]{40}$/.test(value.sha)
    )
      throw new Error(`Invalid tag ${tag}`);
    return { type: value.type, sha: value.sha };
  };
  let current = object(reference);
  for (let depth = 0; current.type === 'tag' && depth < 5; depth++) {
    current = object(await readTag(current.sha));
  }
  if (current.type !== 'commit' || current.sha !== expectedSha)
    throw new Error(`Tag ${tag} does not target assembly ${expectedSha}`);
}
