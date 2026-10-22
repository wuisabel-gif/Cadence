import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const root = new URL('..', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');

test('desktop build injects the drop script and ships the detector', () => {
  execFileSync(process.execPath, [new URL('scripts/build-desktop.mjs', root).pathname]);
  const page = read('desktop/dist/index.html');
  assert.match(page, /<script src="desktop.js"><\/script>\n<\/body>/);
  assert.match(page, /<script src="extension\/detector.js"><\/script>/);
  assert.equal(read('desktop/dist/extension/detector.js'), read('extension/detector.js'));
});

test('browser detector exposes the prose extractors the desktop drop uses', () => {
  const ctx = {};
  vm.runInNewContext(read('extension/detector.js'), ctx);
  assert.equal(ctx.cadenceStripMarkdown('# Title\n\nPlain words here.').trim(), 'Plain words here.');
  assert.doesNotMatch(ctx.cadenceStripHtml('<p>Hi</p><script>x()</script>'), /x\(\)/);
});

test('desktop app version follows package.json', () => {
  assert.equal(JSON.parse(read('desktop/src-tauri/tauri.conf.json')).version, '../../package.json');
});
