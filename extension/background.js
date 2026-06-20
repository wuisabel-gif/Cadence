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
