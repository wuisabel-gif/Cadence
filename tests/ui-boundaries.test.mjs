import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const detector = createRequire(import.meta.url)('../integrations/vscode/detector.js');
const browserDetector = read('extension/detector.js');
const NORMAL = "In today's world, our seamless and robust platform leverages cutting-edge AI to streamline your workflow.\n\n" +
  "It's not just a tool, it's a revolution. When it comes to results, we deliver fast, reliable, and scalable outcomes. " +
  'Our comprehensive, innovative, and transformative solution empowers you to unlock unparalleled potential.';
const RECOVERY = 'The river ran low all summer. Then the rains came back, hard and sudden, and the water rose overnight.\n\n' +
  'I left my coat by the door. It was dry by morning.';
const LIMIT = 5 * 1024 * 1024;
const OVERSIZED = NORMAL + '\n\n' + 'x'.repeat(LIMIT);
const OVERSIZED_CASES = [
  ['prose', OVERSIZED],
  ['one token', 'x'.repeat(LIMIT + 1)],
  ['UTF-8 bytes, not characters', 'é'.repeat(LIMIT / 2 + 1)],
  ['whitespace', ' '.repeat(LIMIT + 1)],
];
const LIMIT_MESSAGE = /cannot score:.*exceeds the 5 MiB limit.*shorten/i;

// Small local fakes, not a browser or an extension host. The production scripts,
// generated detectors, event listeners, and debounce callbacks run unchanged.
function clock() {
  let next = 0;
  const pending = new Map();
  return {
    setTimeout(fn) { const id = ++next; pending.set(id, fn); return id; },
    clearTimeout(id) { pending.delete(id); },
    flush() {
      const tasks = [...pending.values()];
      pending.clear();
      for (const fn of tasks) fn();
    },
  };
}

class Element {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.id = '';
    this.value = '';
    this.className = '';
    this.style = {};
    this.dataset = {};
    this.children = [];
    this.listeners = new Map();
    this.parts = new Map();
    this._html = '';
    this._text = '';
    this.classList = {
      contains: (name) => this.className.split(/\s+/).includes(name),
      add: (...names) => { this.className = [...new Set([...this.className.split(/\s+/).filter(Boolean), ...names])].join(' '); },
      remove: (...names) => { this.className = this.className.split(/\s+/).filter((name) => !names.includes(name)).join(' '); },
    };
  }
  get textContent() { return this._text; }
  set textContent(value) {
    this._text = String(value);
    this._html = this._text;
    this.children = [];
    this.parts.clear();
  }
  get innerHTML() { return this._html; }
  set innerHTML(value) {
    this._html = String(value);
    this._text = this._html.replace(/<[^>]*>/g, '');
    this.children = [];
    this.parts.clear();
  }
  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(fn);
  }
  dispatch(type, target = this) {
    for (const fn of this.listeners.get(type) || []) fn({ type, target });
  }
  click() { this.dispatch('click'); }
  focus() { this.focused = true; }
  scrollIntoView() {}
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  remove() { this.parentNode.children = this.parentNode.children.filter((child) => child !== this); }
  contains(node) { return node === this || this.children.some((child) => child.contains(node)); }
  querySelector(selector) {
    if (this.parts.has(selector)) return this.parts.get(selector);
    // Only the assistant's class-addressed controls need parsing in these tests.
    assert.ok(selector.startsWith('.'), 'unexpected selector: ' + selector);
    const match = [...this._html.matchAll(/<(\w+)\b[^>]*\bclass="([^"]*)"[^>]*>/g)]
      .find((m) => m[2].split(/\s+/).includes(selector.slice(1)));
    if (!match) return null;
    const child = new Element(match[1]);
    child.className = match[2];
    this.parts.set(selector, child);
    return this.appendChild(child);
  }
}

