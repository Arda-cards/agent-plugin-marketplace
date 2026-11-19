import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const forbidden = /arda-cards-(?:mcp-)?(?:dev|stage|demo)\b|agent-plugin-marketplace-internal|make-app-internal|arda-cards-internal|arda-beta-(?!public-)[a-z0-9-]+|arda-dev-[a-z0-9-]+|(?:dev|stage|demo)\.alpha\d+\.io\.arda\.cards|(?:dev|stage|demo)(?:-lowercase)?-alpha\d+\.auth\.[a-z0-9-]+\.amazoncognito\.com/;
// Store only a one-way fingerprint; public source must not disclose another app's invitation.
const internalInvitationDigest = 'd57e93f9a8a26dec3b19a176431e30be30afd9b08a8d64f0a04293dcec69dfe6';
const endpoint = 'https://arda-cards-mcp-prod.arda-cards.workers.dev/mcp';
const scopes = 'workflow:write email:read email:manage offline_access';
const directName = 'arda-cards-operations';
const makeName = 'make-integration-app-public';
const semanticVersion = /^\d+\.\d+\.\d+$/;
const makeSkills = ['build-scenario', 'connect', 'diagnose', 'run-scenario'];

export interface PluginBundle {
  manifest: unknown;
  config: unknown;
}

type ObjectValue = Record<string, unknown>;
function object(value: unknown): asserts value is ObjectValue {
  assert.ok(typeof value === 'object' && value !== null && !Array.isArray(value));
}

