import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { analyze, stripHtml } from '../skills/cadence/scripts/deslop.mjs';
import { SKILL_TARGETS } from '../scripts/skill-targets.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const html = read('index.html');
const pkg = JSON.parse(read('package.json'));
const text = (markup) => markup.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
const cards = [...html.matchAll(/<article\b[^>]*data-agent="([^"]+)"[^>]*>([\s\S]*?)<\/article>/g)];
const aliases = { codex: 'codex', kimi: 'kimi', zcode: 'zcode', 'claude-code': 'claude', opencode: 'opencode' };
const demo = Object.fromEntries([...html.matchAll(/data-(before|after)-(score|grade)="([^"]+)"/g)].map((m) => [m[1] + m[2], m[3]]));

test('website covers every install target with its real npm command and default path', () => {
  assert.deepEqual(cards.map((m) => m[1]).sort(), Object.keys(SKILL_TARGETS).sort());
  for (const [, agent, markup] of cards) {
    const target = SKILL_TARGETS[agent];
    const command = `npm run install:${aliases[agent]}`;
    assert.ok(pkg.scripts[`install:${aliases[agent]}`]);
    if (agent !== 'codex') assert.ok(pkg.scripts[`install:${aliases[agent]}`].includes(`--agent ${agent}`));
    assert.ok(markup.includes(command), `${agent} install command`);
    assert.ok(markup.includes(`~/${target.user.join('/')}/cadence`), `${agent} user path`);
    assert.ok(text(markup).includes(target.label));
    assert.ok(markup.includes(`/integrations/${agent}/README.md`));
  }
  assert.match(cards.find((m) => m[1] === 'kimi')[2], /KIMI_CODE_HOME/);
  assert.match(text(cards.find((m) => m[1] === 'zcode')[2]), /--project is not supported/);
});

test('site source version and publication notice match release preparation metadata', () => {
  const versions = [...html.matchAll(/data-source-version="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(versions.length, 3);
  assert.ok(versions.every((version) => version === pkg.version));
  const notice = text(html.match(/<p[^>]+id="release-status"[^>]*>([\s\S]*?)<\/p>/)[1]);
  const heading = read('CHANGELOG.md').split('\n').find((line) => line.startsWith(`## [${pkg.version}]`));
  assert.ok(heading, 'missing release heading');
  if (/prepared|unreleased|not yet released/i.test(heading)) {
    assert.ok(notice.includes(`npm v${pkg.version} package has not been published`));
    assert.match(notice, /Available from source now/);
    assert.ok(!html.includes(`cadence-deslop@${pkg.version}`), 'do not offer an unpublished npm version');
  } else {
    assert.ok(notice.includes(`v${pkg.version} is released`));
    assert.ok(notice.includes(`cadence-deslop@${pkg.version}`));
    assert.ok(!notice.includes('has not been published'));
  }
});

test('hero example scores and terminal summary match the current detector', () => {
  for (const [kind, label] of [['slop', 'before'], ['clean', 'after']]) {
    const markup = html.match(new RegExp(`<p class="spec-text ${kind}">([\\s\\S]*?)</p>`))[1];
    const result = analyze(text(markup));
    assert.equal(Number(demo[label + 'score']), result.score);
    assert.equal(demo[label + 'grade'], result.grade);
    assert.ok(text(html).includes(`score ${result.score}/100 · grade ${result.grade}`));
  }
  assert.match(html, /Checked example.*no model runs in this demo/);
  assert.match(html, /See example rewrite/);
});

test('published regression figures match the benchmark and retain its limitation', () => {
  const report = JSON.parse(execFileSync(process.execPath, [fileURLToPath(new URL('benchmark/bench.mjs', root)), '--json'], { encoding: 'utf8' }));
  const { metrics } = report;
  assert.ok(html.includes(`${metrics.samples}-sample regression corpus`));
  assert.ok(html.includes(`precision is ${(metrics.precision * 100).toFixed(1)}% and recall is ${(metrics.recall * 100).toFixed(1)}%`));
  assert.match(html, /not a blind authorship test/);
});

test('page IDs, local anchors, copy targets, and repository documentation links resolve', () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length, 'duplicate element IDs');
  for (const [, id] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(id), `missing anchor ${id}`);
  for (const [, id] of html.matchAll(/data-copy="([^"]+)"/g)) assert.ok(ids.includes(id), `missing copy target ${id}`);
  const prefix = 'https://github.com/wuisabel-gif/Cadence/blob/main/';
  for (const [, href] of html.matchAll(/href="([^"]+)"/g)) {
    if (href.startsWith(prefix)) assert.ok(existsSync(new URL(href.slice(prefix.length).split('#')[0], root)), `missing document ${href}`);
  }
  assert.match(html, /\.no-js \.copy-command\{display:none\}/);
});

