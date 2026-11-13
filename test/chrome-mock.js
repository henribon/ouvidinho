(function () {
  const params = new URLSearchParams(parent.location.search);
  const scenario = params.get('cenario') || 'padrao';
  const listeners = [];
  const tab = { id: 7, title: 'Música de teste — YouTube' };
  let state = { capturing: false, tabId: null, tabTitle: '' };
  let analyzer = null;
  let timer = null;

  const emit = (msg) => listeners.forEach((fn) => fn(msg, {}, () => {}));

  function startSimulation() {
    const sr = 48000;
    const audio = OuvidinhoSynth.synth({
      sr,
      bpm: 128,
      seconds: 40,
      tonic: 9,
      mode: 'minor',
      chords: [['A', 'min'], ['D', 'min'], ['E', 'maj'], ['A', 'min']],
    });
    analyzer = new Ouvidinho.Analyzer(sr);
    let pos = 0;
    clearInterval(timer);
    timer = setInterval(() => {
      const n = sr * 0.5;
      analyzer.process(audio.subarray(pos, Math.min(audio.length, pos + n)));
      pos = (pos + n) % audio.length;
      emit({ type: 'analysis', data: analyzer.getResult() });
    }, 250);
  }

  if (scenario === 'outra-aba') {
    state = { capturing: true, tabId: 99, tabTitle: 'Playlist de house — SoundCloud' };
    setTimeout(startSimulation, 0);
  }

  window.chrome = {
    tabs: { query: async () => [tab] },
    tabCapture: {
      getMediaStreamId: async () => {
        if (scenario === 'erro') throw new Error('Chrome pages cannot be captured.');
        return 'stream-falso';
      },
    },
    runtime: {
      onMessage: { addListener: (fn) => listeners.push(fn) },
      sendMessage: async (msg) => {
        switch (msg.type) {
          case 'get-state':
            return { state, result: analyzer ? analyzer.getResult() : null };
          case 'start':
            state = { capturing: true, tabId: msg.tabId, tabTitle: msg.tabTitle };
            startSimulation();
            setTimeout(() => emit({ type: 'state', state }), 0);
            return { ok: true };
          case 'stop':
            clearInterval(timer);
            analyzer = null;
            state = { capturing: false, tabId: null, tabTitle: '' };
            setTimeout(() => emit({ type: 'state', state }), 0);
            return { ok: true };
          case 'reset':
            analyzer?.reset();
            return { ok: true };
          default:
            return null;
        }
      },
    },
  };
})();
