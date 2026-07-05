// Cadence in-page compose assistant.
//
//   • Impression check, scores the reply you're drafting, locally, with the same
//     deterministic detector as the popup (window.cadenceAnalyze). No network.
//   • Draft in my voice, sends the reply context to the background worker, which
//     drafts with your own key + voice sample, scores it locally, and auto-fixes
//     the AI tells before handing it back. The key never touches the page.
//
// Each site is a small adapter: where the compose box is, how to read the thread,
// and how to insert text. Adding a surface is ~10 lines. Selectors are DOM-
// dependent and can drift when a site ships a redesign. Update the adapter then.
(function () {
  if (window.__cadenceAssistant) return;
  window.__cadenceAssistant = true;

  var ADAPTERS = [
    {
      name: 'Gmail',
      host: /(^|\.)mail\.google\.com$/,
      compose: 'div[aria-label="Message Body"], div[g_editable="true"][contenteditable="true"]',
      incoming: function () {
        return lastMessages('.a3s', null, 4);                 // recent thread bodies
      },
      insert: execInsert,
    },
    {
      name: 'WhatsApp',
      host: /(^|\.)web\.whatsapp\.com$/,
      compose: 'footer div[contenteditable="true"][role="textbox"], div[contenteditable="true"][data-tab="10"]',
      incoming: function () {
        return lastMessages('.message-in span.selectable-text, .message-in .copyable-text',
                            '.message-out span.selectable-text, .message-out .copyable-text', 10);
      },
      insert: execInsert,
      postSel: '.message-out span.selectable-text, .message-out .copyable-text',   // learn from your sent messages
    },
    {
      name: 'Telegram',
      host: /(^|\.)web\.telegram\.org$/,
      compose: 'div.input-message-input[contenteditable="true"], #editable-message-text',
      incoming: function () {
        return lastMessages('.bubble.is-in .message, .Message:not(.own) .text-content',
                            '.bubble.is-out .message, .Message.own .text-content', 10);
      },
      insert: execInsert,
      postSel: '.bubble.is-out .message, .Message.own .text-content',               // your sent messages
    },
    {
      name: 'LinkedIn',
      host: /(^|\.)linkedin\.com$/,
      compose: 'div.msg-form__contenteditable[contenteditable="true"]',
      incoming: function () {
        return lastMessages('.msg-s-event-listitem__body', null, 10);
      },
      insert: execInsert,
      postSel: '.feed-shared-update-v2 .update-components-text, .feed-shared-update-v2', // your posts / activity
    },
    {
      name: 'Instagram',
      host: /(^|\.)instagram\.com$/,
      compose: 'textarea[placeholder^="Message"], div[contenteditable="true"][aria-label^="Message"]',
      incoming: function () { return ''; },   // Instagram's DM DOM is obfuscated. Paste the thread instead
      paste: true,
      insert: execInsert,
      postSel: 'article, div[role="article"]',   // "Learn my voice" reads visible posts/captions
    },
    {
      name: 'Facebook',
      host: /(^|\.)facebook\.com$/,
      compose: 'div[contenteditable="true"][role="textbox"][aria-label*="message" i]',
      incoming: function () { return ''; },
      paste: true,
      insert: execInsert,
      postSel: 'div[role="article"]',
    },
  ];

  // "Learn my voice": pull prose lines out of the posts rendered on this page,
  // drop the UI chrome (Like / Comment / timestamps), dedupe, and cap the length.
  function harvest(sel) {
    var lines = [], seen = {};
    document.querySelectorAll(sel).forEach(function (el) {
      (el.innerText || '').split('\n').forEach(function (raw) {
        var s = raw.trim();
        if (s.length < 20 || !/\s/.test(s)) return;   // keep short messages, drop "ok"/"lol"
        if (/^(like|comment|share|reply|follow|following|see more|view|edited|\d+\s*(likes?|comments?|shares?)|\d+[hdwmy]|·)/i.test(s)) return;
        if (!seen[s]) { seen[s] = 1; lines.push(s); }
      });
    });
    return lines.join('\n').slice(0, 8000);
  }

  // Pull the last `n` messages of the open conversation as a short transcript, so a
  // draft can lean on shared history (a name, a prior plan, an inside joke). When an
  // outgoing selector is given, messages are labeled Them/You and interleaved in DOM
  // order; otherwise the bodies are returned plain (e.g. a Gmail thread).
  function lastMessages(inSel, outSel, n) {
    var nodes = [];
    document.querySelectorAll(inSel).forEach(function (e) { nodes.push([e, outSel ? 'Them' : '']); });
    if (outSel) document.querySelectorAll(outSel).forEach(function (e) { nodes.push([e, 'You']); });
    nodes.sort(function (a, b) {
      return (a[0].compareDocumentPosition(b[0]) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1;
    });
    return nodes.slice(-n).map(function (x) {
      var t = (x[0].innerText || '').trim().replace(/\s+/g, ' ').slice(0, 500);
      if (!t) return '';
      return x[1] ? x[1] + ': ' + t : t;
    }).filter(Boolean).join('\n').slice(0, 4000);
  }

  // Read the current text, whether the box is a contenteditable or a <textarea>.
  function readBox(el) { return el ? (el.tagName === 'TEXTAREA' ? el.value : el.innerText) : ''; }

  // Replace the compose contents with `text`, then let the site's editor notice.
  function execInsert(box, text) {
    box.focus();
    if (box.tagName === 'TEXTAREA') {
      box.value = text;
      box.dispatchEvent(new InputEvent('input', { bubbles: true }));
      return;
    }
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
  window.__cadenceHarvest = function () { return site.postSel ? harvest(site.postSel) : ''; };  // test seam

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
    '#cadence-meter .paste{width:100%;box-sizing:border-box;resize:vertical;margin-bottom:8px;',
    'font:11.5px -apple-system,system-ui,sans-serif;color:#172031;background:#f7f8fa;',
    'border:1px solid #e3e7ec;border-radius:7px;padding:6px 8px;outline:none}',
    '#cadence-meter .paste:focus{border-color:#2348a1}',
    '#cadence-meter .msg{font-size:11.5px;color:#6b7280;margin-top:8px;line-height:1.4}',
    '#cadence-meter .msg a{color:#2348a1;cursor:pointer;text-decoration:underline}',
    '#cadence-meter[data-grade="A"] .g,#cadence-meter[data-grade="B"] .g{color:#317a45}',
    '#cadence-meter[data-grade="C"] .g{color:#c9922a}',
    '#cadence-learn{position:fixed;right:16px;top:16px;z-index:2147483647;width:242px;',
    'font-family:-apple-system,system-ui,"Segoe UI",sans-serif;background:#fff;color:#172031;',
    'border:1px solid #e3e7ec;border-radius:12px;box-shadow:0 8px 30px -10px rgba(20,27,41,.35);padding:10px 12px}',
    '#cadence-learn .lbtn{width:100%;background:#2348a1;color:#fff;border:0;border-radius:8px;padding:8px 10px;',
    'font:600 12.5px -apple-system,system-ui,sans-serif;cursor:pointer}',
    '#cadence-learn .lbtn:hover{background:#1b3a85}',
    '#cadence-learn .lbtn:disabled{opacity:.55;cursor:default}',
    '#cadence-learn .lres{font-size:11.5px;line-height:1.45;color:#3a4253;margin-top:8px;max-height:170px;overflow:auto;white-space:pre-wrap}',
    '#cadence-learn .lres:empty{display:none}',
    '#cadence-learn .lres b{color:#317a45}'
  ].join('');
  document.documentElement.appendChild(style);

  var meter = document.createElement('div');
  meter.id = 'cadence-meter';
  meter.innerHTML =
    '<div class="row"><span class="lbl">CADENCE</span>' +
    '<button class="draft" type="button" title="Type a note or an occasion (e.g. &quot;happy birthday&quot;), then draft. It reads the thread for shared context.">Draft in my voice</button></div>' +
    '<div class="read"><div class="hd"><span class="g">·</span><span class="s"></span></div>' +
    '<div class="m"></div><div class="t"></div></div>' +
    (site.paste ? '<textarea class="paste" rows="3" placeholder="Paste the recent messages here so the draft can use them (optional)"></textarea>' : '') +
    '<div class="msg"></div>';
  document.documentElement.appendChild(meter);
  var gEl = meter.querySelector('.g'), sEl = meter.querySelector('.s'),
      mEl = meter.querySelector('.m'), tEl = meter.querySelector('.t'),
      draftBtn = meter.querySelector('.draft'), msgEl = meter.querySelector('.msg'),
      pasteBox = meter.querySelector('.paste');

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
    timer = setTimeout(function () { render(readBox(activeBox)); }, 250);
  }
  function boxOf(node) { return node && node.closest ? node.closest(site.compose) : null; }

  // ── draft in my voice (background → Claude, score-and-fix loop) ──
  draftBtn.addEventListener('click', function () {
    if (!activeBox) return;
    if (!hasRuntime) { setMsg('Draft needs the installed extension.'); return; }
    var ctx = site.incoming() || (pasteBox ? pasteBox.value.trim() : '');
    var payload = { type: 'cadenceDraft', draft: readBox(activeBox).trim(), incoming: ctx };
    draftBtn.disabled = true;
    setMsg('Drafting in your voice…');
    chrome.runtime.sendMessage(payload, function (resp) {
      draftBtn.disabled = false;
      if (chrome.runtime.lastError || !resp) { setMsg('No response. Reload the page and try again.'); return; }
      if (resp.error === 'no-key') {
        setMsg('Add your Anthropic API key in <a id="cad-opts">settings</a> to draft.');
        var l = document.getElementById('cad-opts');
        if (l) l.addEventListener('click', function () { chrome.runtime.sendMessage({ type: 'openOptions' }); });
        return;
      }
      if (resp.error) { setMsg('Couldn’t draft: ' + esc(resp.error)); return; }
      site.insert(activeBox, resp.text);
      var note = 'Drafted in your voice';
      if (resp.grade) note += ', grade ' + esc(resp.grade) + (resp.rounds > 1 ? ', auto-fixed' : '');
      setMsg(note + '. Edit freely, then send.');
      render(readBox(activeBox));
    });
  });

  // ── learn my voice (posts on this page → a saved voice profile) ──
  if (site.postSel) {
    var learn = document.createElement('div');
    learn.id = 'cadence-learn';
    learn.innerHTML = '<button class="lbtn" type="button">✦ Learn my voice</button><div class="lres"></div>';
    document.documentElement.appendChild(learn);
    var lbtn = learn.querySelector('.lbtn'), lres = learn.querySelector('.lres');
    lbtn.addEventListener('click', function () {
      if (!hasRuntime) { lres.textContent = 'Learning needs the installed extension.'; return; }
      var text = harvest(site.postSel);
      if (text.replace(/\s/g, '').length < 120) { lres.textContent = 'Scroll to load a few of your posts, then try again.'; return; }
      lbtn.disabled = true; lres.textContent = 'Reading your posts…';
      chrome.runtime.sendMessage({ type: 'cadenceLearn', text: text }, function (resp) {
        lbtn.disabled = false;
        if (chrome.runtime.lastError || !resp) { lres.textContent = 'No response. Reload the page and try again.'; return; }
        if (resp.error === 'not-enough') { lres.textContent = 'Not enough of your writing on this page yet.'; return; }
        if (resp.error) { lres.textContent = 'Couldn’t learn: ' + esc(resp.error); return; }
        lbtn.textContent = '✦ Voice learned';
        var p = resp.preview || '';
        lres.innerHTML = '<b>Saved.</b> ' + esc(p.slice(0, 220)) + (p.length > 220 ? '…' : '');
      });
    });
  }

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
