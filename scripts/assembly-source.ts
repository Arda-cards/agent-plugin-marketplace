import { assemblyPrefix } from './changelog.ts';

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const fullSha = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f0-9]{40}$/i.test(value);

/** Only resume a checked source or its changelog-only assembly child. */
export function selectAssemblySource(input: unknown) {
  if (!object(input) || !fullSha(input.sourceSha) || !fullSha(input.mainSha))
    throw new Error('Invalid assembly source identity');
  const { sourceSha, mainSha, headMessage, headParents, changedFiles } = input;
  if (mainSha === sourceSha) return { assemble: true, checkoutSha: sourceSha };
  if (typeof headMessage !== 'string' || !headMessage.startsWith(assemblyPrefix) ||
      !headMessage.split('\n').includes(`Changelog-Source: ${sourceSha}`))
    return { assemble: false, checkoutSha: sourceSha };
  if (!Array.isArray(headParents) || headParents.length !== 1 || headParents[0] !== sourceSha ||
      !Array.isArray(changedFiles) || changedFiles.length !== 1)
    throw new Error('Unsafe assembly recovery source');
  const file: unknown = changedFiles[0];
  if (!object(file) || file.filename !== 'CHANGELOG.md' || file.status !== 'modified' ||
      Object.hasOwn(file, 'previous_filename')) throw new Error('Unsafe assembly recovery source');
  return { assemble: true, checkoutSha: mainSha };
}