function browser(html = '', hash = '') {
  const time = clock();
  const document = new Element('document');
  document.documentElement = document.appendChild(new Element('html'));
  document.body = document.documentElement.appendChild(new Element('body'));
  const ids = new Map();
  // Populate IDs and classes from the real page markup rather than copying them.
  for (const m of html.split('<script')[0].matchAll(/<([a-z][\w-]*)\b([^>]*)>/gi)) {
    const id = /\bid="([^"]+)"/.exec(m[2]);
    if (!id) continue;
    const el = new Element(m[1]);
    el.id = id[1];
    el.className = /\bclass="([^"]*)"/.exec(m[2])?.[1] || '';
    ids.set(el.id, el);
    document.body.appendChild(el);
  }
  document.getElementById = (id) => ids.get(id) || document.documentElement.children.find((el) => el.id === id) || null;
  document.querySelectorAll = () => [];
  const blobs = [], downloads = [], canvases = [];
  document.createElement = (tag) => {
    const el = new Element(tag);
    if (tag === 'canvas') {
      const ctx = {};
      for (const name of ['beginPath', 'moveTo', 'arcTo', 'closePath', 'fillRect', 'stroke', 'fillText', 'fill']) ctx[name] = () => {};
      el.getContext = () => ctx;
      el.toBlob = (callback) => blobs.push(callback);
      canvases.push(el);
    }
    if (tag === 'a') el.click = () => downloads.push({ href: el.href, download: el.download });
    return el;
  };
  const writes = [], prompts = [];
  const location = { origin: 'https://cadence.test', pathname: '/check.html', hostname: 'mail.google.com', hash };
  const context = vm.createContext({
    document, location, TextEncoder,
    setTimeout: time.setTimeout, clearTimeout: time.clearTimeout,
    addEventListener() {},
    navigator: { clipboard: { writeText(text) {
      return new Promise((resolve, reject) => writes.push({ text, resolve, reject }));
    } } },
    history: { replaceState() { location.hash = ''; } },
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    prompt: (...args) => prompts.push(args),
    URL: { createObjectURL: () => 'blob:local-test', revokeObjectURL() {} },
  });
  context.window = context;
  vm.runInContext(browserDetector, context, { filename: 'extension/detector.js' });
  return { context, document, time, writes, prompts, blobs, downloads, canvases, el: (id) => document.getElementById(id) };
}

function scorePage(hash = '') {
  const html = read('check.html');
  const h = browser(html, hash);
  for (const script of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
    vm.runInContext(script[1], h.context, { filename: 'check.html' });
  }
  h.input = (text) => { h.el('in').value = text; h.el('in').dispatch('input'); };
  return h;
}

function popup(pendingText) {
  const h = browser(read('extension/popup.html'));
  h.removed = [];
  if (pendingText !== undefined) h.context.chrome = { storage: { local: {
    get(key, callback) { assert.equal(key, 'pendingText'); callback({ pendingText }); },
    remove(key) { h.removed.push(key); },
  } } };
  vm.runInContext(read('extension/popup.js'), h.context, { filename: 'extension/popup.js' });
  h.input = (text) => { h.el('input').value = text; h.el('input').dispatch('input'); };
  return h;
}

function assistant() {
  const h = browser();
  vm.runInContext(read('extension/assistant.js'), h.context, { filename: 'extension/assistant.js' });
  h.meter = h.el('cadence-meter');
  h.part = (name) => h.meter.querySelector('.' + name);
  h.box = new Element('div');
  h.box.closest = () => h.box;
  h.input = (text, event = 'input') => {
    h.box.innerText = text;
    h.document.dispatch(event, h.box);
    h.time.flush();
  };
  return h;
}

function assertPageCleared(h) {
  assert.equal(h.el('results').classList.contains('on'), false);
  assert.equal(h.el('banner').style.display, 'none');
  assert.equal(h.el('share').style.display, 'none');
  assert.equal(h.el('grade').textContent, '·');
  assert.equal(h.el('grade').className, 'grade');
  for (const id of ['score', 'verdict', 'metrics', 'findings', 'hm', 'sharemsg']) assert.equal(h.el(id).textContent, '', id);
  const writes = h.writes.length, canvases = h.canvases.length;
  h.el('copylink').click();
  h.el('saveimg').click();
  assert.equal(h.writes.length, writes, 'no stale share link');
  assert.equal(h.canvases.length, canvases, 'no stale image');
}

