// Cadence in-page compose assistant.
//
//   • Impression check — scores the reply you're drafting, locally, with the same
//     deterministic detector as the popup (window.cadenceAnalyze). No network.
//   • Draft in my voice — sends the reply context to the background worker, which
//     drafts with your own key + voice sample, scores it locally, and auto-fixes
//     the AI tells before handing it back. The key never touches the page.
//
// Each site is a small adapter: where the compose box is, how to read the thread,
// and how to insert text. Adding a surface is ~10 lines. Selectors are DOM-
// dependent and can drift when a site ships a redesign — update the adapter then.
(function () {
  if (window.__cadenceAssistant) return;
  window.__cadenceAssistant = true;

  var ADAPTERS = [
    {
      name: 'Gmail',
      host: /(^|\.)mail\.google\.com$/,
      compose: 'div[aria-label="Message Body"], div[g_editable="true"][contenteditable="true"]',
      incoming: function () {
        var m = document.querySelectorAll('.a3s');            // rendered message bodies
        return m.length ? (m[m.length - 1].innerText || '').slice(0, 4000) : '';
      },
      insert: execInsert,
    },
    {
      name: 'WhatsApp',
      host: /(^|\.)web\.whatsapp\.com$/,
      compose: 'footer div[contenteditable="true"][role="textbox"], div[contenteditable="true"][data-tab="10"]',
      incoming: function () {
        var m = document.querySelectorAll('.message-in span.selectable-text, .message-in .copyable-text');
        return m.length ? (m[m.length - 1].innerText || '').slice(0, 2000) : '';
      },
      insert: execInsert,
    },
  ];

  // Replace the compose contents with `text`, then let the site's editor notice.
  function execInsert(box, text) {
    box.focus();
    try {
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, text);
    } catch (e) {
      box.textContent = text;
    }
    box.dispatchEvent(new InputEvent('input', { bubbles: true }));
  }

  var hostname = window.__cadenceHost || location.hostname;  // __cadenceHost is a test seam
  var site = null;
  for (var i = 0; i < ADAPTERS.length; i++) { if (ADAPTERS[i].host.test(hostname)) { site = ADAPTERS[i]; break; } }
  if (!site) return;                                          // not a surface we handle
  window.__cadenceAdapter = site.name;

  var hasRuntime = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage;

  var style = document.createElement('style');
  style.textContent = [
    '#cadence-meter{position:fixed;left:16px;bottom:16px;z-index:2147483647;width:250px;',
    'font-family:-apple-system,system-ui,"Segoe UI",sans-serif;color:#172031;background:#fff;',
    'border:1px solid #e3e7ec;border-radius:12px;box-shadow:0 8px 30px -10px rgba(20,27,41,.35);',
    'padding:11px 13px 12px;display:none}',
    '#cadence-meter.on{display:block}',
    '#cadence-meter .row{display:flex;align-items:center;gap:8px;margin-bottom:8px}',
    '#cadence-meter .lbl{font:700 10px ui-monospace,Menlo,monospace;letter-spacing:.09em;color:#2348a1}',
    '#cadence-meter .draft{margin-left:auto;background:#2348a1;color:#fff;border:0;border-radius:7px;',
    'padding:6px 11px;font:600 12px -apple-system,system-ui,sans-serif;cursor:pointer}',
    '#cadence-meter .draft:hover{background:#1b3a85}',
    '#cadence-meter .draft:disabled{opacity:.55;cursor:default}',
    '#cadence-meter .read{display:none}',
    '#cadence-meter.scored .read{display:block}',
    '#cadence-meter .hd{display:flex;align-items:baseline;gap:7px}',
    '#cadence-meter .g{font:700 22px ui-monospace,Menlo,Consolas,monospace;line-height:1;color:#db332c}',
    '#cadence-meter .s{font:12px ui-monospace,Menlo,monospace;color:#6b7280}',
    '#cadence-meter .m{font:11px ui-monospace,Menlo,monospace;color:#6b7280;margin:5px 0 6px}',
    '#cadence-meter .t{font-size:11.5px;line-height:1.45;color:#3a4253}',
    '#cadence-meter .t b{color:#db332c;font-weight:600}',
    '#cadence-meter .clean{color:#317a45;font-size:11.5px}',
    '#cadence-meter .msg{font-size:11.5px;color:#6b7280;margin-top:8px;line-height:1.4}',
    '#cadence-meter .msg a{color:#2348a1;cursor:pointer;text-decoration:underline}',
    '#cadence-meter[data-grade="A"] .g,#cadence-meter[data-grade="B"] .g{color:#317a45}',
    '#cadence-meter[data-grade="C"] .g{color:#c9922a}'
  ].join('');
  document.documentElement.appendChild(style);

  var meter = document.createElement('div');
  meter.id = 'cadence-meter';
  meter.innerHTML =
    '<div class="row"><span class="lbl">CADENCE</span>' +
    '<button class="draft" type="button">Draft in my voice</button></div>' +
    '<div class="read"><div class="hd"><span class="g">—</span><span class="s"></span></div>' +
    '<div class="m"></div><div class="t"></div></div>' +
    '<div class="msg"></div>';
  document.documentElement.appendChild(meter);
  var gEl = meter.querySelector('.g'), sEl = meter.querySelector('.s'),
      mEl = meter.querySelector('.m'), tEl = meter.querySelector('.t'),
      draftBtn = meter.querySelector('.draft'), msgEl = meter.querySelector('.msg');

  var esc = function (x) {
    return String(x).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; });
  };
  function setMsg(html) { msgEl.innerHTML = html || ''; }

  // ── impression check (local) ──
  function render(text) {
    if (typeof window.cadenceAnalyze !== 'function') return;
    var words = (text || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).length;
    if (words < 6) { meter.classList.remove('scored'); return; }
    var r = window.cadenceAnalyze(text);
    meter.dataset.grade = r.grade;
    gEl.textContent = r.grade;
    sEl.textContent = r.score + '/100';
    mEl.textContent = r.metrics.words + ' words · rhythm ' + r.metrics.sentenceLengthCV +
      (r.metrics.uniformRhythm ? ' ⚠ flat' : '');
    var by = {};
    r.findings.forEach(function (f) { (by[f.rule] = by[f.rule] || []).push(f.snippet); });
    var rules = Object.keys(by);
    tEl.innerHTML = rules.length
      ? rules.slice(0, 3).map(function (rule) {
          var snips = by[rule].slice(0, 2).map(function (x) { return '“' + esc(x) + '”'; }).join(', ');
          return '<b>' + esc(rule) + '</b> ' + snips;
        }).join('<br>')
      : '<span class="clean">Reads human. No AI tells.</span>';
    meter.classList.add('scored');
  }

  var timer, activeBox = null;
  function schedule(el) {
    activeBox = el;
    clearTimeout(timer);
    timer = setTimeout(function () { render(activeBox && activeBox.innerText); }, 250);
  }
  function boxOf(node) { return node && node.closest ? node.closest(site.compose) : null; }

  // ── draft in my voice (background → Claude, score-and-fix loop) ──
  draftBtn.addEventListener('click', function () {
    if (!activeBox) return;
    if (!hasRuntime) { setMsg('Draft needs the installed extension.'); return; }
    var payload = { type: 'cadenceDraft', draft: (activeBox.innerText || '').trim(), incoming: site.incoming() };
    draftBtn.disabled = true;
    setMsg('Drafting in your voice…');
    chrome.runtime.sendMessage(payload, function (resp) {
      draftBtn.disabled = false;
      if (chrome.runtime.lastError || !resp) { setMsg('No response — reload the page and try again.'); return; }
      if (resp.error === 'no-key') {
        setMsg('Add your Anthropic API key in <a id="cad-opts">settings</a> to draft.');
        var l = document.getElementById('cad-opts');
        if (l) l.addEventListener('click', function () { chrome.runtime.sendMessage({ type: 'openOptions' }); });
        return;
      }
      if (resp.error) { setMsg('Couldn’t draft: ' + esc(resp.error)); return; }
      site.insert(activeBox, resp.text);
      var note = 'Drafted in your voice';
      if (resp.grade) note += ' — grade ' + esc(resp.grade) + (resp.rounds > 1 ? ', auto-fixed' : '');
      setMsg(note + '. Edit freely, then send.');
      render(activeBox.innerText);
    });
  });

  document.addEventListener('input', function (e) {
    var b = boxOf(e.target);
    if (b) schedule(b);
  }, true);
  document.addEventListener('focusin', function (e) {
    var b = boxOf(e.target);
    if (b) { activeBox = b; setMsg(''); meter.classList.add('on'); schedule(b); }
    else if (!meter.contains(e.target)) { meter.classList.remove('on', 'scored'); }
  }, true);
})();
