// Desktop-only additions to the score page: drop a file to score it.
(function () {
  var tauri = window.__TAURI__;
  if (!tauri) return;
  var ta = document.getElementById('in');
  var load = function (path) {
    tauri.core.invoke('read_text', { path: path }).then(function (text) {
      if (/\.html?$/i.test(path)) text = window.cadenceStripHtml(text);
      else if (/\.(md|markdown)$/i.test(path)) text = window.cadenceStripMarkdown(text);
      ta.value = text;
      ta.dispatchEvent(new Event('input'));
    }, function (err) { alert('Could not read ' + path + ': ' + err); });
  };
  tauri.event.listen('tauri://drag-drop', function (e) {
    if (e.payload.paths && e.payload.paths.length) load(e.payload.paths[0]);
  });
  // The site's own nav links have nowhere to go here; web links open in the browser.
  document.querySelectorAll('a[href="./"]').forEach(function (a) {
    var sep = a.nextSibling; a.remove();
    if (sep && sep.nodeType === 3) sep.textContent = sep.textContent.replace(/^\s*·\s*/, '');
  });
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="http"]');
    if (!a) return;
    e.preventDefault();
    tauri.opener.openUrl(a.href);
  });
  var sub = document.querySelector('.sub');
  if (sub) sub.textContent = sub.textContent.replace('It runs in your browser; the text never leaves the page.', 'It runs on your computer; the text never leaves it.');
  ta.placeholder = 'Paste text here, or drop a .txt, .md, or .html file on the window.';
})();