function assertPopupCleared(h) {
  assert.equal(h.el('readout').classList.contains('empty'), true);
  assert.equal(h.el('readout').dataset.grade, '');
  assert.equal(h.el('score').textContent, '·');
  for (const id of ['grade', 'findings', 'heatmap']) assert.equal(h.el(id).textContent, '', id);
}

function assertMeterCleared(h) {
  assert.equal(h.meter.classList.contains('scored'), false);
  assert.equal(h.meter.dataset.grade, '');
  assert.equal(h.part('g').textContent, '·');
  assert.equal(h.part('s').textContent, '');
  assert.equal(h.part('t').textContent, '');
}

for (const [label, oversized] of OVERSIZED_CASES) {
  test(`score page: normal → oversized (${label}) → normal, without stale shares`, () => {
    const h = scorePage();
    h.input(NORMAL);
    assert.equal(h.el('score').textContent, String(detector.analyze(NORMAL).score));
    assert.match(h.el('findings').textContent, /banned-phrase/);
    assert.match(h.el('hm').innerHTML, /hm-row/);
    h.el('copylink').click();
    assert.equal(h.writes.length, 1);
    assert.doesNotThrow(() => h.input(oversized));
    assert.equal(h.el('in').value, oversized, 'input is not truncated');
    assertPageCleared(h);
    assert.equal(h.el('empty').style.display, 'block');
    assert.match(h.el('empty').textContent, LIMIT_MESSAGE);
    assert.equal(h.el('wc').textContent, 'Not scored');
    h.input(RECOVERY);
    const r = detector.analyze(RECOVERY);
    assert.equal(h.el('results').classList.contains('on'), true);
    assert.equal(h.el('empty').style.display, 'none');
    assert.equal(h.el('share').style.display, 'flex');
    assert.equal(h.el('grade').textContent, r.grade);
    assert.equal(h.el('score').textContent, String(r.score));
    assert.match(h.el('findings').textContent, /No lexical tells/);
    h.el('copylink').click();
    const shared = JSON.parse(Buffer.from(h.writes[1].text.split('#r=')[1], 'base64url').toString());
    assert.deepEqual(shared, { g: r.grade, s: r.score, t: [], w: r.metrics.words });
    h.input('Short input.');
    assertPageCleared(h);
    assert.doesNotMatch(h.el('empty').textContent, /cannot score/i);
    assert.equal(h.el('wc').textContent, '2 words');
    h.input(NORMAL);
    h.el('clear').click();
    assertPageCleared(h);
    assert.equal(h.el('wc').textContent, '0 words');
  });

  test(`popup: normal → oversized (${label}) → normal`, () => {
    const h = popup();
    h.input(NORMAL);
    assert.equal(h.el('score').textContent, String(detector.analyze(NORMAL).score));
    assert.match(h.el('findings').textContent, /banned-phrase/);
    assert.match(h.el('heatmap').innerHTML, /hm-row/);
    assert.doesNotThrow(() => h.input(oversized));
    assert.equal(h.el('input').value, oversized, 'input is not truncated');
    assertPopupCleared(h);
    assert.match(h.el('metrics').textContent, LIMIT_MESSAGE);
    h.input(RECOVERY);
    assert.equal(h.el('readout').classList.contains('empty'), false);
    assert.equal(h.el('readout').dataset.grade, detector.analyze(RECOVERY).grade);
    assert.equal(h.el('score').textContent, String(detector.analyze(RECOVERY).score));
    assert.match(h.el('findings').textContent, /No tells/);
    assert.doesNotMatch(h.el('metrics').textContent, /cannot score/i);
    h.input('');
    assertPopupCleared(h);
    assert.equal(h.el('metrics').textContent, '');
  });

  test(`content meter: normal → oversized (${label}) → normal`, () => {
    const h = assistant();
    h.input(NORMAL, 'focusin');
    assert.equal(h.meter.classList.contains('on'), true);
    assert.equal(h.meter.classList.contains('scored'), true);
    assert.equal(h.part('s').textContent, detector.analyze(NORMAL).score + '/100');
    assert.match(h.part('t').textContent, /banned-phrase/);
    assert.doesNotThrow(() => h.input(oversized));
    assert.equal(h.box.innerText, oversized, 'compose text is not changed');
    assertMeterCleared(h);
    assert.equal(h.meter.classList.contains('score-error'), true);
    assert.match(h.part('m').textContent, LIMIT_MESSAGE);
    h.input(RECOVERY);
    assert.equal(h.meter.classList.contains('scored'), true);
    assert.equal(h.meter.classList.contains('score-error'), false);
    assert.equal(h.part('s').textContent, detector.analyze(RECOVERY).score + '/100');
    assert.equal(h.meter.dataset.grade, detector.analyze(RECOVERY).grade);
    assert.match(h.part('t').textContent, /No tells/);
    assert.doesNotMatch(h.part('m').textContent, /cannot score/i);
    h.input('Short input.');
    assertMeterCleared(h);
    assert.equal(h.part('m').textContent, '');
  });
}