test('new install and FAQ prose passes the documentation gate', () => {
  // Deliberate slop specimens elsewhere on the page are examples, not site copy.
  for (const id of ['agents', 'faq']) {
    const section = html.match(new RegExp(`<section[^>]*id="${id}"[^>]*>([\\s\\S]*?)</section>`));
    assert.ok(section, `missing ${id} section`);
    const result = analyze(stripHtml(section[1]));
    assert.ok(result.score <= 10, `${id} prose scores ${result.score}`);
  }
});

// Exercise the real inline handlers with only the DOM fields they use. Browser
// layout and clipboard permissions are checked separately in a real browser.
function page(clipboard) {
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) elements.set(id, { textContent: '', dataset: {}, style: {}, attrs: {}, events: {},
      classList: { remove() {}, add() {}, toggle() {} },
      setAttribute(key, value) { this.attrs[key] = value; },
      addEventListener(type, fn) { this.events[type] = fn; },
    });
    return elements.get(id);
  }
  element('readout').dataset = { beforeScore: demo.beforescore, beforeGrade: demo.beforegrade, afterScore: demo.afterscore, afterGrade: demo.aftergrade };
  const buttons = [...html.matchAll(/data-copy="([^"]+)"/g)].map(([, id]) => {
    element(id).textContent = html.match(new RegExp(`<code id="${id}">([^<]+)</code>`))[1];
    const button = element('button-' + id);
    button.dataset.copy = id;
    return button;
  });
  const document = {
    documentElement: element('html'), getElementById: element,
    querySelector: () => element('dot'), querySelectorAll: () => buttons,
  };
  const context = vm.createContext({ window: { matchMedia: () => ({ matches: true }) }, document, navigator: { clipboard } });
  for (const [, script] of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) vm.runInContext(script, context);
  return { elements, buttons };
}

test('copy buttons copy the actual installer text and announce success', async () => {
  const copied = [];
  const { elements, buttons } = page({ writeText: async (value) => { copied.push(value); } });
  for (const button of buttons) {
    button.events.click();
    await Promise.resolve();
    assert.equal(copied.at(-1), elements.get(button.dataset.copy).textContent);
    assert.equal(elements.get('install-copy-status').textContent, 'Copied: ' + copied.at(-1));
  }
});

test('clipboard unavailability or rejection gives a manual-copy fallback', async () => {
  for (const clipboard of [undefined, { writeText: () => Promise.reject(new Error('denied')) }]) {
    const { elements, buttons } = page(clipboard);
    buttons[0].events.click();
    await Promise.resolve();
    assert.match(elements.get('install-copy-status').textContent, /Clipboard unavailable/);
    assert.equal(elements.get(buttons[0].dataset.copy).textContent, 'npm run install:codex');
  }
});

test('example toggle uses the checked fixture values and labels the rewrite honestly', () => {
  const { elements } = page();
  const toggle = elements.get('toggle');
  toggle.events.click();
  assert.equal(elements.get('scoreNum').textContent, Number(demo.afterscore));
  assert.equal(toggle.attrs['aria-pressed'], 'true');
  assert.match(elements.get('caption').textContent, /Prewritten.*no model call/);
  toggle.events.click();
  assert.equal(elements.get('scoreNum').textContent, Number(demo.beforescore));
  assert.equal(toggle.attrs['aria-pressed'], 'false');
});