export function validateMakeProfile(profile: unknown): void {
  object(profile);
  assert.deepEqual(Object.keys(profile).sort(), ['status', 'app', 'version', 'invitationUrl', 'source', 'environment', 'apiBaseUrl', 'authBaseUrl'].sort());
  assert.ok(profile.status === 'pending-publication' || profile.status === 'published');
  assert.equal(profile.environment, 'prod');
  assert.equal(profile.apiBaseUrl, 'https://prod.alpha001.io.arda.cards');
  assert.ok(profile.authBaseUrl === 'https://prod-alpha001.auth.us-east-1.amazoncognito.com' ||
    profile.authBaseUrl === 'https://prod-lowercase-alpha001.auth.us-east-1.amazoncognito.com');
  if (profile.app === null) assert.equal(profile.version, null);
  else {
    assert.ok(typeof profile.app === 'string' && /^app#[a-z0-9-]+$/.test(profile.app));
    assert.ok(typeof profile.version === 'number' && Number.isSafeInteger(profile.version) && profile.version > 0);
  }
  if (profile.status === 'pending-publication') {
    assert.equal(profile.invitationUrl, null);
    assert.equal(profile.source, null);
  } else {
    assert.notEqual(profile.app, null);
    assert.ok(typeof profile.invitationUrl === 'string' && /^https:\/\/www\.make\.com\/en\/hq\/app-invitation\/[a-f0-9]{32}$/.test(profile.invitationUrl));
    object(profile.source);
    assert.deepEqual(Object.keys(profile.source).sort(), ['commit', 'artifactId', 'release'].sort());
    assert.ok(typeof profile.source.commit === 'string' && /^[a-f0-9]{40}$/.test(profile.source.commit));
    assert.ok(typeof profile.source.artifactId === 'string' && /^[a-f0-9]{64}$/.test(profile.source.artifactId));
    assert.ok(typeof profile.source.release === 'string' && /^v\d+\.\d+\.\d+$/.test(profile.source.release));
  }
  validateContent(JSON.stringify(profile));
}

export function validateMakeCatalog(profile: unknown, catalog: unknown): void {
  validateMakeProfile(profile);
  object(profile);
  object(catalog);
  assert.deepEqual(Object.keys(catalog).sort(), ['source', 'app', 'version', 'groups', 'modules'].sort());
  assert.equal(catalog.app, profile.app);
  assert.equal(catalog.version, profile.version);
  assert.deepEqual(catalog.source, profile.source);
  const app = profile.app;
  assert.ok(app === null || typeof app === 'string');
  assert.ok(Array.isArray(catalog.groups) && catalog.groups.length > 0);
  assert.ok(catalog.groups.every((group: unknown) => typeof group === 'string' && group.length > 0));
  assert.equal(new Set(catalog.groups).size, catalog.groups.length);
  assert.ok(Array.isArray(catalog.modules) && catalog.modules.length > 0);
  const names = new Set<string>();
  for (const module of catalog.modules as unknown[]) {
    object(module);
    assert.deepEqual(Object.keys(module).sort(), ['name', 'label', 'module', 'kind', 'effect', 'group'].sort());
    assert.ok(typeof module.name === 'string' && /^[A-Za-z][A-Za-z0-9_-]*$/.test(module.name));
    assert.ok(!names.has(module.name));
    names.add(module.name);
    assert.ok(typeof module.label === 'string' && module.label.length > 0);
    assert.ok(module.kind === 'action' || module.kind === 'search');
    assert.ok(typeof module.effect === 'string' && ['read', 'write', 'unknown', 'configurable'].includes(module.effect));
    assert.ok(catalog.groups.includes(module.group));
    assert.equal(module.module, app === null ? null : `${app}:${module.name}`);
  }
  validateContent(JSON.stringify(catalog));
}

export function validateMetadata(marketplace: unknown, bundles: Record<string, PluginBundle>, version: unknown, profile: unknown, catalog: unknown): void {
  object(marketplace);
  object(version);
  validateMakeCatalog(profile, catalog);
  object(profile);
  assert.equal(marketplace.name, 'arda-cards');
  assert.ok(Array.isArray(marketplace.plugins));
  const expectedNames = profile.status === 'published' ? [directName, makeName] : [directName];
  assert.deepEqual(marketplace.plugins.map((entry: unknown) => {
    object(entry);
    assert.ok(typeof entry.name === 'string');
    assert.equal(entry.source, `./plugins/${entry.name}`);
    return entry.name;
  }), expectedNames);
  assert.deepEqual(Object.keys(bundles).sort(), [directName, makeName].sort());
  assert.ok(typeof version.version === 'string' && semanticVersion.test(version.version));
  const direct = bundles[directName];
  const make = bundles[makeName];
  assert.ok(direct && make);
  object(direct.manifest);
  object(direct.config);
  assert.equal(direct.manifest.name, directName);
  assert.equal(direct.manifest.version, version.version);
  const config = direct.config;
  object(config.mcpServers);
  assert.deepEqual(Object.keys(config.mcpServers), ['arda-cards-prod']);
  const connection = config.mcpServers['arda-cards-prod'];
  object(connection);
  assert.equal(connection.type, 'http');
  assert.equal(connection.url, endpoint);
  object(connection.oauth);
  assert.equal(connection.oauth.scopes, scopes);
  object(make.manifest);
  object(make.config);
  assert.equal(make.manifest.name, makeName);
  assert.ok(typeof make.manifest.version === 'string' && semanticVersion.test(make.manifest.version));
  assert.deepEqual(make.config, { mcpServers: { make: { type: 'http', url: 'https://mcp.make.com/v2' } } });
}

export function validateContent(content: string): void {
  assert.doesNotMatch(content, forbidden);
  for (const match of content.matchAll(/\b[a-f0-9]{32}\b/g)) {
    assert.notEqual(createHash('sha256').update(match[0]).digest('hex'), internalInvitationDigest);
  }
}

function scan(path: string): void {
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const target = join(path, entry.name);
    if (entry.isDirectory()) scan(target);
    else {
      assert.ok(entry.isFile(), `Unexpected non-file: ${target}`);
      assert.match(entry.name, /\.(?:md|json)$/, `Unexpected executable or asset: ${target}`);
      validateContent(readFileSync(target, 'utf8'));
    }
  }
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.deepEqual(readdirSync('plugins').sort(), [directName, makeName].sort());
  assert.deepEqual(readdirSync(`plugins/${makeName}/skills`).sort(), makeSkills);
  for (const skill of makeSkills) readFileSync(`plugins/${makeName}/skills/${skill}/SKILL.md`, 'utf8');
  const bundles = Object.fromEntries([directName, makeName].map((name) => [name, {
    manifest: readJson(`plugins/${name}/.claude-plugin/plugin.json`),
    config: readJson(`plugins/${name}/.mcp.json`),
  }]));
  validateMetadata(readJson('.claude-plugin/marketplace.json'), bundles, readJson('package.json'),
    readJson(`plugins/${makeName}/references/app-profile.json`), readJson(`plugins/${makeName}/references/modules.json`));
  scan('plugins');
  console.log('Production-only marketplace validated.');
}