test('score page clears an incoming shared score when analysis is rejected', () => {
  const hash = '#r=' + Buffer.from(JSON.stringify({ g: 'F', s: 99, w: 100, t: ['old-tell'] })).toString('base64url');
  const h = scorePage(hash);
  assert.equal(h.el('banner').style.display, 'flex');
  assert.equal(h.el('score').textContent, '99');
  h.input(OVERSIZED);
  assertPageCleared(h);
  assert.match(h.el('empty').textContent, LIMIT_MESSAGE);
});

test('score page ignores pending clipboard and canvas callbacks after rejection or recovery', async () => {
  for (const recover of [false, true]) {
    const h = scorePage();
    h.input(NORMAL);
    h.el('copylink').click();
    h.el('copylink').click();
    h.el('saveimg').click();
    assert.equal(h.blobs.length, 1);
    h.input(OVERSIZED);
    if (recover) h.input(RECOVERY);
    h.writes[0].resolve();
    h.writes[1].reject(new Error('clipboard denied'));
    assert.doesNotThrow(() => h.blobs[0]({}));
    await Promise.resolve();
    assert.equal(h.el('sharemsg').textContent, '');
    assert.equal(h.prompts.length, 0);
    assert.equal(h.downloads.length, 0);
    if (recover) {
      h.el('saveimg').click();
      h.blobs[1]({});
      assert.equal(h.downloads[0].download, 'cadence-score-' + detector.analyze(RECOVERY).grade + '.png');
      assert.equal(h.el('sharemsg').textContent, 'Image saved');
      h.el('copylink').click();
      h.writes[2].resolve();
      await Promise.resolve();
      assert.equal(h.el('sharemsg').textContent, 'Link copied');
    }
  }
});

test('popup consumes an oversized pending selection and can recover locally', () => {
  const h = popup(OVERSIZED);
  assert.deepEqual(h.removed, ['pendingText']);
  assert.equal(h.el('input').value, OVERSIZED);
  assertPopupCleared(h);
  assert.match(h.el('metrics').textContent, LIMIT_MESSAGE);
  h.input(NORMAL);
  assert.equal(h.el('score').textContent, String(detector.analyze(NORMAL).score));
});

test('score page and popup clear all results if paragraph analysis rejects', () => {
  for (const create of [scorePage, popup]) {
    const h = create();
    h.input(NORMAL);
    const original = h.context.cadenceAnalyzeParagraphs;
    vm.runInContext('cadenceAnalyzeParagraphs = function () { throw new RangeError("input exceeds the 5 MiB limit"); };', h.context);
    assert.doesNotThrow(() => h.input(RECOVERY));
    if (create === scorePage) {
      assertPageCleared(h);
      assert.match(h.el('empty').textContent, LIMIT_MESSAGE);
    } else {
      assertPopupCleared(h);
      assert.match(h.el('metrics').textContent, LIMIT_MESSAGE);
    }
    h.context.cadenceAnalyzeParagraphs = original;
    h.input(RECOVERY);
    assert.equal(h.el('score').textContent, String(detector.analyze(RECOVERY).score));
  }
});

