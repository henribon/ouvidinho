const $ = (id) => document.getElementById(id);

const ui = {
  status: $('status'),
  key: $('key'),
  detail: $('detail'),
  keys: $('keys'),
  bpm: $('bpm'),
  tune: $('tune'),
  progress: $('progress'),
  bar: $('bar'),
  startBtn: $('startBtn'),
  againBtn: $('againBtn'),
  outputs: $('outputs'),
  copyBtn: $('copyBtn'),
  midiBtn: $('midiBtn'),
  stopBtn: $('stopBtn'),
  note: $('note'),
  error: $('error'),
  live: $('live'),
};

let currentTab = null;
let state = { capturing: false };
let result = null;
let previous = null;
let busy = false;

const keyEls = new Array(12);
[0, 2, 4, 5, 7, 9, 11].forEach((pc) => {
  const el = document.createElement('i');
  el.className = 'w';
  ui.keys.appendChild(el);
  keyEls[pc] = el;
});
[[1, 1], [3, 2], [6, 4], [8, 5], [10, 6]].forEach(([pc, edge]) => {
  const el = document.createElement('i');
  el.className = 'b';
  el.style.left = `${(edge / 7) * 100}%`;
  ui.keys.appendChild(el);
  keyEls[pc] = el;
});

init();

async function init() {
  try {
    [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  } catch {
    currentTab = null;
  }
  const res = await chrome.runtime.sendMessage({ type: 'get-state' }).catch(() => null);
  if (res) {
    state = res.state || state;
    result = res.result || null;
  }
  render();
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'analysis' && state.capturing) {
    result = msg.data;
    render();
  } else if (msg?.type === 'state') {
    state = msg.state;
    if (!state.capturing) result = null;
    render();
  }
});

ui.startBtn.addEventListener('click', startHere);
ui.stopBtn.addEventListener('click', async () => {
  if (busy) return;
  setBusy(true);
  await chrome.runtime.sendMessage({ type: 'stop' }).catch(() => {});
  setBusy(false);
});
ui.againBtn.addEventListener('click', async () => {
  result = null;
  render();
  await chrome.runtime.sendMessage({ type: 'reset' }).catch(() => {});
});
ui.copyBtn.addEventListener('click', copySummary);
ui.midiBtn.addEventListener('click', downloadMidi);
ui.midiBtn.addEventListener('dragstart', (e) => {
  const midi = currentMidi();
  if (!midi) return e.preventDefault();
  const base64 = btoa(String.fromCharCode(...midi.bytes));
  e.dataTransfer.effectAllowed = 'copy';
  e.dataTransfer.setData('DownloadURL', `audio/midi:${midi.name}:data:audio/midi;base64,${base64}`);
});

async function startHere() {
  if (busy) return;
  showError('');
  if (!currentTab?.id) {
    showError('Não encontrei a aba ativa.');
    return;
  }
  setBusy(true);
  try {
    const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: currentTab.id });
    const res = await chrome.runtime.sendMessage({
      type: 'start',
      tabId: currentTab.id,
      tabTitle: currentTab.title || '',
      streamId,
    });
    if (!res?.ok) throw new Error(res?.error || 'erro desconhecido');
  } catch (err) {
    showError(friendlyError(err));
  } finally {
    setBusy(false);
  }
}

