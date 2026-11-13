(function (global) {
  'use strict';

  const PPQ = 480;

  function vlq(n) {
    const out = [n & 0x7f];
    while ((n >>= 7)) out.unshift((n & 0x7f) | 0x80);
    return out;
  }

  const plain = (s) => s.replace(/♯/g, '#').replace(/♭/g, 'b');
  const bytesOf = (s) => Array.from(s, (c) => c.charCodeAt(0) & 0x7f);
  const u32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];

  function scaleFile(key, bpm) {
    const usPerBeat = Math.round(60e6 / (bpm || 120));
    const name = bytesOf(`Escala de ${plain(key.short)}`);
    const spelled = key.scaleNames.join('');
    const accidentals = (spelled.match(/♯/g) || []).length - (spelled.match(/♭/g) || []).length;

    const track = [
      0, 0xff, 0x03, ...vlq(name.length), ...name,
      0, 0xff, 0x51, 3, (usPerBeat >> 16) & 255, (usPerBeat >> 8) & 255, usPerBeat & 255,
      0, 0xff, 0x58, 4, 4, 2, 24, 8,
      0, 0xff, 0x59, 2, accidentals & 0xff, key.mode === 'minor' ? 1 : 0,
    ];
    const tonicNote = 60 + key.tonic;
    const steps = key.scale.map((pc) => (pc - key.tonic + 12) % 12).concat(12);
    for (const step of steps) {
      track.push(0, 0x90, tonicNote + step, 96);
      track.push(...vlq(PPQ), 0x80, tonicNote + step, 0);
    }
    track.push(0, 0xff, 0x2f, 0);

    return Uint8Array.from([
      ...bytesOf('MThd'), ...u32(6), 0, 0, 0, 1, PPQ >> 8, PPQ & 255,
      ...bytesOf('MTrk'), ...u32(track.length), ...track,
    ]);
  }

  function fileName(key, bpm) {
    return `Ouvidinho - ${plain(key.short)} (${key.camelot})${bpm ? ` - ${bpm} BPM` : ''}.mid`;
  }

  const api = { scaleFile, fileName, PPQ };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.OuvidinhoMidi = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
