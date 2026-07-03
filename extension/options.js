const keyEl = document.getElementById('key');
const voiceEl = document.getElementById('voice');
const status = document.getElementById('status');

chrome.storage.local.get(['cadenceApiKey', 'cadenceVoice'], (s) => {
  if (s.cadenceApiKey) keyEl.value = s.cadenceApiKey;
  if (s.cadenceVoice) voiceEl.value = s.cadenceVoice;
});

document.getElementById('save').addEventListener('click', () => {
  chrome.storage.local.set({
    cadenceApiKey: keyEl.value.trim(),
    cadenceVoice: voiceEl.value.trim(),
  }, () => {
    status.textContent = 'Saved.';
    setTimeout(() => { status.textContent = ''; }, 1800);
  });
});
