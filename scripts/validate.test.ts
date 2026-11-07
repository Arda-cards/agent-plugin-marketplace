import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateContent, validateMetadata } from './validate.ts';

const marketplace = { name: 'arda-cards', plugins: [{ name: 'arda-cards-operations', source: './plugins/arda-cards-operations' }] };
const plugin = { name: 'arda-cards-operations', version: '0.1.0' };
const version = { version: '0.1.0' };
const connection = { type: 'http', url: 'https://arda-cards-mcp-prod.arda-cards.workers.dev/mcp', oauth: { scopes: 'workflow:write email:read email:manage offline_access' } };

await test('requires a single production connection and consistent release version', () => {
  validateMetadata(marketplace, plugin, { mcpServers: { 'arda-cards-prod': connection } }, version);
  assert.throws(() => validateMetadata(marketplace, plugin, { mcpServers: { 'arda-cards-prod': connection, 'arda-cards-dev': connection } }, version));
  assert.throws(() => validateMetadata(marketplace, plugin, { mcpServers: { 'arda-cards-prod': { ...connection, url: 'https://example.com' } } }, version));
  assert.throws(() => validateMetadata(marketplace, plugin, { mcpServers: { 'arda-cards-prod': connection } }, { version: '0.2.0' }));
});

await test('rejects internal and nonproduction connection references', () => {
  validateContent('arda-cards-prod');
  for (const text of ['arda-cards-dev', 'arda-cards-mcp-demo', 'agent-plugin-marketplace-internal']) {
    assert.throws(() => validateContent(text));
  }
});
