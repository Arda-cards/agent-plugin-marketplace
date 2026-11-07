import { readFileSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const forbidden = /arda-cards-(?:mcp-)?(?:dev|stage|demo)\b|agent-plugin-marketplace-internal|arda-cards-internal/;
const endpoint = 'https://arda-cards-mcp-prod.arda-cards.workers.dev/mcp';
const scopes = 'workflow:write email:read email:manage offline_access';

type ObjectValue = Record<string, unknown>;
function object(value: unknown): asserts value is ObjectValue {
  assert.ok(typeof value === 'object' && value !== null && !Array.isArray(value));
}

export function validateMetadata(marketplace: unknown, plugin: unknown, config: unknown, version: unknown): void {
  object(marketplace);
  object(plugin);
  object(config);
  object(version);
  assert.equal(marketplace.name, 'arda-cards');
  assert.ok(Array.isArray(marketplace.plugins));
  assert.equal(marketplace.plugins.length, 1);
  const entry: unknown = marketplace.plugins[0];
  object(entry);
  assert.equal(entry.name, 'arda-cards-operations');
  assert.equal(entry.source, './plugins/arda-cards-operations');
  assert.equal(plugin.name, 'arda-cards-operations');
  assert.ok(typeof version.version === 'string' && /^\d+\.\d+\.\d+$/.test(version.version));
  assert.equal(plugin.version, version.version);
  object(config.mcpServers);
  assert.deepEqual(Object.keys(config.mcpServers), ['arda-cards-prod']);
  const connection = config.mcpServers['arda-cards-prod'];
  object(connection);
  assert.equal(connection.type, 'http');
  assert.equal(connection.url, endpoint);
  object(connection.oauth);
  assert.equal(connection.oauth.scopes, scopes);
}

export function validateContent(content: string): void {
  assert.doesNotMatch(content, forbidden);
}

function scan(path: string): void {
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const target = join(path, entry.name);
    if (entry.isDirectory()) scan(target);
    else {
      assert.ok(entry.isFile(), `Unexpected non-file: ${target}`);
      validateContent(readFileSync(target, 'utf8'));
    }
  }
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  validateMetadata(readJson('.claude-plugin/marketplace.json'),
    readJson('plugins/arda-cards-operations/.claude-plugin/plugin.json'),
    readJson('plugins/arda-cards-operations/.mcp.json'), readJson('package.json'));
  scan('plugins');
  console.log('Production-only marketplace validated.');
}
