import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** Evaluate complete local CodeQL SARIF, independently of GitHub's aggregate status. */
export function blockingFindings(document: unknown) {
  if (
    !object(document) ||
    document.version !== '2.1.0' ||
    !Array.isArray(document.runs) ||
    !document.runs.length
  )
    throw new Error('Missing SARIF 2.1.0 analysis runs.');
  let count = 0;
  for (const candidate of document.runs as unknown[]) {
    if (!object(candidate)) throw new Error('Incomplete or unsuccessful CodeQL analysis.');
    const tool = object(candidate.tool) ? candidate.tool : undefined;
    const driver = object(tool?.driver) ? tool.driver : undefined;
    const rules = driver?.rules;
    if (
      driver?.name !== 'CodeQL' ||
      !Array.isArray(rules) ||
      rules.some((rule: unknown) => !object(rule)) ||
      !Array.isArray(candidate.results) ||
      (candidate.invocations !== undefined && !Array.isArray(candidate.invocations)) ||
      (Array.isArray(candidate.invocations) &&
        candidate.invocations.some(
          (invocation: unknown) => !object(invocation) || invocation.executionSuccessful === false,
        ))
    )
      throw new Error('Incomplete or unsuccessful CodeQL analysis.');
    for (const result of candidate.results as unknown[]) {
      if (!object(result)) throw new Error('Finding has no matching CodeQL rule.');
      const rule = (rules as unknown[]).find(
        (entry): entry is Record<string, unknown> => object(entry) && entry.id === result.ruleId,
      );
      if (!rule) throw new Error('Finding has no matching CodeQL rule.');
      const properties = object(rule.properties) ? rule.properties : undefined;
      const severity = properties?.['security-severity'];
      const security = Array.isArray(properties?.tags) && properties.tags.includes('security');
      if (
        (security && severity === undefined) ||
        (severity !== undefined &&
          ((typeof severity !== 'string' && typeof severity !== 'number') ||
            String(severity).trim() === '' ||
            !Number.isFinite(Number(severity)) ||
            Number(severity) < 0 ||
            Number(severity) > 10))
      )
        throw new Error('Finding has an invalid security severity.');
      const configuration = object(rule.defaultConfiguration)
        ? rule.defaultConfiguration
        : undefined;
      const level = result.level ?? configuration?.level ?? 'warning';
      // Include reported existing and suppressed findings; do not filter by SARIF baseline.
      if (Number(severity) >= 7 || level === 'error') count++;
    }
  }
  return count;
}

export function checkDirectory(directory: string) {
  const files = readdirSync(directory).filter((name) => name.endsWith('.sarif'));
  for (const required of ['actions.sarif', 'javascript.sarif']) {
    if (!files.includes(required)) throw new Error(`Missing required analysis: ${required}`);
  }
  const count = files.reduce(
    (total, name) =>
      total + blockingFindings(JSON.parse(readFileSync(join(directory, name), 'utf8'))),
    0,
  );
  if (count) throw new Error(`CodeQL security gate rejected ${count} blocking finding(s).`);
  return { files: files.length, blockingFindings: count };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log(JSON.stringify(checkDirectory(process.argv[2] ?? '')));
  } catch (error) {
    // Never log SARIF content, source snippets, or diagnostic messages containing secrets.
    console.error(
      error instanceof SyntaxError
        ? 'Invalid SARIF JSON.'
        : error instanceof Error
          ? error.message
          : 'CodeQL analysis failed.',
    );
    process.exitCode = 1;
  }
}
