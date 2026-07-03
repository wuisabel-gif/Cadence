// Load the deterministic detector into the worker so drafting can score its own
// output and auto-fix it locally (importScripts works in MV3 service workers;
// detector.js has no DOM use and sets globalThis.cadenceAnalyze).
try { importScripts('detector.js'); } catch (e) { /* loop degrades to one-shot */ }

// Right-click a text selection on any page → "Score with Cadence".
// We stash the selection and open the popup, which reads and scores it.
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'cadence-score',
    title: 'Score with Cadence',
    contexts: ['selection'],
  });
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === 'cadence-score' && info.selectionText) {
    chrome.storage.local.set({ pendingText: info.selectionText }, () => {
      // openPopup is available in newer Chrome; if not, the stashed text is
      // picked up the next time the user clicks the toolbar icon.
      if (chrome.action.openPopup) chrome.action.openPopup().catch(() => {});
    });
  }
});

// ─── "Draft in my voice" — the one part that needs a model ────────────────────
// The content script sends the reply context here; we call Claude with the
// user's own key (from options) and their voice sample, and hand back the draft.
// The key lives in the background, never in the page.
const CADENCE_MODEL = 'claude-opus-4-8';
const CADENCE_SYSTEM =
  "You draft replies that read like a real person wrote them, not AI. Follow these laws:\n" +
  "1. Vary sentence length on purpose — a long one, then a short one. Never flatline at one length.\n" +
  "2. No hollow-confidence words (seamless, robust, leverage, powerful, comprehensive).\n" +
  "3. No throat-clearing openers (\"In today's world\", \"It's important to note\", \"When it comes to\"). Start on the real first idea.\n" +
  "4. No template rhetoric: no negation-pivot (\"It's not just X, it's Y\"), no reflexive triads.\n" +
  "5. Plain exact words over decorated vague ones. Contractions and short fragments are fine.\n" +
  "Match the person's own voice. Output ONLY the reply text — no preamble, no quotation marks, no meta commentary.";

// One API round-trip. Returns { text } or { error }.
async function callClaude(apiKey, system, messages) {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ model: CADENCE_MODEL, max_tokens: 1024, system, messages }),
    });
    if (!res.ok) {
      const body = await res.text();
      let msg = 'HTTP ' + res.status;
      try { msg = JSON.parse(body).error.message || msg; } catch (e) { /* keep status */ }
      return { error: msg };
    }
    const data = await res.json();
    const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
    return text ? { text } : { error: 'Empty reply from the model.' };
  } catch (e) {
    return { error: String((e && e.message) || e) };
  }
}

// Turn a detector result into a short, specific correction the model can act on.
function tellSummary(r) {
  const by = {};
  (r.findings || []).forEach((f) => { (by[f.rule] = by[f.rule] || []).push(f.snippet); });
  const parts = Object.keys(by).map((rule) =>
    rule + ' (' + by[rule].slice(0, 3).map((s) => '"' + s + '"').join(', ') + ')');
  if (r.metrics && r.metrics.uniformRhythm) parts.unshift('every sentence the same length');
  return parts.join('; ');
}

// The Cadence method: draft → score locally → if it still reads as AI, tell the
// model exactly which tells to fix and redraft. Keep the best-scoring version.
async function cadenceDraft({ draft, incoming }) {
  const { cadenceApiKey, cadenceVoice } = await chrome.storage.local.get(['cadenceApiKey', 'cadenceVoice']);
  if (!cadenceApiKey) return { error: 'no-key' };

  const system = CADENCE_SYSTEM + (cadenceVoice
    ? '\n\nThis is how the person writes — match its rhythm, diction, and length:\n"""\n' + cadenceVoice + '\n"""'
    : '');
  const parts = [];
  if (incoming) parts.push('The message I am replying to:\n"""\n' + incoming + '\n"""');
  parts.push(draft ? 'My rough notes for the reply:\n"""\n' + draft + '\n"""' : 'I have not written anything yet — draft a natural reply.');
  parts.push('Write my reply now.');

  const analyze = (typeof globalThis !== 'undefined' && globalThis.cadenceAnalyze) || null;
  const messages = [{ role: 'user', content: parts.join('\n\n') }];
  let best = null; // { text, score, grade, rounds }

  for (let round = 0; round < 2; round++) {          // initial draft + at most one fix
    const out = await callClaude(cadenceApiKey, system, messages);
    if (out.error) return best || { error: out.error }; // a fix-call failure keeps the earlier draft
    const r = analyze ? analyze(out.text) : { score: 0, grade: 'A', findings: [], metrics: {} };
    if (!best || r.score < best.score) best = { text: out.text, score: r.score, grade: r.grade, rounds: round + 1 };
    if (!analyze || r.score <= 25) break;             // grade A/B (or no scorer) → done
    messages.push({ role: 'assistant', content: out.text });
    messages.push({ role: 'user', content:
      'That still reads like AI — it scored ' + r.score + '/100. Named tells: ' + tellSummary(r) +
      '. Rewrite the reply so none of those remain. Keep my meaning and my voice, and vary sentence length. Output only the reply.' });
  }
  return best;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'cadenceDraft') { cadenceDraft(msg).then(sendResponse); return true; }
  if (msg && msg.type === 'openOptions') { chrome.runtime.openOptionsPage(); }
});
