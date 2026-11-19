import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateContent, validateMakeCatalog, validateMakeProfile, validateMetadata } from './validate.ts';

const directName = 'arda-cards-operations';
const makeName = 'make-integration-app-public';
const entry = (name: string) => ({ name, source: `./plugins/${name}` });
const marketplace = { name: 'arda-cards', plugins: [entry(directName)] };
const version = { version: '0.2.0' };
const connection = { type: 'http', url: 'https://arda-cards-mcp-prod.arda-cards.workers.dev/mcp', oauth: { scopes: 'workflow:write email:read email:manage offline_access' } };
const bundles = {
  [directName]: { manifest: { name: directName, version: version.version }, config: { mcpServers: { 'arda-cards-prod': connection } } },
  [makeName]: { manifest: { name: makeName, version: '0.1.0' }, config: { mcpServers: { make: { type: 'http', url: 'https://mcp.make.com/v2' } } } },
};
const pending = {
  status: 'pending-publication', app: 'app#arda-customer-fixture', version: 1, invitationUrl: null, source: null,
  environment: 'prod', apiBaseUrl: 'https://prod.alpha001.io.arda.cards',
  authBaseUrl: 'https://prod-alpha001.auth.us-east-1.amazoncognito.com',
};
const published = {
  ...pending, status: 'published', invitationUrl: `https://www.make.com/en/hq/app-invitation/${'a'.repeat(32)}`,
  source: { commit: 'b'.repeat(40), artifactId: 'c'.repeat(64), release: 'v0.9.0' },
};
const catalog = {
  app: pending.app, version: pending.version, source: pending.source, groups: ['v1.reference.item.item.item'],
  modules: [{ name: 'getItem', label: 'Get an Item', module: `${pending.app}:getItem`, kind: 'action', effect: 'read', group: 'v1.reference.item.item.item' }],
};

await test('pending Make source remains unindexed while the direct plugin keeps its independent contract', () => {
  validateMetadata(marketplace, bundles, version, pending, catalog);
  assert.throws(() => validateMetadata({ ...marketplace, plugins: [...marketplace.plugins, entry(makeName)] }, bundles, version, pending, catalog));
  assert.throws(() => validateMetadata(marketplace, { [directName]: bundles[directName] }, version, pending, catalog));
  assert.throws(() => validateMetadata(marketplace, bundles, { version: '0.3.0' }, pending, catalog));
});

await test('published Make source requires its own marketplace entry, identity, invitation and exact provenance', () => {
  const index = { ...marketplace, plugins: [entry(directName), entry(makeName)] };
  const released = { ...catalog, source: published.source };
  validateMetadata(index, bundles, version, published, released);
  assert.throws(() => validateMetadata(marketplace, bundles, version, published, released));
  for (const change of [{ app: null }, { version: null }, { invitationUrl: null }, { source: null },
    { invitationUrl: 'https://example.test/invite' }, { source: { ...published.source, artifactId: 'unverified' } }]) {
    assert.throws(() => validateMakeProfile({ ...published, ...change }));
  }
  assert.throws(() => validateMakeCatalog(published, { ...released, source: { ...published.source, commit: 'd'.repeat(40) } }));
});

await test('Make and direct Arda MCP configurations cannot substitute for each other', () => {
  for (const config of [
    { mcpServers: { make: connection } },
    { mcpServers: { make: { type: 'http', url: 'https://mcp.make.com' } } },
    { mcpServers: { make: { type: 'http', url: 'https://mcp.make.com/v2', oauth: { scopes: 'workflow:write' } } } },
  ]) {
    assert.throws(() => validateMetadata(marketplace, { ...bundles, [makeName]: { ...bundles[makeName], config } }, version, pending, catalog));
  }
  for (const config of [
    { mcpServers: { 'arda-cards-prod': connection, make: bundles[makeName].config.mcpServers.make } },
    { mcpServers: { 'arda-cards-prod': { ...connection, url: 'https://mcp.make.com/v2' } } },
  ]) {
    assert.throws(() => validateMetadata(marketplace, { ...bundles, [directName]: { ...bundles[directName], config } }, version, pending, catalog));
  }
});

await test('public Make profiles accept both approved production pool OAuth hosts', () => {
  for (const authBaseUrl of [
    'https://prod-alpha001.auth.us-east-1.amazoncognito.com',
    'https://prod-lowercase-alpha001.auth.us-east-1.amazoncognito.com',
  ]) {
    for (const profile of [pending, published]) {
      assert.doesNotThrow(() => validateMakeProfile({ ...profile, authBaseUrl }));
    }
  }
});

