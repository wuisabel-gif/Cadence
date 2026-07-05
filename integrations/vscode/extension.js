// Cadence: the AI-slop detector, in your editor.
//
// The detector itself lives in ./detector.js, generated from the one source
// (skills/cadence/scripts/deslop.mjs) so it can never drift. This file is just
// the VS Code glue: a status-bar grade, inline diagnostics, and two commands.
const vscode = require('vscode');
const { analyze, formatReport, stripMarkdown, stripHtml } = require('./detector.js');

// One human-readable line per rule the detector can name.
const RULE_LABEL = {
  'banned-phrase': 'AI cliché phrase, almost never survives a human editor',
  'hollow-confidence': 'Hollow-confidence word, asserts quality instead of showing it',
  'triad': 'Reflexive triad ("A, B, and C"), fine once, a tell in bulk',
  'negation-pivot': 'Negation pivot ("not X, it\'s Y"), the AI rhetorical seesaw',
  'hedge-stack': 'Stacked hedges, two or more qualifiers draining one sentence',
  'cliche-opener': 'Templated opener, signals a generated structure',
};

const SEVERITY = {
  high: vscode.DiagnosticSeverity.Warning,
  med: vscode.DiagnosticSeverity.Information,
  low: vscode.DiagnosticSeverity.Hint,
};

function cfg() { return vscode.workspace.getConfiguration('cadence'); }

function isSupported(doc) {
  if (!doc || (doc.uri.scheme !== 'file' && doc.uri.scheme !== 'untitled')) return false;
  return cfg().get('languages', []).includes(doc.languageId);
}

// What text to score: optionally strip Markdown/HTML scaffolding first.
function scoringText(doc) {
  const text = doc.getText();
  if (!cfg().get('proseOnly', false)) return text;
  const id = doc.languageId;
  if (id === 'markdown' || id === 'mdx' || id === 'quarto' || id === 'rmd') return stripMarkdown(text);
  if (id === 'html' || id === 'xml') return stripHtml(text);
  return text;
}

// Find every occurrence of a finding's snippet in the original document so we can
// squiggle it. Snippets from sentence-level rules come from whitespace-collapsed
// text, so we match whitespace flexibly and cap the run to avoid runaway regexes.
function rangesFor(doc, snippet) {
  const trimmed = (snippet || '').trim();
  if (trimmed.length < 3) return [];
  const pattern = trimmed
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\s+/g, '\\s+');
  let re;
  try { re = new RegExp(pattern, 'gi'); } catch { return []; }
  const text = doc.getText();
  const ranges = [];
  let m;
  while ((m = re.exec(text)) && ranges.length < 50) {
    if (m.index === re.lastIndex) re.lastIndex++; // guard against zero-width
    ranges.push(new vscode.Range(doc.positionAt(m.index), doc.positionAt(m.index + m[0].length)));
  }
  return ranges;
}

function buildDiagnostics(doc, result) {
  const diags = [];
  const seen = new Set();
  for (const f of result.findings) {
    for (const range of rangesFor(doc, f.snippet)) {
      const key = `${range.start.line}:${range.start.character}:${f.rule}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const d = new vscode.Diagnostic(range, RULE_LABEL[f.rule] || f.rule, SEVERITY[f.severity] ?? vscode.DiagnosticSeverity.Hint);
      d.source = 'Cadence';
      d.code = f.rule;
      diags.push(d);
    }
  }
  return diags;
}

function activate(context) {
  const diagnostics = vscode.languages.createDiagnosticCollection('cadence');
  const output = vscode.window.createOutputChannel('Cadence');
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  status.command = 'cadence.scoreDocument';
  context.subscriptions.push(diagnostics, output, status);

  const timers = new Map();

  function refresh(doc) {
    if (!doc) return;
    const supported = isSupported(doc);

    // Diagnostics
    if (supported && cfg().get('diagnostics.enabled', true)) {
      const result = analyze(scoringText(doc));
      diagnostics.set(doc.uri, buildDiagnostics(doc, result));
    } else {
      diagnostics.delete(doc.uri);
    }

    // Status bar (only for the document showing in the active editor)
    const active = vscode.window.activeTextEditor;
    if (!cfg().get('statusBar.enabled', true) || !active || active.document.uri.toString() !== doc.uri.toString() || !supported) {
      if (active && active.document.uri.toString() === doc.uri.toString() && !supported) status.hide();
      return;
    }
    const r = analyze(scoringText(doc));
    const m = r.metrics;
    status.text = `$(pencil) Cadence ${r.grade}·${r.score}`;
    status.tooltip = new vscode.MarkdownString(
      `**Cadence de-slop**: score \`${r.score}/100\`, grade \`${r.grade}\`\n\n` +
      `words ${m.words} · sentences ${m.sentences} · avg len ${m.avgSentenceLength}\n\n` +
      `rhythm CV ${m.sentenceLengthCV}${m.uniformRhythm ? ' ⚠ too uniform' : ''} · ` +
      `${r.findings.length} tell${r.findings.length === 1 ? '' : 's'}\n\n_Click for the full report._`
    );
    status.backgroundColor = (r.grade === 'D' || r.grade === 'F')
      ? new vscode.ThemeColor('statusBarItem.warningBackground')
      : undefined;
    status.show();
  }

  function refreshActive() {
    const ed = vscode.window.activeTextEditor;
    if (ed) refresh(ed.document); else status.hide();
  }

  function schedule(doc) {
    const key = doc.uri.toString();
    clearTimeout(timers.get(key));
    timers.set(key, setTimeout(() => { timers.delete(key); refresh(doc); }, 350));
  }

  // ── Commands ──────────────────────────────────────────────────────────────
  function report(title, text) {
    const result = analyze(text);
    output.clear();
    output.appendLine(title);
    output.appendLine('');
    output.appendLine(formatReport(result));
    output.show(true);
    vscode.window.setStatusBarMessage(`Cadence: ${result.grade} · ${result.score}/100 · ${result.findings.length} tells`, 4000);
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('cadence.scoreDocument', () => {
      const ed = vscode.window.activeTextEditor;
      if (!ed) { vscode.window.showInformationMessage('Cadence: open a file to score.'); return; }
      report(`${ed.document.fileName || 'document'} (whole document)`, scoringText(ed.document));
    }),
    vscode.commands.registerCommand('cadence.scoreSelection', () => {
      const ed = vscode.window.activeTextEditor;
      if (!ed) { vscode.window.showInformationMessage('Cadence: open a file to score.'); return; }
      const sel = ed.document.getText(ed.selection);
      if (!sel.trim()) { vscode.window.showInformationMessage('Cadence: select some text first.'); return; }
      report(`${ed.document.fileName || 'document'} (selection)`, sel);
    }),
  );

  // ── Live updates ────────────────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(refreshActive),
    vscode.workspace.onDidChangeTextDocument((e) => {
      const ed = vscode.window.activeTextEditor;
      if (ed && e.document.uri.toString() === ed.document.uri.toString()) schedule(e.document);
    }),
    vscode.workspace.onDidCloseTextDocument((doc) => diagnostics.delete(doc.uri)),
    vscode.workspace.onDidChangeConfiguration((e) => { if (e.affectsConfiguration('cadence')) refreshActive(); }),
  );

  refreshActive();
}

function deactivate() {}

module.exports = { activate, deactivate };