test('browser boundaries do not silently swallow unexpected analyzer bugs', () => {
  for (const create of [scorePage, popup, assistant]) {
    const h = create();
    h.input(NORMAL);
    const error = new TypeError('unexpected detector bug');
    h.context.cadenceAnalyze = () => { throw error; };
    assert.throws(() => h.input(RECOVERY), (e) => e === error);
    if (create === scorePage) assertPageCleared(h);
    else if (create === popup) assertPopupCleared(h);
    else assertMeterCleared(h);
  }
});

function makeDocument(text = NORMAL, name = 'writing.txt', languageId = 'plaintext') {
  return {
    text, languageId, fileName: '/local-test/' + name,
    uri: { scheme: 'file', toString: () => 'file:///local-test/' + name },
    getText(selection) { return selection ? selection.text : this.text; },
    positionAt(offset) {
      const lines = this.text.slice(0, offset).split('\n');
      return { line: lines.length - 1, character: lines[lines.length - 1].length };
    },
  };
}

function vscodeHost({ text = NORMAL, settings = {}, languageId = 'plaintext' } = {}) {
  const time = clock(), events = {}, commands = new Map(), diagnostics = new Map();
  const config = { languages: ['plaintext', 'markdown'], ...settings };
  const doc = makeDocument(text, 'writing.txt', languageId);
  const output = { lines: [], clear() { this.lines = []; }, appendLine(line) { this.lines.push(line); }, show() {}, dispose() {} };
  const status = {
    visible: false, hides: 0,
    show() { this.visible = true; }, hide() { this.visible = false; this.hides++; }, dispose() {},
  };
  const errors = [], messages = [], analysisInputs = [];
  const subscribe = (name) => (fn) => { events[name] = fn; return { dispose() {} }; };
  const h = { doc, output, status, errors, messages, diagnostics, events, config, time, analysisInputs };
  const vscode = {
    DiagnosticSeverity: { Warning: 1, Information: 2, Hint: 3 },
    StatusBarAlignment: { Right: 2 },
    Range: class { constructor(start, end) { this.start = start; this.end = end; } },
    Diagnostic: class { constructor(range, message, severity) { Object.assign(this, { range, message, severity }); } },
    MarkdownString: class { constructor(value) { this.value = value; } },
    ThemeColor: class { constructor(id) { this.id = id; } },
    languages: { createDiagnosticCollection: () => ({
      set(uri, values) { diagnostics.set(uri.toString(), values); },
      delete(uri) { diagnostics.delete(uri.toString()); },
      dispose() {},
    }) },
    window: {
      activeTextEditor: { document: doc, selection: { text } },
      createOutputChannel: () => output,
      createStatusBarItem: () => status,
      onDidChangeActiveTextEditor: subscribe('active'),
      showInformationMessage() {},
      showErrorMessage(message) { errors.push(message); },
      setStatusBarMessage(text) {
        const message = { text, disposed: false, dispose() { this.disposed = true; } };
        messages.push(message);
        return message;
      },
    },
    workspace: {
      getConfiguration: () => ({ get: (key, fallback) => key in config ? config[key] : fallback }),
      onDidChangeTextDocument: subscribe('change'),
      onDidCloseTextDocument: subscribe('close'),
      onDidChangeConfiguration: subscribe('config'),
    },
    commands: { registerCommand(id, fn) { commands.set(id, fn); return { dispose() {} }; } },
  };
  const module = { exports: {} };
  vm.runInNewContext(read('integrations/vscode/extension.js'), {
    module, RangeError, setTimeout: time.setTimeout, clearTimeout: time.clearTimeout,
    require(id) {
      if (id === 'vscode') return vscode;
      assert.equal(id, './detector.js');
      return { ...detector, analyze(input) {
        analysisInputs.push(input);
        if (h.failure) throw h.failure;
        return detector.analyze(input);
      } };
    },
  }, { filename: 'integrations/vscode/extension.js' });
  h.vscode = vscode;
  h.context = { subscriptions: [] };
  module.exports.activate(h.context);
  h.command = (id) => commands.get(id)();
  h.edit = (text, flush = true) => {
    doc.text = text;
    vscode.window.activeTextEditor.selection.text = text;
    events.change({ document: doc });
    if (flush) time.flush();
  };
  h.configure = (key, value) => { config[key] = value; events.config({ affectsConfiguration: (name) => name === 'cadence' }); };
  h.activateDocument = (document) => {
    vscode.window.activeTextEditor = document ? { document, selection: { text: document.text } } : undefined;
    events.active(vscode.window.activeTextEditor);
  };
  return h;
}

