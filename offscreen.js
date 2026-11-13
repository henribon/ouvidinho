let ctx = null;
let stream = null;
let analyzer = null;
let timer = null;

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.target !== 'offscreen') return false;
  switch (msg.type) {
    case 'start':
      start(msg.streamId).then(
        () => sendResponse({ ok: true }),
        (err) => {
          stop();
          sendResponse({ ok: false, error: err?.message || String(err) });
        },
      );
      return true;
    case 'stop':
      stop();
      sendResponse({ ok: true });
      return false;
    case 'reset':
      analyzer?.reset();
      sendResponse({ ok: true });
      return false;
    default:
      return false;
  }
});

async function start(streamId) {
  stop();
  stream = await navigator.mediaDevices.getUserMedia({
    audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId } },
    video: false,
  });

  ctx = new AudioContext({ latencyHint: 'playback' });
  await ctx.audioWorklet.addModule('capture-worklet.js');
  const source = ctx.createMediaStreamSource(stream);

  source.connect(ctx.destination);

  const tap = new AudioWorkletNode(ctx, 'ouvidinho-capture', {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [1],
  });
  const mute = ctx.createGain();
  mute.gain.value = 0;
  source.connect(tap);
  tap.connect(mute).connect(ctx.destination);

  analyzer = new Ouvidinho.Analyzer(ctx.sampleRate);
  tap.port.onmessage = (e) => analyzer?.process(e.data);

  const [track] = stream.getAudioTracks();
  track?.addEventListener('ended', () => {
    stop();
    chrome.runtime.sendMessage({ type: 'capture-ended' }).catch(() => {});
  });

  if (ctx.state === 'suspended') await ctx.resume();

  timer = setInterval(() => {
    if (!analyzer) return;
    chrome.runtime.sendMessage({ type: 'analysis', data: analyzer.getResult() }).catch(() => {});
  }, 250);
}

function stop() {
  clearInterval(timer);
  timer = null;
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  ctx?.close().catch(() => {});
  ctx = null;
  analyzer = null;
}
