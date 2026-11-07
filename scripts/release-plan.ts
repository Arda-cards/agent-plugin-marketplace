import { parseChangelog, renderEntries } from './changelog.ts';

/** Construct release notes without accessing the network or mutating the checkout. */
export function planRelease(input: {
  version: string;
  changelog: string;
  date: string;
  pullRequests: { number: number; body: string }[];
}): { version: string; changelog: string; notes: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || Number.isNaN(Date.parse(`${input.date}T00:00:00Z`)) ||
      new Date(`${input.date}T00:00:00Z`).toISOString().slice(0, 10) !== input.date)
    throw new Error('Invalid release date');
  if (!input.changelog.startsWith('# Changelog\n')) throw new Error('Invalid changelog header');
  if (!input.pullRequests.length) throw new Error('No pull requests to release');
  const seen = new Set<number>();
  const entries = input.pullRequests.flatMap((pr) => {
    if (!Number.isSafeInteger(pr.number) || pr.number < 1 || seen.has(pr.number)) throw new Error('Invalid or duplicate pull request');
    seen.add(pr.number);
    return parseChangelog(pr.body).map((entry) => ({ ...entry, text: `${entry.text} (#${pr.number})` }));
  });
  const version = input.version;
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Invalid release version');
  const tail = input.changelog.slice('# Changelog'.length).trim();
  const unreleased = tail.match(/^## \[(?:Unreleased|\d+\.\d+\.\d+)\](?: - Unreleased)?\s*\n([\s\S]*?)(?=^## |$(?![\s\S]))/m);
  const historical = unreleased?.[1]?.trim() ?? '';
  const remaining = unreleased && unreleased.index !== undefined
    ? `${tail.slice(0, unreleased.index)}${tail.slice(unreleased.index + unreleased[0].length)}`.trim()
    : tail;
  const notes = [renderEntries(entries), historical ? `### Previously unreleased\n\n${historical}` : ''].filter(Boolean).join('\n\n');
  const changelog = `# Changelog\n\n## [${version}] - ${input.date}\n\n${notes}\n${remaining ? `\n${remaining}\n` : ''}`;
  return { version, changelog, notes };
}