function assertVscodeRejected(h) {
  assert.equal(h.diagnostics.has(h.doc.uri.toString()), false);
  assert.equal(h.status.visible, true);
  assert.equal(h.status.text, '$(warning) Cadence: not scored');
  assert.match(h.status.tooltip, LIMIT_MESSAGE);
  assert.equal(h.status.backgroundColor, undefined);
  assert.match(h.output.lines.join('\n'), LIMIT_MESSAGE);
  assert.doesNotMatch(h.output.lines.join('\n'), /banned-phrase|score \d+\/100/);
}

for (const [label, oversized] of OVERSIZED_CASES) {
  test(`VS Code live refresh: normal → oversized (${label}) → normal`, () => {
    const h = vscodeHost();
    assert.equal(h.analysisInputs.length, 1, 'share one analysis between diagnostics and the status bar');
    assert.ok(h.diagnostics.get(h.doc.uri.toString()).length > 0);
    assert.equal(h.status.text, `$(pencil) Cadence ${detector.analyze(NORMAL).grade}·${detector.analyze(NORMAL).score}`);
    assert.ok(h.status.backgroundColor);
    h.command('cadence.scoreDocument');
    assert.match(h.output.lines.join('\n'), /banned-phrase/);
    assert.doesNotThrow(() => h.edit(oversized));
    assert.equal(h.analysisInputs[h.analysisInputs.length - 1], oversized, 'analyze the full input');
    assert.equal(h.doc.text, oversized, 'document is not changed');
    assertVscodeRejected(h);
    assert.equal(h.messages[0].disposed, true, 'clear the previous transient score');
    assert.equal(h.errors.length, 0, 'typing must not spam modal errors');
    h.edit(RECOVERY);
    const r = detector.analyze(RECOVERY);
    assert.equal(h.status.visible, true);
    assert.equal(h.status.text, `$(pencil) Cadence ${r.grade}·${r.score}`);
    assert.match(h.status.tooltip.value, /Cadence de-slop/);
    assert.doesNotMatch(h.status.tooltip.value, /cannot score/i);
    assert.equal(h.output.lines.length, 0, 'clear the rejected report on recovery');
    assert.equal(h.diagnostics.get(h.doc.uri.toString()).length, 0);
    h.edit(NORMAL);
    assert.ok(h.diagnostics.get(h.doc.uri.toString()).length > 0);
  });
}

test('VS Code activation on an oversized document is bounded and recovers', () => {
  const h = vscodeHost({ text: OVERSIZED });
  assertVscodeRejected(h);
  h.edit(RECOVERY);
  assert.equal(h.status.text, `$(pencil) Cadence ${detector.analyze(RECOVERY).grade}·${detector.analyze(RECOVERY).score}`);
});

for (const command of ['cadence.scoreDocument', 'cadence.scoreSelection']) {
  for (const [label, oversized] of OVERSIZED_CASES) {
    test(`VS Code ${command} clears diagnostics, status, and the previous report on failure (${label})`, () => {
      const h = vscodeHost();
      h.command(command);
      assert.match(h.output.lines.join('\n'), /banned-phrase/);
      h.edit(oversized, false); // Invoke the command before the live debounce fires.
      assert.doesNotThrow(() => h.command(command));
      assertVscodeRejected(h);
      assert.match(h.errors[0], LIMIT_MESSAGE);
      assert.equal(h.messages[0].disposed, true);
      h.edit(RECOVERY);
      h.command(command);
      assert.match(h.output.lines.join('\n'), /No lexical tells/);
      assert.doesNotMatch(h.output.lines.join('\n'), /cannot score/i);
      assert.equal(h.messages[h.messages.length - 1].disposed, false);
      assert.equal(h.errors.length, 1);
    });
  }
}

