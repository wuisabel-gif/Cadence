// AUTO-GENERATED from skills/cadence/scripts/deslop.mjs — do not edit by hand.
// Regenerate with: npm run build:vscode
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

// ─── Tokenizing ─────────────────────────────────────────────────────────────
const ABBREV = new Set([
  'mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'st', 'vs', 'etc', 'e.g',
  'i.e', 'cf', 'al', 'fig', 'no', 'inc', 'ltd', 'co',
]);

function splitSentences(text) {
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
      if (!ABBREV.has(lastWord) && !/^[a-z]\.$/.test(tokens[i].toLowerCase())) {
        out.push(buf.trim());
        buf = '';
      }
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out.filter(Boolean);
}

function words(text) {
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
        findings.push({ rule, severity, snippet: text.slice(at, at + phrase.length) });
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
  // "It's not X, it's Y" / "not just X but Y" — the AI rhetorical seesaw.
  const findings = [];
  const patterns = [
    /\bit'?s not (?:about |just )?[^.,;]{2,40}?[,;.]?\s*it'?s\b/i,
    /\bnot (?:just|only|merely) [^.,;]{2,40}?(?:,|;| but| but rather| but also)\b/i,
    /\bisn'?t (?:about|just) [^.,;]{2,40}?[,;.]?\s*it'?s\b/i,
    /\bthis isn'?t [^.,;]{2,40}?\.\s*(?:this is|it'?s)\b/i,
  ];
  for (const s of sentences) {
    if (patterns.some((p) => p.test(s))) {
      findings.push({ rule: 'negation-pivot', severity: 'med', snippet: s.slice(0, 80) });
    }
  }
  return findings;
}

function detectHedgeStacking(sentences) {
  const findings = [];
  for (const s of sentences) {
    const lower = s.toLowerCase();
    const hits = HEDGES.filter((h) => lower.includes(h));
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
function analyze(text) {
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

  // Uniform rhythm is the single strongest AI tell — flag it only with enough
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
function formatReport(result) {
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

// Strip Markdown scaffolding so the score reflects the prose a reader sees, not
// fenced code, quoted demos, tables, or HTML. Used by --prose-only.
function stripMarkdown(md) {
  const out = [];
  let inFence = false;
  for (const line of md.split('\n')) {
    const s = line.trim();
    if (s.startsWith('```') || s.startsWith('~~~')) { inFence = !inFence; continue; }
    if (inFence) continue;
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
function stripHtml(html) {
  let s = String(html);
  s = s.replace(/<!--[\s\S]*?-->/g, ' ');
  s = s.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ');
  s = s.replace(/<\/(p|div|li|h[1-6]|section|article|header|footer|blockquote|tr|figcaption)\s*>/gi, '\n');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<[^>]+>/g, ' ');
  s = s.replace(/&(amp|lt|gt|quot|#39|apos|nbsp|mdash|ndash|hellip|rsquo|lsquo|ldquo|rdquo|middot);/g, (m) => ENTITIES[m] ?? ' ');
  s = s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
  s = s.replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
  return s.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

module.exports = { analyze, formatReport, stripMarkdown, stripHtml, splitSentences, words };
