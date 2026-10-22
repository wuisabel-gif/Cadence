// Desktop-only additions to the score page: open or drop a file to score it.
(function () {
  var tauri = window.__TAURI__;
  if (!tauri) return;
  var ta = document.getElementById('in');
  var TYPES = ['txt', 'md', 'markdown', 'html', 'htm'];
  var OPEN_KEY = /Mac/.test(navigator.platform) ? '⌘O' : 'Ctrl+O';

  var load = function (path) {
    if (TYPES.indexOf((path.split('.').pop() || '').toLowerCase()) < 0) {
      alert('Cadence scores .txt, .md, and .html files.');
      return;
    }
    tauri.core.invoke('read_text', { path: path }).then(function (text) {
      if (/\.html?$/i.test(path)) text = window.cadenceStripHtml(text);
      else if (/\.(md|markdown)$/i.test(path)) text = window.cadenceStripMarkdown(text);
      ta.value = text;
      ta.dispatchEvent(new Event('input'));
    }, function (err) { alert('Could not read ' + path + ': ' + err); });
  };

  var openFile = function () {
    tauri.dialog.open({ multiple: false, filters: [{ name: 'Text', extensions: TYPES }] })
      .then(function (path) { if (path) load(path); });
  };

  // Drop zone: outline the box while a file hovers over the window.
  var style = document.createElement('style');
  style.textContent = 'textarea.dropping{border-color:var(--brand);border-style:dashed;outline:3px solid color-mix(in oklch,var(--brand) 25%,transparent)}';
  document.head.appendChild(style);
  var hover = function (on) { ta.classList.toggle('dropping', on); };
  tauri.event.listen('tauri://drag-enter', function () { hover(true); });
  tauri.event.listen('tauri://drag-leave', function () { hover(false); });
  tauri.event.listen('tauri://drag-drop', function (e) {
    hover(false);
    if (e.payload.paths && e.payload.paths.length) load(e.payload.paths[0]);
  });

  // "Open file…" next to the other controls, plus Cmd/Ctrl+O.
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = 'Open file…';
  btn.title = 'Open a .txt, .md, or .html file (' + OPEN_KEY + ')';
  btn.addEventListener('click', openFile);
  var example = document.getElementById('example');
  example.parentNode.insertBefore(btn, example);
  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'o') {
      e.preventDefault();
      openFile();
    }
  });

  // The site's nav links have nowhere to go here: keep the logo, drop the text links.
  document.querySelectorAll('a[href="./"]').forEach(function (a) {
    if (a.querySelector('svg, img')) {
      var span = document.createElement('span');
      span.className = a.className;
      while (a.firstChild) span.appendChild(a.firstChild);
      a.replaceWith(span);
      return;
    }
    var sep = a.nextSibling;
    a.remove();
    if (sep && sep.nodeType === 3) sep.textContent = sep.textContent.replace(/^\s*·\s*/, '');
  });
  // Web links open in the system browser, not inside the app.
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="http"]');
    if (!a) return;
    e.preventDefault();
    tauri.opener.openUrl(a.href);
  });

  var sub = document.querySelector('.sub');
  if (sub) sub.textContent = sub.textContent.replace('It runs in your browser; the text never leaves the page.', 'It runs on your computer; the text never leaves it.');
  ta.placeholder = 'Paste text here, drop a .txt, .md, or .html file, or press ' + OPEN_KEY + '.';
})();