function friendlyError(err) {
  const text = err?.message || String(err);
  if (/chrome pages cannot be captured|cannot capture/i.test(text) || /chrome:\/\//.test(text))
    return 'Não dá para ouvir páginas internas do navegador, como as de configurações e a loja de extensões. Abra a música em um site comum.';
  if (/active stream/i.test(text))
    return 'Esta aba já está sendo capturada por outra extensão ou gravação. Pare a outra captura e tente de novo.';
  if (/not been invoked|activeTab/i.test(text))
    return 'Abra o Ouvidinho estando na aba da música e tente de novo.';
  if (/NotAllowed|Permission/i.test(text)) return 'O navegador não permitiu capturar o áudio desta aba.';
  return `Não consegui ouvir esta aba: ${text}`;
}

function setBusy(value) {
  busy = value;
  for (const btn of [ui.startBtn, ui.stopBtn]) btn.setAttribute('aria-disabled', String(value));
}

function showError(text) {
  ui.error.textContent = text;
  ui.error.hidden = !text;
}

const spoken = (s) => s.replace(/♯/g, ' sustenido').replace(/♭/g, ' bemol');

const spokenChord = (key) => `${spoken(key.short.replace(/m$/, ''))} ${key.mode === 'minor' ? 'menor' : 'maior'}`;

function put(el, shown, said = shown) {
  const signature = `${shown}\n${said}`;
  if (el.dataset.text === signature) return;
  el.dataset.text = signature;
  if (said === shown) {
    el.textContent = shown;
    return;
  }
  const visual = document.createElement('span');
  visual.setAttribute('aria-hidden', 'true');
  visual.textContent = shown;
  const voice = document.createElement('span');
  voice.className = 'sr';
  voice.textContent = said;
  el.replaceChildren(visual, voice);
}

function announce(text) {
  ui.live.textContent = '';
  setTimeout(() => (ui.live.textContent = text), 60);
}

function render() {
  const capturing = !!state.capturing;
  const here = capturing && currentTab && state.tabId === currentTab.id;
  const r = capturing ? result : null;
  const key = r?.key || null;
  const listening = capturing && (!r || r.state !== 'locked');
  const silent = !!r?.silent;

  const focused = document.activeElement;
  ui.startBtn.hidden = !!here;
  ui.againBtn.hidden = !here;
  ui.outputs.hidden = !capturing;
  ui.copyBtn.disabled = !key;
  ui.midiBtn.disabled = !key;
  ui.midiBtn.draggable = !!key;
  ui.stopBtn.hidden = !capturing;
  if (focused?.hidden || focused?.disabled || (!capturing && ui.outputs.contains(focused)))
    (capturing ? (here ? ui.againBtn : ui.startBtn) : ui.startBtn).focus();

  let status = '';
  if (capturing) {
    if (silent) status = 'sem som';
    else if (!key) status = 'ouvindo';
    else status = r.state === 'checking' ? 'conferindo' : 'tom definido';
  }
  put(ui.status, status, status ? `Situação: ${status}` : '');

  ui.key.classList.toggle('wait', !key);
  if (key) put(ui.key, key.name, `Tom: ${spoken(key.name)}`);
  else if (!capturing) put(ui.key, '—', 'Tom ainda não definido');
  else if (silent) put(ui.key, 'Sem som');
  else put(ui.key, 'Ouvindo…', 'Ouvindo');

  if (key) {
    put(
      ui.detail,
      `${key.short} · ${key.camelot} · relativa ${key.relative}`,
      `Cifra: ${spokenChord(key)}. Camelot: ${key.camelot}. Relativa: ${spoken(key.relative)}.`,
    );
  } else if (!capturing) put(ui.detail, 'Dê play na música e use o botão Ouvir esta aba.');
  else if (silent) put(ui.detail, 'Dê play na música.');
  else {
    const left = r ? Math.ceil(r.listenLeftSec) : 0;
    put(ui.detail, left > 0 ? `Definindo o tom, faltam ${left} s` : 'Definindo o tom…', left > 0 ? `Definindo o tom, faltam ${left} segundos` : 'Definindo o tom');
  }

  const scale = new Set(key ? key.scale : []);
  keyEls.forEach((el, pc) => {
    el.classList.toggle('on', scale.has(pc));
    el.classList.toggle('tonic', !!key && key.tonic === pc);
  });
  const keysLabel = key
    ? `Notas da escala: ${key.scaleNames.map(spoken).join(', ')}. Tônica: ${spoken(key.scaleNames[0])}.`
    : 'Teclado: nenhuma escala definida';
  if (ui.keys.getAttribute('aria-label') !== keysLabel) ui.keys.setAttribute('aria-label', keysLabel);

  if (r?.bpm) {
    if (ui.bpm.dataset.text !== String(r.bpm)) {
      ui.bpm.dataset.text = String(r.bpm);
      ui.bpm.innerHTML = `<b>${r.bpm}</b> BPM`;
    }
  } else put(ui.bpm, '— BPM', 'BPM ainda não definido');
  const cents = key ? r.tuningCents : 0;
  if (Math.abs(cents) >= 8) {
    const hz = Math.round(440 * Math.pow(2, cents / 1200));
    put(ui.tune, `Lá = ${hz} Hz`, `Afinação de referência: Lá em ${hz} hertz`);
  } else put(ui.tune, '');

  ui.progress.classList.toggle('on', listening && !silent);
  ui.bar.style.width = `${Math.round((r ? r.progress : 0) * 100)}%`;

  ui.note.hidden = !capturing || !!here;
  if (!ui.note.hidden) put(ui.note, `Ouvindo outra aba: ${state.tabTitle || 'sem título'}`);

  announceChanges(capturing, r);
}

function announceChanges(capturing, r) {
  const now = {
    capturing,
    connected: !!r,
    key: r?.key?.short || null,
    checking: r?.state === 'checking',
    silent: !!r?.silent,
    bpm: r?.bpm || null,
  };
  const was = previous;
  previous = now;

  const keyText = () => `${spoken(r.key.name)}${now.bpm ? `, ${now.bpm} BPM` : ''}.`;

  if (!was) {
    if (now.key) announce(`Tom: ${keyText()}`);
    else if (capturing) announce(now.silent ? 'Sem som.' : 'Ouvindo. Aviso quando o tom estiver definido.');
    return;
  }
  if (!capturing) {
    if (was.capturing) announce('Parado.');
    return;
  }
  if (!now.connected) {
    if (was.connected || !was.capturing) announce('Ouvindo. Aviso quando o tom estiver definido.');
    return;
  }
  if (now.key && now.key !== was.key) announce(`Tom definido: ${keyText()}`);
  else if (now.checking && !was.checking) announce('Conferindo se a música mudou.');
  else if (now.key && was.checking && !now.checking) announce(`Tom mantido: ${keyText()}`);
  else if (now.silent && !was.silent) announce('Sem som.');
  else if (!now.silent && was.silent && !now.key) announce('Ouvindo.');
  else if (now.key && now.bpm && now.bpm !== was.bpm) announce(`${now.bpm} BPM.`);
}

function currentMidi() {
  const r = state.capturing ? result : null;
  if (!r?.key) return null;
  return { name: OuvidinhoMidi.fileName(r.key, r.bpm), bytes: OuvidinhoMidi.scaleFile(r.key, r.bpm), key: r.key };
}

function downloadMidi() {
  const midi = currentMidi();
  if (!midi) return;
  const url = URL.createObjectURL(new Blob([midi.bytes], { type: 'audio/midi' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = midi.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  announce(`MIDI baixado: escala de ${spoken(midi.key.name)}. Arquivo ${midi.name}`);
}

async function copySummary() {
  const r = state.capturing ? result : null;
  if (!r?.key) return;
  const parts = [`${r.key.short} (${r.key.camelot})`];
  if (r.bpm) parts.push(`${r.bpm} BPM`);
  try {
    await navigator.clipboard.writeText(parts.join(' · '));
    ui.copyBtn.textContent = 'Copiado';
    announce(`Copiado: ${spokenChord(r.key)}${r.bpm ? `, ${r.bpm} BPM` : ''}.`);
  } catch {
    ui.copyBtn.textContent = 'Não copiou';
    announce('Não foi possível copiar.');
  }
  setTimeout(() => (ui.copyBtn.textContent = 'Copiar'), 1500);
}