await test('public Make profiles reject other OAuth hosts and URL variants', () => {
  for (const authBaseUrl of [
    'https://dev-lowercase-alpha002.auth.us-east-1.amazoncognito.com',
    'https://stage-lowercase-alpha002.auth.us-east-1.amazoncognito.com',
    'https://demo-lowercase-alpha001.auth.us-east-1.amazoncognito.com',
    'https://prod-lowercase-alpha002.auth.us-east-1.amazoncognito.com',
    'https://prod-lowercase-alpha001.auth.eu-west-1.amazoncognito.com',
    'https://another.auth.us-east-1.amazoncognito.com',
    'http://prod-lowercase-alpha001.auth.us-east-1.amazoncognito.com',
    'https://prod-lowercase-alpha001.auth.us-east-1.amazoncognito.com/',
    'https://prod-lowercase-alpha001.auth.us-east-1.amazoncognito.com/oauth2',
    'https://prod-lowercase-alpha001.auth.us-east-1.amazoncognito.com?client=other',
    'https://prod-lowercase-alpha001.auth.us-east-1.amazoncognito.com.evil.test',
    null,
    1,
  ]) {
    assert.throws(() => validateMakeProfile({ ...published, authBaseUrl }));
  }
});

await test('public Make routing, module identity and declared effects stay bound to its production profile', () => {
  for (const change of [{ environment: 'demo' }, { apiBaseUrl: 'https://example.test' }, { authBaseUrl: 'https://example.test' }]) {
    assert.throws(() => validateMakeProfile({ ...pending, ...change }));
  }
  for (const change of [{ app: 'app#another-app' }, { version: 2 }, { groups: [] }, { connectionId: 'unexpected' },
    { modules: [{ ...catalog.modules[0], module: 'app#another-app:getItem' }] },
    { modules: [{ ...catalog.modules[0], effect: 'safe' }] },
    { modules: [{ ...catalog.modules[0], effect: ['read'] }] },
    { modules: [{ ...catalog.modules[0], connectionId: 'unexpected' }] },
    { modules: [catalog.modules[0], catalog.modules[0]] }]) {
    assert.throws(() => validateMakeCatalog(pending, { ...catalog, ...change }));
  }
  validateMakeCatalog({ ...pending, app: null, version: null }, {
    ...catalog, app: null, version: null, modules: [{ ...catalog.modules[0], module: null }],
  });
});

await test('public content excludes internal identities, nonproduction targets and private repository references', () => {
  validateContent('Arda Beta (Public), https://prod.alpha001.io.arda.cards, https://mcp.make.com/v2');
  for (const text of ['arda-cards-dev', 'arda-cards-mcp-demo', 'agent-plugin-marketplace-internal', 'make-app-internal',
    'app#arda-beta-internal-fixture:getItem', 'arda-dev-fixture',
    'https://stage.alpha002.io.arda.cards', 'demo-lowercase-alpha001.auth.us-east-1.amazoncognito.com']) {
    assert.throws(() => validateContent(text));
  }
});

await test('the actual public validation entry point rejects unexpected plugin roots, executables and links', () => {
  const directory = mkdtempSync(join(tmpdir(), 'public-make-validation-'));
  const script = fileURLToPath(new URL('./validate.ts', import.meta.url));
  const files: Record<string, unknown> = {
    '.claude-plugin/marketplace.json': marketplace,
    'package.json': version,
    [`plugins/${directName}/.claude-plugin/plugin.json`]: bundles[directName].manifest,
    [`plugins/${directName}/.mcp.json`]: bundles[directName].config,
    [`plugins/${makeName}/.claude-plugin/plugin.json`]: bundles[makeName].manifest,
    [`plugins/${makeName}/.mcp.json`]: bundles[makeName].config,
    [`plugins/${makeName}/references/app-profile.json`]: pending,
    [`plugins/${makeName}/references/modules.json`]: catalog,
  };
  try {
    for (const [path, content] of Object.entries(files)) {
      const destination = join(directory, path);
      mkdirSync(dirname(destination), { recursive: true });
      writeFileSync(destination, JSON.stringify(content));
    }
    for (const skill of ['build-scenario', 'connect', 'diagnose', 'run-scenario']) {
      const destination = join(directory, `plugins/${makeName}/skills/${skill}/SKILL.md`);
      mkdirSync(dirname(destination), { recursive: true });
      writeFileSync(destination, `---\nname: ${skill}\ndescription: Fixture skill.\n---\n`);
    }
    const validate = () => execFileSync(process.execPath, [script], { cwd: directory, stdio: 'pipe' });
    validate();
    const executable = join(directory, `plugins/${makeName}/unexpected.js`);
    writeFileSync(executable, 'console.log("fixture");');
    assert.throws(validate);
    rmSync(executable);
    const linked = join(directory, `plugins/${makeName}/linked.json`);
    symlinkSync(join(directory, 'package.json'), linked);
    assert.throws(validate);
    rmSync(linked);
    const missingSkill = join(directory, `plugins/${makeName}/skills/connect/SKILL.md`);
    rmSync(missingSkill);
    assert.throws(validate);
    writeFileSync(missingSkill, 'Fixture skill.');
    mkdirSync(join(directory, 'plugins/unregistered'));
    assert.throws(validate);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
