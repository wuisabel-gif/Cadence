const input = document.getElementById('input');
const readout = document.getElementById('readout');
const scoreEl = document.getElementById('score');
const gradeEl = document.getElementById('grade');
const metricsEl = document.getElementById('metrics');
const findingsEl = document.getElementById('findings');
const heatmapEl = document.getElementById('heatmap');

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function render(text) {
  if (!text.trim()) {
    readout.classList.add('empty');
    readout.dataset.grade = '';
    scoreEl.textContent = '·';
    gradeEl.textContent = '';
    metricsEl.textContent = '';
    findingsEl.innerHTML = '';
    heatmapEl.innerHTML = '';
    return;
  }
  const r = window.cadenceAnalyze(text);
  readout.classList.remove('empty');
  readout.dataset.grade = r.grade;
  scoreEl.textContent = r.score;
  gradeEl.textContent = 'grade ' + r.grade;
  const m = r.metrics;
  metricsEl.textContent = `${m.words} words · ${m.sentences} sentences · rhythm CV ${m.sentenceLengthCV}` + (m.uniformRhythm ? '  ⚠ too flat' : '');

  // Per-paragraph heatmap: only worth showing when there's more than one block,
  // one paragraph is already the overall score. Worst-first so the problem leads.
  const paras = window.cadenceAnalyzeParagraphs ? window.cadenceAnalyzeParagraphs(text) : [];
  heatmapEl.innerHTML = paras.length > 1
    ? '<div class="hm-label">by paragraph</div>' +
      [...paras].sort((a, b) => b.score - a.score).map((p) => {
        const tells = p.findings.length
          ? [...new Set(p.findings.map((f) => f.rule))].slice(0, 4).join(', ')
          : 'clean';
        return `<div class="hm-row" data-grade="${p.grade}" title="¶${p.index + 1} · ${esc(tells)}">` +
          `<span class="hm-score">${p.score}</span>` +
          `<span class="hm-text">${esc(p.snippet)}</span></div>`;
      }).join('')
    : '';

  const byRule = {};
  for (const f of r.findings) (byRule[f.rule] ||= []).push(f.snippet);
  const rules = Object.entries(byRule);
  findingsEl.innerHTML = rules.length
    ? rules.map(([rule, snips]) => {
        const shown = snips.slice(0, 5).map((s) => `“${esc(s)}”`).join(', ');
        const more = snips.length > 5 ? ` +${snips.length - 5}` : '';
        return `<div class="f"><b>${esc(rule)}</b><span>${shown}${more}</span></div>`;
      }).join('')
    : '<div class="clean">No tells found.</div>';
}

input.addEventListener('input', () => render(input.value));

// If the user came here via "Score with Cadence" on a selection, pre-fill it.
if (typeof chrome !== 'undefined' && chrome.storage) {
  chrome.storage.local.get('pendingText', ({ pendingText }) => {
    if (pendingText) {
      input.value = pendingText;
      render(pendingText);
      chrome.storage.local.remove('pendingText');
    }
  });
}
input.focus();