test('VS Code prose-only document commands retain the analyzer boundary', () => {
  const h = vscodeHost({ languageId: 'markdown', settings: { proseOnly: true } });
  h.command('cadence.scoreDocument');
  h.edit(OVERSIZED, false);
  assert.doesNotThrow(() => h.command('cadence.scoreDocument'));
  assertVscodeRejected(h);
  h.edit('**' + RECOVERY + '**');
  h.command('cadence.scoreDocument');
  assert.match(h.output.lines.join('\n'), /No lexical tells/);
});

test('VS Code explicitly hides an already visible status item when toggled off', () => {
  for (const diagnostics of [true, false]) {
    const h = vscodeHost({ settings: { 'diagnostics.enabled': diagnostics } });
    assert.equal(h.status.visible, true);
    const hides = h.status.hides;
    h.configure('statusBar.enabled', false);
    assert.ok(h.status.hides > hides, 'hide() must be called, not just skip updating');
    assert.equal(h.status.visible, false);
    assert.equal(h.status.text, '');
    assert.equal(h.status.tooltip, undefined);
    h.edit(OVERSIZED);
    assert.equal(h.status.visible, false);
    h.command('cadence.scoreDocument');
    assert.equal(h.status.visible, false, 'command errors must respect the setting');
    assert.equal(h.diagnostics.has(h.doc.uri.toString()), false);
    assert.match(h.errors[0], LIMIT_MESSAGE);
    h.configure('statusBar.enabled', true);
    assertVscodeRejected(h);
    h.edit(RECOVERY);
    assert.equal(h.status.visible, true);
    assert.match(h.status.text, /Cadence A/);
  }
});

test('VS Code diagnostics-disabled mode still catches status-bar analysis failures', () => {
  const h = vscodeHost({ settings: { 'diagnostics.enabled': false } });
  assert.equal(h.diagnostics.size, 0);
  h.edit(OVERSIZED);
  assertVscodeRejected(h);
  h.edit(RECOVERY);
  assert.equal(h.diagnostics.size, 0);
  assert.match(h.status.text, /Cadence A/);
});

test('a delayed VS Code rejection clears only that document, not the active editor grade', () => {
  const h = vscodeHost();
  h.edit(OVERSIZED, false);
  const other = makeDocument(RECOVERY, 'other.txt');
  h.activateDocument(other);
  const activeText = h.status.text, activeTooltip = h.status.tooltip;
  h.time.flush();
  assert.equal(h.diagnostics.has(h.doc.uri.toString()), false);
  assert.equal(h.status.text, activeText);
  assert.equal(h.status.tooltip, activeTooltip);
  assert.equal(h.status.visible, true);
  h.activateDocument(makeDocument(NORMAL, 'code.js', 'javascript'));
  assert.equal(h.status.visible, false);
  h.activateDocument(undefined);
  assert.equal(h.status.visible, false);
});

test('VS Code does not silently swallow unexpected detector bugs', () => {
  for (const command of [null, 'cadence.scoreDocument', 'cadence.scoreSelection']) {
    const h = vscodeHost();
    h.failure = new TypeError('unexpected detector bug');
    assert.throws(() => command ? h.command(command) : h.edit(RECOVERY), (e) => e === h.failure);
    assert.equal(h.diagnostics.has(h.doc.uri.toString()), false);
    assert.equal(h.status.visible, false);
    assert.equal(h.errors.length, 0);
  }
});

test('PWA score-page assets use the 0.3.0 cache namespace', () => {
  assert.match(read('sw.js'), /const CACHE = 'cadence-v0\.3\.0';/);
});
