const OFFSCREEN_URL = 'offscreen.html';
const IDLE = { capturing: false, tabId: null, tabTitle: '', startedAt: 0 };

let state = { ...IDLE };
let lastResult = null;
let lastBadge = '';
let creatingOffscreen = null;

const ready = (async () => {
  const { ouvidinhoState } = await chrome.storage.session.get('ouvidinhoState');
  if (ouvidinhoState) state = ouvidinhoState;
  if (state.capturing && !(await hasOffscreen())) state = { ...IDLE };
  chrome.action.setBadgeBackgroundColor({ color: '#2b2b2b' });
  if (chrome.action.setBadgeTextColor) chrome.action.setBadgeTextColor({ color: '#ffffff' });
})();

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.target === 'offscreen') return false;
  switch (msg.type) {
    case 'get-state':
      ready.then(() => sendResponse({ state, result: lastResult }));
      return true;
    case 'start':
      ready.then(() => startCapture(msg)).then(sendResponse, (err) =>
        sendResponse({ ok: false, error: err?.message || String(err) }),
      );
      return true;
    case 'stop':
      ready.then(stopCapture).then(() => sendResponse({ ok: true }));
      return true;
    case 'reset':
      lastResult = null;
      sendToOffscreen({ type: 'reset' }).finally(() => sendResponse({ ok: true }));
      return true;
    case 'analysis':
      lastResult = msg.data;
      updateBadge();
      return false;
    case 'capture-ended':
      ready.then(stopCapture);
      return false;
    default:
      return false;
  }
});

async function startCapture({ tabId, tabTitle, streamId }) {
  if (state.capturing) await stopCapture({ keepOffscreen: true });
  await ensureOffscreen();
  const res = await sendToOffscreen({ type: 'start', streamId });
  if (!res?.ok) {
    await closeOffscreen();
    return { ok: false, error: res?.error || 'Não foi possível iniciar a captura.' };
  }
  lastResult = null;
  await setState({ capturing: true, tabId, tabTitle: tabTitle || '', startedAt: Date.now() });
  updateBadge();
  return { ok: true };
}

async function stopCapture({ keepOffscreen = false } = {}) {
  await sendToOffscreen({ type: 'stop' });
  if (!keepOffscreen) await closeOffscreen();
  lastResult = null;
  await setState({ ...IDLE });
  updateBadge();
}

async function setState(next) {
  state = next;
  await chrome.storage.session.set({ ouvidinhoState: state });
  chrome.runtime.sendMessage({ type: 'state', state }).catch(() => {});
}

function updateBadge() {
  let text = '';
  let title = 'Ouvidinho — Tom & BPM';
  if (state.capturing) {
    const r = lastResult;
    text = r?.key ? r.key.short : '…';
    const parts = [];
    const spoken = (s) => s.replace(/♯/g, ' sustenido').replace(/♭/g, ' bemol');
    if (r?.key) parts.push(`${spoken(r.key.name)} (${r.key.short}, ${r.key.camelot})`);
    if (r?.bpm) parts.push(`${r.bpm} BPM`);
    title = parts.length ? `Ouvidinho — ${parts.join(' · ')}` : 'Ouvidinho — ouvindo…';
  }
  if (text !== lastBadge) {
    lastBadge = text;
    chrome.action.setBadgeText({ text });
  }
  chrome.action.setTitle({ title });
}

async function hasOffscreen() {
  const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  return contexts.length > 0;
}

async function ensureOffscreen() {
  if (await hasOffscreen()) return;
  if (!creatingOffscreen) {
    creatingOffscreen = chrome.offscreen
      .createDocument({
        url: OFFSCREEN_URL,
        reasons: ['USER_MEDIA'],
        justification: 'Analisar o áudio da aba para detectar a tonalidade e o BPM.',
      })
      .finally(() => {
        creatingOffscreen = null;
      });
  }
  await creatingOffscreen;
}

async function closeOffscreen() {
  if (await hasOffscreen()) await chrome.offscreen.closeDocument().catch(() => {});
}

async function sendToOffscreen(message) {
  if (!(await hasOffscreen())) return null;
  try {
    return await chrome.runtime.sendMessage({ ...message, target: 'offscreen' });
  } catch {
    return null;
  }
}
