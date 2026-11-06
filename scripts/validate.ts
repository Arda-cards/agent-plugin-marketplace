import { readFileSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { join } from 'node:path';

const marketplace = JSON.parse(readFileSync('.claude-plugin/marketplace.json', 'utf8'));
const plugin = JSON.parse(readFileSync('plugins/arda-cards-operations/.claude-plugin/plugin.json', 'utf8'));
const config = JSON.parse(readFileSync('plugins/arda-cards-operations/.mcp.json', 'utf8'));
assert.equal(marketplace.name, 'arda-cards');
assert.equal(marketplace.plugins.length, 1);
assert.equal(marketplace.plugins[0].name, 'arda-cards-operations');
assert.equal(marketplace.plugins[0].source, './plugins/arda-cards-operations');
assert.equal(plugin.name, 'arda-cards-operations');
assert.deepEqual(Object.keys(config.mcpServers), ['arda-cards-prod']);
assert.equal(config.mcpServers['arda-cards-prod'].url, 'https://arda-cards-mcp-prod.arda-cards.workers.dev/mcp');
function scan(path: string): void {
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const target = join(path, entry.name);
    if (entry.isDirectory()) scan(target);
    else assert.doesNotMatch(readFileSync(target, 'utf8'), /arda-cards-(?:mcp-)?(?:dev|stage|demo)\b|agent-plugin-marketplace-internal|arda-cards-internal/);
  }
}
scan('plugins');
console.log('Production-only marketplace validated.');
