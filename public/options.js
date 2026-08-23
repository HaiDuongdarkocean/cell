const TTS_DOWNLOAD_VOICE = 'TTS_DOWNLOAD_VOICE';
const TTS_DOWNLOAD_PROGRESS = 'TTS_DOWNLOAD_PROGRESS';
const TTS_SPEAK_LOCAL = 'TTS_SPEAK_LOCAL';

const appState = {
  downloadStatus: 'pending',
  progress: '',
  speakStatus: 'pending',
};
window.appState = appState;

const statusEl = document.getElementById('status');
const logEl = document.getElementById('log');
const downloadBtn = document.getElementById('downloadBtn');
const speakBtn = document.getElementById('speakBtn');

function setStatus(text) {
  statusEl.textContent = text;
  logEl.textContent += text + '\n';
}

chrome.runtime.onMessage.addListener(function (message) {
  if (message && typeof message === 'object' && message.type === TTS_DOWNLOAD_PROGRESS) {
    const { loaded, total } = message.payload;
    const loadedMb = (loaded / 1024 / 1024).toFixed(1);
    const totalMb = (total / 1024 / 1024).toFixed(1);
    appState.progress = `${loadedMb}/${totalMb} MB`;
    setStatus(`Download: ${loadedMb} / ${totalMb} MB`);
  }
  return false;
});

function isResponse(value) {
  return (
    typeof value === 'object' &&
    value !== null &&
    'success' in value &&
    typeof value.success === 'boolean'
  );
}

downloadBtn.addEventListener('click', function () {
  downloadBtn.disabled = true;
  appState.downloadStatus = 'downloading';
  setStatus('Starting English voice pack download...');
  chrome.runtime
    .sendMessage({ type: TTS_DOWNLOAD_VOICE, payload: { language: 'en' } })
    .then(function (response) {
      if (isResponse(response)) {
        appState.downloadStatus = response.success ? 'success' : `error: ${response.error || ''}`;
        setStatus(`Download done: ${JSON.stringify(response)}`);
        speakBtn.disabled = !response.success;
      } else {
        appState.downloadStatus = 'error: invalid response';
        setStatus('Download error: invalid response');
      }
    })
    .catch(function (err) {
      appState.downloadStatus = `error: ${err && err.message ? err.message : String(err)}`;
      setStatus(`Download error: ${appState.downloadStatus}`);
    });
});

speakBtn.addEventListener('click', function () {
  speakBtn.disabled = true;
  appState.speakStatus = 'speaking';
  setStatus('Speaking "hello"...');
  chrome.runtime
    .sendMessage({
      type: TTS_SPEAK_LOCAL,
      payload: { text: 'hello', langCode: 'en', voiceName: 'supertonic-v3-en' },
    })
    .then(function (response) {
      if (isResponse(response)) {
        appState.speakStatus = response.success ? 'success' : `error: ${response.error || ''}`;
        setStatus(`Speak done: ${JSON.stringify(response)}`);
      } else {
        appState.speakStatus = 'error: invalid response';
        setStatus('Speak error: invalid response');
      }
    })
    .catch(function (err) {
      appState.speakStatus = `error: ${err && err.message ? err.message : String(err)}`;
      setStatus(`Speak error: ${appState.speakStatus}`);
    });
});
