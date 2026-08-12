import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const seedNames = readdirSync(new URL('voices/', root))
  .filter((name) => name.endsWith('.md'))
  .map((name) => name.slice(0, -3))
  .sort();

test('SKILL.md lists every shipped seed voice exactly once', () => {
  const skill = readFileSync(new URL('skills/cadence/SKILL.md', root), 'utf8');
  const marker = skill.match(/\*\*Shipped seeds\*\*[\s\S]*?(?=\n- \*\*The user's own voices\*\*)/);
  assert.ok(marker, 'canonical shipped-seeds section is missing');
  const documented = [...marker[0].matchAll(/`([^`]+)`/g)]
    .map((match) => match[1])
    .filter((name) => !name.includes('/') && name !== 'voices/*.md');
  assert.deepEqual([...new Set(documented)].sort(), seedNames);
  assert.equal(documented.length, seedNames.length);
});

test('current picker copy uses the actual shipped seed count', () => {
  const skill = readFileSync(new URL('skills/cadence/SKILL.md', root), 'utf8');
  assert.match(skill, /ten seeds ship today/);
  assert.match(skill, /Ten voices ship today/);
});
