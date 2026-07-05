#!/usr/bin/env node
/**
 * Cadence de-slop detector.
 *
 * Deterministic prose analysis: given text, it finds the structural and lexical
 * tells of generic AI writing and reports them with a transparent score. No LLM,
 * no network. Pure functions over the text so the same input always scores the
 * same. The skill's /deslop, /critique, and /write commands all read these
 * numbers instead of guessing.
 *
 * Usage:
 *   node deslop.mjs <file>           human report
 *   node deslop.mjs --json <file>    machine-readable JSON
 *   cat draft.txt | node deslop.mjs  read from stdin
 *
 * Exit code is 0 unless --strict is passed and the slop score exceeds the
 * threshold (default 25), so it can gate a writing pipeline.
 */

import { readFileSync, realpathSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { relative, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { extractPdf, extractDocx, extractEpub, fetchUrl, looksReadable } from './extract-text.mjs';

// ─── Lexical rules ──────────────────────────────────────────────────────────
// Phrases that almost never survive a human editor. Each hit is one finding.
const BANNED_PHRASES = [
  'in today\'s world', 'in today\'s fast-paced', 'in the modern world',
  'gone are the days', 'when it comes to', 'at the end of the day',
  'let\'s dive in', 'let\'s delve', 'dive deep', 'in conclusion',
  'in summary', 'it is important to note', 'it\'s worth noting',
  'needless to say', 'last but not least', 'first and foremost',
  'the world of', 'navigate the', 'navigating the', 'unlock the',
  'unleash the', 'harness the power', 'take it to the next level',
  'a testament to', 'plays a crucial role', 'plays a vital role',
  'plays a pivotal role', 'in the realm of', 'ever-evolving',
  'ever-changing', 'fast-paced world', 'digital age', 'game-changer',
  'tapestry', 'rich tapestry', 'whether you\'re', 'look no further',
];

// Confidence words that assert quality instead of showing it.
const HOLLOW_CONFIDENCE = [
  'seamless', 'seamlessly', 'robust', 'powerful', 'comprehensive',
  'cutting-edge', 'state-of-the-art', 'revolutionary', 'groundbreaking',
  'innovative', 'world-class', 'best-in-class', 'unparalleled',
  'leverage', 'leveraging', 'elevate', 'empower', 'streamline',
  'optimize', 'holistic', 'synergy', 'paradigm', 'transformative',
  'delve', 'underscore', 'pivotal', 'myriad', 'plethora', 'bustling',
  'meticulous', 'meticulously', 'vibrant', 'crucial', 'vital',
];

// Sentence openers that signal templated structure.
const CLICHE_OPENERS = [
  'in today', 'imagine a world', 'picture this', 'in conclusion',
  'in summary', 'to sum up', 'when it comes to', 'at the end of the day',
  'in the world of', 'in the realm of', 'as we', 'in this article',
  'in this guide', 'let\'s', 'firstly', 'secondly', 'thirdly', 'moreover',
  'furthermore', 'additionally', 'overall',
];

const HEDGES = [
  'perhaps', 'might', 'maybe', 'arguably', 'somewhat', 'generally',
  'typically', 'often', 'usually', 'fairly', 'relatively', 'possibly',
  'seemingly', 'kind of', 'sort of', 'in some ways', 'to some extent',
  'it could be argued', 'one could say',
];

// Word-boundary matchers so "usually" inside "unusually" (or "might" inside
// "mighty", "often" inside "soften") doesn't register as a hedge.
const HEDGE_RES = HEDGES.map((h) => new RegExp(`\\b${h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`));

// ─── Tokenizing ─────────────────────────────────────────────────────────────
const ABBREV = new Set([
  'mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'st', 'vs', 'etc', 'e.g',
  'i.e', 'cf', 'al', 'fig', 'no', 'inc', 'ltd', 'co',
]);

// Fold typographic quotes to ASCII so the phrase and regex detectors match
// real-world prose. Curly apostrophes from the web, Word, and Substack would
// otherwise slip every "it's"/"whether you're" rule. A 1:1 char swap, so snippet
// offsets stay aligned with the original text.
export function normalizeQuotes(text) {
  return text.replace(/[‘’‛ʼ]/g, "'").replace(/[“”]/g, '"');
}

export function splitSentences(text) {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  const out = [];
  let buf = '';
  const tokens = cleaned.split(/(\s+)/);
  for (let i = 0; i < tokens.length; i++) {
    buf += tokens[i];
    const m = tokens[i].match(/([.!?]+)["')\]]?$/);
    if (m) {
      const word = tokens[i].replace(/[.!?"')\]]+$/, '').toLowerCase();
      const lastWord = word.split(/[^a-z.]/).pop();
      // A dotted initialism (U.S., p.m.) ends a sentence only when the next word
      // is capitalized: "U.S. economy" stays joined, "5 p.m. He" splits. Known
      // abbreviations and titles (Dr., e.g.) never end one.
      const isInitialism = /^[a-z](?:\.[a-z])*\.?["')\]]*$/.test(tokens[i].toLowerCase());
      let nextWord = '';
      for (let j = i + 1; j < tokens.length; j++) { if (tokens[j].trim()) { nextWord = tokens[j]; break; } }
      const nextIsCapital = /^["'(\[]*[A-Z]/.test(nextWord);
      const terminal = ABBREV.has(lastWord) ? false : isInitialism ? nextIsCapital : true;
      if (terminal) {
        out.push(buf.trim());
        buf = '';
      }
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out.filter(Boolean);
}

export function words(text) {
  return (text.toLowerCase().match(/[a-z][a-z'’-]*/g) || []);
}

// ─── Metrics ────────────────────────────────────────────────────────────────
function mean(xs) { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0; }
function stddev(xs) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

// ─── Detectors ──────────────────────────────────────────────────────────────
function findPhrases(text, list, rule, severity) {
  const findings = [];
  const lower = text.toLowerCase();
  for (const phrase of list) {
    let from = 0;
    while (true) {
      const at = lower.indexOf(phrase, from);
      if (at === -1) break;
      // word-boundary-ish guard so "co" doesn't match inside "coffee"
      const before = at === 0 ? ' ' : lower[at - 1];
      const after = lower[at + phrase.length] ?? ' ';
      if (/[^a-z']/.test(before) && /[^a-z']/.test(after)) {
        findings.push({ rule, severity, snippet: text.slice(at, at + phrase.length), start: at, end: at + phrase.length });
      }
      from = at + phrase.length;
    }
  }
  return findings;
}

function detectTriads(sentences) {
  // "A, B, and C" three-item lists. Light use is fine; density is the tell.
  const findings = [];
  const re = /\b[\w'’-]+,\s+[\w'’-]+,\s+(?:and|or)\s+[\w'’-]+/gi;
  for (const s of sentences) {
    const m = s.match(re);
    if (m) m.forEach((hit) => findings.push({ rule: 'triad', severity: 'low', snippet: hit }));
  }
  return findings;
}

function detectNegationPivot(sentences) {
  // "It's not X, it's Y" / "not just X but Y": the AI rhetorical seesaw.
  const findings = [];
  const patterns = [
    /\bit'?s not (?:about |just )?[^.,;]{2,40}?[,;.]?\s*it'?s\b/i,
    /\bnot (?:just|only|merely) [^.,;]{2,40}?(?:,|;| but| but rather| but also)\b/i,
    /\bisn'?t (?:about|just) [^.,;]{2,40}?[,;.]?\s*it'?s\b/i,
    /\bthis isn'?t [^.,;]{2,40}?\.\s*(?:this is|it'?s)\b/i,
    // Contraction seesaw: "we don't just build X; we build Y", "doesn't just do X, it Y".
    /\b(?:do|does|did|is|was|are|were|ca|wo|would|could|should)n'?t (?:just|only|merely) [^.,;]{2,40}?[,;]/i,
  ];
  for (const s of sentences) {
    if (patterns.some((p) => p.test(s))) {
      findings.push({ rule: 'negation-pivot', severity: 'high', snippet: s.slice(0, 80) });
    }
  }
  return findings;
}

function detectHedgeStacking(sentences) {
  const findings = [];
  for (const s of sentences) {
    const lower = s.toLowerCase();
    const hits = HEDGE_RES.filter((re) => re.test(lower));
    if (hits.length >= 2) {
      findings.push({ rule: 'hedge-stack', severity: 'low', snippet: s.slice(0, 80) });
    }
  }
  return findings;
}

function detectClicheOpeners(sentences) {
  const findings = [];
  for (const s of sentences) {
    const lower = s.toLowerCase().trimStart();
    for (const opener of CLICHE_OPENERS) {
      if (lower.startsWith(opener + ' ') || lower.startsWith(opener + ',')) {
        findings.push({ rule: 'cliche-opener', severity: 'low', snippet: s.slice(0, 50) });
        break;
      }
    }
  }
  return findings;
}

// ─── Main analysis ──────────────────────────────────────────────────────────
export function analyze(rawText) {
  // Normalize typographic quotes once, before any detector runs, so curly-quote
  // prose (and stripHtml's decoded &rsquo;) matches the same rules as ASCII text.
  const text = normalizeQuotes(rawText);
  const sentences = splitSentences(text);
  const allWords = words(text);
  const wordCount = allWords.length;
  const lengths = sentences.map((s) => words(s).length).filter((n) => n > 0);

  const avgLen = mean(lengths);
  const sd = stddev(lengths);
  // Coefficient of variation: how much sentence length varies. Human prose
  // swings (a 30-word sentence next to a 4-word one); AI prose clusters.
  const lengthCV = avgLen ? sd / avgLen : 0;

  const adverbs = allWords.filter((w) => w.endsWith('ly') && w.length > 4);
  const emDashes = (text.match(/—|--|&mdash;/g) || []).length;

  const findings = [
    ...findPhrases(text, BANNED_PHRASES, 'banned-phrase', 'high'),
    ...findPhrases(text, HOLLOW_CONFIDENCE, 'hollow-confidence', 'med'),
    ...detectTriads(sentences),
    ...detectNegationPivot(sentences),
    ...detectHedgeStacking(sentences),
    ...detectClicheOpeners(sentences),
  ];

  // Rate-based structural tells, scaled per 100 words.
  const per100 = (n) => (wordCount ? (n / wordCount) * 100 : 0);
  const adverbRate = per100(adverbs.length);
  const emDashRate = per100(emDashes);
  const triadDensity = sentences.length ? findings.filter((f) => f.rule === 'triad').length / sentences.length : 0;

  // Uniform rhythm is the single strongest AI tell. Flag it only with enough
  // sentences to be meaningful.
  const uniformRhythm = sentences.length >= 5 && lengthCV < 0.4;

  // ── Transparent score: 0 (clean) … 100 (heavy slop) ──
  let score = 0;
  for (const f of findings) {
    score += f.severity === 'high' ? 6 : f.severity === 'med' ? 4 : 2;
  }
  if (uniformRhythm) score += Math.round((0.4 - lengthCV) * 60); // up to +24
  if (adverbRate > 5) score += Math.round((adverbRate - 5) * 2);
  if (emDashRate > 2.5) score += Math.round((emDashRate - 2.5) * 3);
  if (triadDensity > 0.25) score += Math.round((triadDensity - 0.25) * 40);
  score = Math.max(0, Math.min(100, Math.round(score)));

  const grade = score <= 10 ? 'A' : score <= 25 ? 'B' : score <= 45 ? 'C' : score <= 70 ? 'D' : 'F';

  return {
    score,
    grade,
    metrics: {
      words: wordCount,
      sentences: sentences.length,
      avgSentenceLength: +avgLen.toFixed(1),
      sentenceLengthCV: +lengthCV.toFixed(2),
      uniformRhythm,
      adverbRate: +adverbRate.toFixed(1),
      emDashRate: +emDashRate.toFixed(1),
      triadDensity: +triadDensity.toFixed(2),
    },
    findings,
  };
}

// ─── Report formatting ──────────────────────────────────────────────────────
export function formatReport(result) {
  const { score, grade, metrics, findings } = result;
  const lines = [];
  lines.push(`Cadence de-slop  ·  score ${score}/100  ·  grade ${grade}`);
  lines.push('─'.repeat(46));
  lines.push(`words ${metrics.words}   sentences ${metrics.sentences}   avg len ${metrics.avgSentenceLength}`);
  lines.push(`rhythm variance (CV) ${metrics.sentenceLengthCV}${metrics.uniformRhythm ? '  ⚠ too uniform' : '  ok'}`);
  lines.push(`adverb rate ${metrics.adverbRate}/100   em-dash rate ${metrics.emDashRate}/100   triad density ${metrics.triadDensity}`);
  lines.push('');
  if (!findings.length) {
    lines.push('No lexical tells found.');
  } else {
    const byRule = {};
    for (const f of findings) (byRule[f.rule] ||= []).push(f.snippet);
    lines.push(`${findings.length} finding${findings.length === 1 ? '' : 's'}:`);
    for (const [rule, snips] of Object.entries(byRule)) {
      const shown = snips.slice(0, 6).map((s) => `"${s}"`).join(', ');
      const more = snips.length > 6 ? ` …+${snips.length - 6}` : '';
      lines.push(`  ${rule} (${snips.length}): ${shown}${more}`);
    }
  }
  return lines.join('\n');
}

// Score each blank-line-separated paragraph on its own so a heatmap (CLI or UI)
// can show *which* block drags the document down, not just that it does. Reuses
// analyze, so a block's number matches what the whole-document score would give
// that text. Rhythm CV is weak on a one-sentence block; the lexical tells carry.
export function analyzeParagraphs(text) {
  const out = [];
  let index = 0;
  for (const raw of String(text).split(/\n[ \t]*\n/)) {
    const block = raw.trim();
    if (!block) continue;
    const r = analyze(block);
    if (!r.metrics.words) continue;
    out.push({
      index: index++,
      snippet: block.replace(/\s+/g, ' ').slice(0, 80),
      words: r.metrics.words,
      score: r.score,
      grade: r.grade,
      findings: r.findings,
    });
  }
  return out;
}

// Strip Markdown scaffolding so the score reflects the prose a reader sees, not
// fenced code, quoted demos, tables, or HTML. Used by --prose-only.
export function stripMarkdown(md) {
  const out = [];
  let fence = null; // the marker that opened the current fence: '```' or '~~~'
  for (const line of md.split('\n')) {
    const s = line.trim();
    const marker = s.startsWith('```') ? '```' : s.startsWith('~~~') ? '~~~' : null;
    if (marker) {
      if (!fence) fence = marker;              // open
      else if (fence === marker) fence = null; // close only on the matching marker
      continue;
    }
    if (fence) continue;
    if (s.startsWith('>') || s.startsWith('|') || s.startsWith('#') || s.startsWith('<')) continue;
    out.push(line.replace(/<[^>]+>/g, '')); // strip inline HTML tags
  }
  return out.join('\n');
}

// Strip an HTML document to its visible text: drop <script>/<style>/comments,
// turn block-element ends into line breaks so sentences don't merge, remove the
// remaining tags, and decode common entities. Used by --html / .html files.
const ENTITIES = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'",
  '&apos;': "'", '&nbsp;': ' ', '&mdash;': '—', '&ndash;': '–', '&hellip;': '…',
  '&rsquo;': '’', '&lsquo;': '‘', '&ldquo;': '“', '&rdquo;': '”', '&middot;': '·',
};
// Decode a numeric character reference safely. Out-of-range code points (bad
// input) yield nothing instead of throwing, and astral chars (emoji, U+1xxxx)
// decode whole instead of splitting into lone surrogates.
const codePoint = (n) => (Number.isInteger(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '');
export function stripHtml(html) {
  let s = String(html);
  s = s.replace(/<!--[\s\S]*?-->/g, ' ');
  s = s.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ');
  s = s.replace(/<\/(p|div|li|h[1-6]|section|article|header|footer|blockquote|tr|figcaption)\s*>/gi, '\n');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<[^>]+>/g, ' ');
  s = s.replace(/&(amp|lt|gt|quot|#39|apos|nbsp|mdash|ndash|hellip|rsquo|lsquo|ldquo|rdquo|middot);/g, (m) => ENTITIES[m] ?? ' ');
  s = s.replace(/&#(\d+);/g, (_, n) => codePoint(Number(n)));
  s = s.replace(/&#x([0-9a-f]+);/gi, (_, n) => codePoint(parseInt(n, 16)));
  return s.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

// ─── repo / directory scan ──────────────────────────────────────────────────
const SCAN_EXTS = new Set(['.md', '.markdown', '.mdx', '.txt', '.html', '.htm', '.rst']);
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'out', 'target', 'vendor', 'coverage', '.next', '.cache']);

function extLower(name) { const i = name.lastIndexOf('.'); return i < 0 ? '' : name.slice(i).toLowerCase(); }

function walk(dir, found = []) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return found; }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name.startsWith('.') || SKIP_DIRS.has(e.name)) continue;
      walk(full, found);
    } else if (SCAN_EXTS.has(extLower(e.name))) {
      found.push(full);
    }
  }
  return found;
}

// Read one prose file as text, applying the right strip for its type.
function loadFileText(path) {
  const raw = readFileSync(path, 'utf8');
  const lower = path.toLowerCase();
  if (/\.html?$/.test(lower)) return stripHtml(raw);
  if (/\.(md|markdown|mdx)$/.test(lower)) return stripMarkdown(raw);
  return raw;
}

// Score every prose file under a directory; returns rows sorted worst-first.
export function scanDir(dir) {
  const rows = [];
  for (const f of walk(dir)) {
    let text;
    try { text = loadFileText(f); } catch { continue; }
    if (text == null || text.replace(/\s/g, '').length < 20) continue;
    const r = analyze(text);
    rows.push({ file: relative(dir, f) || f, score: r.score, grade: r.grade });
  }
  return rows.sort((a, b) => b.score - a.score);
}

// Print a table of {file, score, grade} rows (or JSON) and apply the score gate.
function reportRows(rows, header, args) {
  if (args.includes('--json')) {
    process.stdout.write(JSON.stringify(rows, null, 2) + '\n');
  } else {
    const lines = [header, '─'.repeat(52)];
    for (const r of rows) lines.push(`  ${r.grade}  ${String(r.score).padStart(3)}   ${r.file}`);
    const avg = Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length);
    lines.push('─'.repeat(52));
    lines.push(`  ${rows.length} files   ·   avg ${avg}   ·   worst ${rows[0].score} (${rows[0].file})`);
    process.stdout.write(lines.join('\n') + '\n');
  }
  const max = resolveMax(args);
  if (max !== null && rows.some((r) => r.score > max)) process.exit(1);
}

function runScan(dir, args) {
  const rows = scanDir(dir);
  if (!rows.length) {
    process.stderr.write(`No prose files (.md, .txt, .html, …) found in ${dir}\n`);
    process.exit(0);
  }
  reportRows(rows, `Cadence de-slop  ·  ${rows.length} files in ${dir}  (worst first)`, args);
}

// ─── diff mode (--diff) ──────────────────────────────────────────────────────
// Parse a unified diff and return the added prose per file, so a CI gate scores
// only what a change introduces, not the legacy files it happens to touch.
// Pure (no git), so it's testable; runDiff feeds it real `git diff` output.
export function addedProseByFile(diffText) {
  const byFile = new Map();
  let cur = null;
  for (const line of diffText.split('\n')) {
    if (line.startsWith('+++ ')) {
      const p = line.slice(4).replace(/^b\//, '').replace(/\t.*$/, '').trim();
      cur = (p !== '/dev/null' && SCAN_EXTS.has(extLower(p))) ? p : null;
      continue;
    }
    if (cur && line.startsWith('+') && !line.startsWith('+++')) {
      byFile.set(cur, (byFile.get(cur) || '') + line.slice(1) + '\n');
    }
  }
  return byFile;
}

function runDiff(args, ref) {
  let raw;
  try {
    // -U0: added/removed lines only, no surrounding context to mistake for new prose.
    raw = execFileSync('git', ['diff', '--unified=0', ref], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch (e) {
    process.stderr.write(`git diff ${ref} failed: ${e.message.split('\n')[0]}\n`);
    process.exit(3);
  }
  const rows = [];
  for (const [file, text] of addedProseByFile(raw)) {
    // ponytail: fragments out of context, so rhythm CV is weak here; the lexical
    // tells (banned phrases, hollow words) are what diff mode is really for.
    if (text.replace(/\s/g, '').length < 20) continue;
    const r = analyze(text);
    rows.push({ file, score: r.score, grade: r.grade });
  }
  rows.sort((a, b) => b.score - a.score);
  if (!rows.length) {
    process.stderr.write(`No added prose to score in the diff against ${ref}.\n`);
    process.exit(0);
  }
  reportRows(rows, `Cadence de-slop  ·  added prose vs ${ref}  (worst first)`, args);
}

// ─── mechanical fixes (--fix) ───────────────────────────────────────────────
// Only edits that can't change meaning or grammar: part-of-speech-preserving
// word swaps, plus deletions of content-free throat-clears. Rewrites that need
// judgment (triads, negation pivots, most banned phrases) stay findings.
// Keys are lowercase; '' means delete the phrase.
const FIXES = {
  seamless: 'smooth', seamlessly: 'smoothly', robust: 'solid', powerful: 'strong',
  comprehensive: 'complete', 'cutting-edge': 'new', 'state-of-the-art': 'advanced',
  revolutionary: 'new', groundbreaking: 'new', innovative: 'new',
  leverage: 'use', leveraging: 'using', elevate: 'raise', streamline: 'simplify',
  optimize: 'improve', myriad: 'many', plethora: 'many', meticulous: 'careful',
  meticulously: 'carefully', vibrant: 'lively', bustling: 'busy', crucial: 'key',
  vital: 'key', pivotal: 'key', delve: 'dig', underscore: 'highlight',
  "in today's world": '', 'in the modern world': '', 'it is important to note': '',
  "it's worth noting": '', 'needless to say': '', 'first and foremost': '',
  'last but not least': '', 'in conclusion': '', 'in summary': '',
};

function matchCase(original, repl) {
  return repl && /^[A-Z]/.test(original) ? repl[0].toUpperCase() + repl.slice(1) : repl;
}

// Apply the mechanical subset of fixes to `text` using finding offsets, working
// right-to-left so earlier offsets stay valid. Offsets index the normalized
// text, but normalizeQuotes is a 1:1 swap, so they're valid on the raw text too
// (which lets us preserve the user's curly quotes everywhere we didn't touch).
export function applyFixes(text, findings) {
  const fixable = findings
    .filter((f) => f.start != null && f.snippet && FIXES[f.snippet.toLowerCase()] != null)
    .sort((a, b) => b.start - a.start);
  let out = text;
  let applied = 0;
  for (const f of fixable) {
    const repl = FIXES[f.snippet.toLowerCase()];
    let end = f.end;
    if (repl === '') {
      // swallow the ", " or " that " a deleted throat-clear leaves behind
      const m = out.slice(end).match(/^\s*,?\s*(?:that\s+)?/i);
      if (m) end += m[0].length;
    }
    out = out.slice(0, f.start) + matchCase(out.slice(f.start, f.end), repl) + out.slice(end);
    applied++;
  }
  out = out
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+([,.;:!?])/g, '$1')          // no space before punctuation
    .replace(/^[\s,;]+/, '')                       // no leading comma from a deleted opener
    .replace(/(^|[.!?]\s+)([a-z])/g, (_, pre, c) => pre + c.toUpperCase()); // recapitalize
  return { text: out, applied, skipped: findings.length - applied };
}

function formatParagraphs(rows) {
  const lines = [`Cadence de-slop  ·  ${rows.length} paragraph${rows.length === 1 ? '' : 's'}  (worst first)`, '─'.repeat(52)];
  for (const p of [...rows].sort((a, b) => b.score - a.score)) {
    const tells = p.findings.length ? [...new Set(p.findings.map((f) => f.rule))].slice(0, 4).join(', ') : 'clean';
    const cut = p.snippet.length >= 80 ? '…' : '';
    lines.push(`  ${p.grade}  ${String(p.score).padStart(3)}   ¶${p.index + 1}  “${p.snippet}${cut}”  · ${p.words}w · ${tells}`);
  }
  return lines.join('\n');
}

// ─── CLI ────────────────────────────────────────────────────────────────────
const HELP = `cadence-deslop: score prose for AI tells (0 clean … 100 slop)

Usage
  cadence-deslop <file>            human-readable report
  cadence-deslop <dir>             scan a folder/repo, ranked worst-first
  cadence-deslop --json <file>     machine-readable JSON
  cat draft.txt | cadence-deslop   read from stdin
  cadence-deslop --strict <file>   exit 1 when score > 25 (CI gate)
  cadence-deslop --fix <file>      rewrite the mechanical tells, print fixed text
  cadence-deslop --diff [ref]      score only prose added vs ref (default HEAD)
  cadence-deslop --paragraphs <f>  score each paragraph: which block is the problem

Options
  --html         score the visible text of an HTML file (auto-detected for .html)
  --prose-only   score Markdown prose only (skip code, quotes, tables, HTML)
  --paragraphs   score each blank-line-separated paragraph on its own, worst
                 first, so you can see which block drags the score; pairs with
                 --json/--max
  --diff [ref]   score only the prose a change adds (git diff vs ref, default
                 HEAD) so a CI gate ignores legacy files; pairs with --max/--json
  --fix          rewrite the safe, mechanical tells (word swaps + throat-clear
                 deletions) to stdout; a summary and before/after score to stderr
  --json         output JSON instead of the report
  --strict       non-zero exit when the score exceeds 25
  --max <n>      non-zero exit when the score exceeds n (overrides --strict)
  -h, --help     show this help
  -v, --version  print the version
`;

// Resolve the score ceiling from flags. An explicit --max with a missing or
// non-numeric value is a hard error (exit 2), never a silently-disabled gate.
function resolveMax(args) {
  const i = args.indexOf('--max');
  if (i >= 0) {
    const v = Number(args[i + 1]);
    if (!Number.isFinite(v)) {
      process.stderr.write(`--max needs a number (got: ${args[i + 1] ?? '(nothing)'})\n`);
      process.exit(2);
    }
    return v;
  }
  return args.includes('--strict') ? 25 : null;
}

function version() {
  try {
    return JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8')).version;
  } catch { return '0.0.0'; }
}

// True only when this file is the program entry point. Comparing resolved real
// paths makes it survive the bin symlink that `npx cadence-deslop` runs through.
function isMain() {
  if (!process.argv[1]) return false;
  try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
}

async function readStdin() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

if (isMain()) {
  const args = process.argv.slice(2);
  if (args.includes('-h') || args.includes('--help')) { process.stdout.write(HELP); process.exit(0); }
  if (args.includes('-v') || args.includes('--version')) { process.stdout.write(version() + '\n'); process.exit(0); }

  if (args.includes('--diff')) {
    const next = args[args.indexOf('--diff') + 1];
    runDiff(args, next && !next.startsWith('-') ? next : 'HEAD');
    process.exit(0);
  }

  // positional file = first non-flag token, skipping the value after --max
  const positionals = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--max') { i++; continue; }
    if (args[i].startsWith('-')) continue;
    positionals.push(args[i]);
  }
  const file = positionals[0];
  if (file && !/^https?:\/\//i.test(file) && existsSync(file) && statSync(file).isDirectory()) {
    runScan(file, args);
    process.exit(0);
  }
  if (!file && process.stdin.isTTY) { process.stdout.write(HELP); process.exit(0); }

  let text;
  if (!file) {
    text = await readStdin();
    if (args.includes('--html')) text = stripHtml(text);
    else if (args.includes('--prose-only')) text = stripMarkdown(text);
  } else if (/^https?:\/\//i.test(file)) {
    try { text = await fetchUrl(file); }
    catch (e) { process.stderr.write(`Could not fetch ${file}: ${e.message}\n`); process.exit(3); }
  } else {
    const lower = file.toLowerCase();
    if (/\.(pdf|docx|epub)$/.test(lower)) {
      const buf = readFileSync(file);
      try {
        text = lower.endsWith('.pdf') ? extractPdf(buf) : lower.endsWith('.epub') ? extractEpub(buf) : extractDocx(buf);
      } catch { text = ''; } // corrupt/truncated archive → fall through to the friendly error
      if (!text || text.replace(/\s/g, '').length < 20 || (lower.endsWith('.pdf') && !looksReadable(text))) {
        process.stderr.write('Could not extract readable text from that file. Convert it to .txt and try again.\n');
        process.exit(3);
      }
    } else {
      text = readFileSync(file, 'utf8');
      if (args.includes('--html') || /\.html?$/i.test(lower)) text = stripHtml(text);
      else if (args.includes('--prose-only')) text = stripMarkdown(text);
    }
  }

  const result = analyze(text);

  if (args.includes('--paragraphs')) {
    const rows = analyzeParagraphs(text);
    if (!rows.length) { process.stderr.write('No paragraphs to score.\n'); process.exit(0); }
    process.stdout.write((args.includes('--json') ? JSON.stringify(rows, null, 2) : formatParagraphs(rows)) + '\n');
    const max = resolveMax(args);
    if (max !== null && rows.some((p) => p.score > max)) process.exit(1);
    process.exit(0);
  }

  if (args.includes('--fix')) {
    const fixed = applyFixes(text, result.findings);
    const after = analyze(fixed.text);
    process.stderr.write(
      `cadence --fix: ${fixed.applied} auto-fixed, ${result.findings.length - fixed.applied} need manual attention` +
      `  ·  score ${result.score} → ${after.score}\n`);
    process.stdout.write(fixed.text.endsWith('\n') ? fixed.text : fixed.text + '\n');
    process.exit(0);
  }

  process.stdout.write((args.includes('--json') ? JSON.stringify(result, null, 2) : formatReport(result)) + '\n');

  const maxScore = resolveMax(args);
  if (maxScore !== null && result.score > maxScore) process.exit(1);
}
