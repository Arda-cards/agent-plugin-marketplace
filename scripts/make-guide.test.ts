import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { validateContent } from './validate.ts';

const markdownPath = new URL('../docs/make-beta-tester-guide.md', import.meta.url);
const pdfPath = new URL('../docs/make-beta-tester-guide.pdf', import.meta.url);

await test('the public customer guide PDF records the exact committed Markdown source', () => {
  const markdown = readFileSync(markdownPath);
  const digest = createHash('sha256').update(markdown).digest('hex');
  const pdf = readFileSync(pdfPath);
  assert.ok(pdf.subarray(0, 5).equals(Buffer.from('%PDF-')));
  assert.ok(pdf.includes(Buffer.from(`Markdown SHA256: ${digest}`)), 'Regenerate and copy the customer PDF with its Markdown source.');
  validateContent(markdown.toString('utf8'));
});

await test('public README installation and customer-guide links resolve in this checkout', () => {
  const readmePath = new URL('../README.md', import.meta.url);
  const readme = readFileSync(readmePath, 'utf8');
  validateContent(readme);
  for (const match of readme.matchAll(/\]\(([^)]+)\)/g)) {
    const target = match[1];
    if (!target || /^[a-z]+:/i.test(target) || target.startsWith('#')) continue;
    assert.ok(existsSync(new URL(target.split('#')[0] ?? target, readmePath)), `Missing public README link: ${target}`);
  }
});
