(function (global) {
  'use strict';
  const { describeKey } = typeof module !== "undefined" && module.exports ? require("../analyzer.js") : global.Ouvidinho;

  const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, Ab: 8, A: 9, Bb: 10, B: 11 };
  const QUALITY = { maj: [0, 4, 7], min: [0, 3, 7], dom7: [0, 4, 7, 10] };

  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function synth({ sr = 48000, bpm, seconds = 30, chords, tonic, mode, a4 = 440, seed = 1, drums = true }) {
    const out = new Float32Array(Math.round(sr * seconds));
    const rand = rng(seed);
    const beat = 60 / bpm;
    const bar = 4 * beat;
    const hz = (midi) => a4 * Math.pow(2, (midi - 69) / 12);
    const scale = describeKey(tonic, mode).scale;

    const tone = (t0, dur, f, amp, harmonics, decay) => {
      const i0 = Math.round(t0 * sr);
      const n = Math.min(out.length - i0, Math.round((dur + 0.05) * sr));
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const env = Math.min(1, t / 0.01) * (decay ? Math.exp(-t / decay) : 1) * (t > dur ? Math.max(0, 1 - (t - dur) / 0.05) : 1);
        let s = 0;
        for (let h = 1; h <= harmonics; h++) {
          if (f * h > sr / 2) break;
          s += Math.sin(2 * Math.PI * f * h * t) / h;
        }
        out[i0 + i] += amp * env * s;
      }
    };

    const nBars = Math.ceil(seconds / bar);
    for (let b = 0; b < nBars; b++) {
      const ch = chords[b % chords.length];
      const root = NOTE[ch[0]];
      const ivs = QUALITY[ch[1]];
      const t0 = b * bar;
      for (const iv of ivs) {
        let midi = 48 + ((root + iv) % 12);
        if (midi < 53) midi += 12;
        tone(t0, bar - 0.02, hz(midi), 0.05, 6, 0);
      }
      for (let q = 0; q < 4; q++) {
        const tb = t0 + q * beat;
        tone(tb, beat * 0.9, hz(36 + root), 0.22, 4, 0.35);
        for (let e = 0; e < 2; e++) {
          if (rand() < 0.25) continue;
          const pc = scale[Math.floor(rand() * 7)];
          tone(tb + e * beat / 2, beat / 2 - 0.02, hz(72 + pc), 0.06, 3, 0.25);
        }
      }
    }

    if (drums) {
      const nBeats = Math.ceil(seconds / beat);
      for (let k = 0; k < nBeats; k++) {
        const tb = k * beat;
        const i0 = Math.round(tb * sr);
        let ph = 0;
        for (let i = 0; i < 0.4 * sr && i0 + i < out.length; i++) {
          const t = i / sr;
          ph += (2 * Math.PI * (48 + 110 * Math.exp(-t / 0.03))) / sr;
          out[i0 + i] += 0.6 * Math.exp(-t / 0.18) * Math.sin(ph);
        }
        if (k % 2 === 1) {
          for (let i = 0; i < 0.25 * sr && i0 + i < out.length; i++) {
            const t = i / sr;
            out[i0 + i] += 0.22 * Math.exp(-t / 0.07) * (rand() * 2 - 1) + 0.15 * Math.exp(-t / 0.05) * Math.sin(2 * Math.PI * 190 * t);
          }
        }
        const ih = Math.round((tb + beat / 2) * sr);
        let prev = 0;
        for (let i = 0; i < 0.06 * sr && ih + i < out.length; i++) {
          const t = i / sr;
          const nz = rand() * 2 - 1;
          out[ih + i] += 0.1 * Math.exp(-t / 0.015) * (nz - prev);
          prev = nz;
        }
      }
    }

    let peak = 0;
    for (let i = 0; i < out.length; i++) peak = Math.max(peak, Math.abs(out[i]));
    for (let i = 0; i < out.length; i++) out[i] *= 0.8 / peak;
    return out;
  }

  const api = { synth, NOTE, QUALITY };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.OuvidinhoSynth = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
