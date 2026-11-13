'use strict';
const { Analyzer, describeKey } = require('../analyzer.js');
const { synth } = require('./synth.js');

const verbose = process.argv.includes('-v');
let failures = 0;

function timeline(samples, sr) {
  const a = new Analyzer(sr);
  const block = 4096;
  const shots = [];
  let nextTick = sr;
  for (let i = 0; i < samples.length; i += block) {
    a.process(samples.subarray(i, Math.min(samples.length, i + block)));
    if (i + block >= nextTick) {
      const r = a.getResult();
      shots.push({ t: Math.round((i + block) / sr), state: r.state, key: r.key && r.key.short, bpm: r.bpm, cand: r.candidate, tun: r.tuningCents });
      nextTick += sr;
    }
  }
  if (verbose) for (const s of shots) console.log(`   t=${s.t}s ${s.state.padEnd(9)} tom=${s.key || '-'} (palpite ${s.cand || '-'}) bpm=${s.bpm || '-'} afin=${s.tun}`);
  return shots;
}

function changes(shots, field) {
  const out = [];
  for (const s of shots) {
    if (s[field] == null) continue;
    if (!out.length || out[out.length - 1].value !== s[field]) out.push({ value: s[field], t: s.t });
  }
  return out;
}

const fmt = (list) => list.map((c) => `${c.value}@${c.t}s`).join(' → ') || '-';

function report(ok, name, detail) {
  if (!ok) failures++;
  console.log(`${ok ? 'OK   ' : 'FALHA'} ${name}`);
  console.log(`      ${detail}`);
}

function join(sr, ...parts) {
  const bufs = parts.map((p) => (typeof p === 'number' ? new Float32Array(Math.round(sr * p)) : p));
  const all = new Float32Array(bufs.reduce((n, b) => n + b.length, 0));
  let pos = 0;
  for (const b of bufs) {
    all.set(b, pos);
    pos += b.length;
  }
  return all;
}

const cases = [
  { name: 'Lá menor, 128 BPM', bpm: 128, tonic: 9, mode: 'minor', chords: [['A', 'min'], ['D', 'min'], ['E', 'maj'], ['A', 'min']] },
  { name: 'Dó maior (I-V-vi-IV), 100 BPM', bpm: 100, tonic: 0, mode: 'major', chords: [['C', 'maj'], ['G', 'maj'], ['A', 'min'], ['F', 'maj']] },
  { name: 'Fá♯ menor, 90 BPM @44.1k', bpm: 90, sr: 44100, tonic: 6, mode: 'minor', chords: [['F#', 'min'], ['B', 'min'], ['C#', 'maj'], ['F#', 'min']] },
  { name: 'Mi♭ maior, 174 BPM', bpm: 174, tonic: 3, mode: 'major', chords: [['Eb', 'maj'], ['Ab', 'maj'], ['Bb', 'maj'], ['Eb', 'maj']], octaveOk: true },
  { name: 'Si♭ maior, 75 BPM', bpm: 75, tonic: 10, mode: 'major', chords: [['Bb', 'maj'], ['G', 'min'], ['Eb', 'maj'], ['F', 'maj']], octaveOk: true },
  { name: 'Ré menor, 140 BPM, afinação +35 cents', bpm: 140, a4: 440 * Math.pow(2, 35 / 1200), tonic: 2, mode: 'minor', chords: [['D', 'min'], ['G', 'min'], ['A', 'maj'], ['D', 'min']] },
  { name: 'Sol maior, 120 BPM, A=432 Hz', bpm: 120, a4: 432, tonic: 7, mode: 'major', chords: [['G', 'maj'], ['C', 'maj'], ['D', 'maj'], ['G', 'maj']] },
  { name: 'Mi menor, 95 BPM', bpm: 95, tonic: 4, mode: 'minor', chords: [['E', 'min'], ['C', 'maj'], ['B', 'maj'], ['E', 'min']] },
  { name: 'Lá maior, 122 BPM', bpm: 122, tonic: 9, mode: 'major', chords: [['A', 'maj'], ['D', 'maj'], ['E', 'maj'], ['A', 'maj']] },
  { name: 'Dó menor, 85 BPM, sem bateria', bpm: 85, drums: false, tonic: 0, mode: 'minor', chords: [['C', 'min'], ['F', 'min'], ['G', 'maj'], ['C', 'min']] },
];

for (const c of cases) {
  const sr = c.sr || 48000;
  const shots = timeline(synth({ ...c, sr, seconds: 75, seed: c.bpm }), sr);
  const keys = changes(shots, 'key');
  const bpms = changes(shots, 'bpm');
  const expected = describeKey(c.tonic, c.mode).short;
  const last = shots[shots.length - 1];
  const bpmHit = (v) => Math.abs(v - c.bpm) <= 1 || (c.octaveOk && (Math.abs(v * 2 - c.bpm) <= 1 || Math.abs(v / 2 - c.bpm) <= 1));
  const ok =
    keys.length === 1 && keys[0].value === expected && keys[0].t >= 16 && keys[0].t <= 45 &&
    bpms.length === 1 && bpmHit(bpms[0].value) && last.state === 'locked';
  report(ok, c.name, `tom: ${fmt(keys)}   bpm: ${fmt(bpms)}   afinação ${last.tun}c`);
}

const sr = 48000;
const Am = (seconds, seed = 1) => synth({ sr, bpm: 128, seconds, seed, tonic: 9, mode: 'minor', chords: cases[0].chords });
const C = (seconds, seed = 2) => synth({ sr, bpm: 100, seconds, seed, tonic: 0, mode: 'major', chords: cases[1].chords });

{
  const shots = timeline(join(sr, Am(40), 3, C(60)), sr);
  const keys = changes(shots, 'key');
  const bpms = changes(shots, 'bpm');
  const last = shots[shots.length - 1];
  const checked = shots.some((s) => s.state === 'checking' && s.key === 'Am');
  const ok = keys.map((k) => k.value).join() === 'Am,C' && bpms.map((b) => b.value).join() === '128,100' && checked && last.state === 'locked';
  report(ok, 'Troca de música após 3 s de silêncio', `tom: ${fmt(keys)}   bpm: ${fmt(bpms)}`);
}

{
  const shots = timeline(join(sr, Am(40), 5, Am(50, 7)), sr);
  const keys = changes(shots, 'key');
  const bpms = changes(shots, 'bpm');
  const ok = keys.length === 1 && keys[0].value === 'Am' && bpms.length === 1 && bpms[0].value === 128;
  report(ok, 'Pausa de 5 s e volta na mesma música', `tom: ${fmt(keys)}   bpm: ${fmt(bpms)}`);
}

{
  const Eb = synth({ sr, bpm: 100, seconds: 110, seed: 3, tonic: 3, mode: 'major', chords: cases[3].chords });
  const shots = timeline(join(sr, Am(50), Eb), sr);
  const keys = changes(shots, 'key');
  const bpms = changes(shots, 'bpm');
  const ok = keys.map((k) => k.value).join() === 'Am,E♭' && bpms.map((b) => b.value).join() === '128,100';
  report(ok, 'Troca emendada (sem silêncio) aos 50 s, Lá menor → Mi♭ maior', `tom: ${fmt(keys)}   bpm: ${fmt(bpms)}`);
}

{
  const vamp = synth({ sr, bpm: 100, seconds: 24, seed: 5, tonic: 0, mode: 'major', chords: [['G', 'maj']] });
  const shots = timeline(join(sr, C(36), vamp, C(36, 9)), sr);
  const keys = changes(shots, 'key');
  const ok = keys.length === 1 && keys[0].value === 'C';
  report(ok, 'Dó maior com 24 s parados no acorde de Sol', `tom: ${fmt(keys)}`);
}

{
  const noDrums = synth({ sr, bpm: 128, seconds: 15, seed: 11, drums: false, tonic: 9, mode: 'minor', chords: cases[0].chords });
  const shots = timeline(join(sr, Am(45), noDrums, Am(30, 4)), sr);
  const keys = changes(shots, 'key');
  const bpms = changes(shots, 'bpm');
  const ok = keys.length === 1 && bpms.length === 1 && bpms[0].value === 128;
  report(ok, 'Lá menor com 15 s sem bateria no meio', `tom: ${fmt(keys)}   bpm: ${fmt(bpms)}`);
}

{
  const songs = [
    { want: 'Bm', bpm: 74, tonic: 11, mode: 'minor', chords: [['B', 'min'], ['F#', 'dom7'], ['A', 'maj'], ['E', 'maj'], ['G', 'maj'], ['D', 'maj'], ['E', 'min'], ['F#', 'dom7']] },
    { want: 'Am', bpm: 110, tonic: 9, mode: 'minor', chords: [['A', 'min'], ['G', 'maj'], ['F', 'maj'], ['E', 'maj']] },
    { want: 'Dm', bpm: 100, tonic: 2, mode: 'minor', chords: [['D', 'min'], ['Bb', 'maj'], ['F', 'maj'], ['C', 'maj'], ['D', 'min'], ['Bb', 'maj'], ['A', 'dom7'], ['A', 'dom7']], allow: 1 },
    { want: 'C', bpm: 80, tonic: 0, mode: 'major', chords: [['C', 'maj'], ['G', 'maj'], ['A', 'min'], ['F', 'maj']] },
    { want: 'G', bpm: 72, tonic: 7, mode: 'major', chords: [['G', 'maj'], ['E', 'min'], ['C', 'maj'], ['D', 'maj']] },
    { want: 'D', bpm: 118, tonic: 2, mode: 'major', chords: [['D', 'maj'], ['A', 'maj'], ['B', 'min'], ['G', 'maj']] },
  ];
  for (const song of songs) {
    const audio = synth({ ...song, sr, seconds: 100, seed: song.bpm });
    const bar = 240 / song.bpm;
    const got = song.chords.map((_, start) => {
      const a = new Analyzer(sr);
      const from = Math.round(start * bar * sr);
      for (let i = from; i < from + 50 * sr && !a.locked; i += 4096) a.process(audio.subarray(i, i + 4096));
      return a.getResult().key ? a.getResult().key.short : '-';
    });
    const misses = got.filter((k) => k !== song.want).length;
    report(misses <= (song.allow || 0), `${song.want}: ${song.chords.map((c) => c[0] + (c[1] === 'min' ? 'm' : c[1] === 'dom7' ? '7' : '')).join(' ')}, começando em cada acorde`, got.join(' '));
  }
}

{
  const expect = [
    [9, 'major', 'Lá Si Dó♯ Ré Mi Fá♯ Sol♯'],
    [9, 'minor', 'Lá Si Dó Ré Mi Fá Sol'],
    [3, 'major', 'Mi♭ Fá Sol Lá♭ Si♭ Dó Ré'],
    [6, 'minor', 'Fá♯ Sol♯ Lá Si Dó♯ Ré Mi'],
    [1, 'major', 'Ré♭ Mi♭ Fá Sol♭ Lá♭ Si♭ Dó'],
    [8, 'minor', 'Sol♯ Lá♯ Si Dó♯ Ré♯ Mi Fá♯'],
  ];
  const wrong = expect.filter(([t, m, names]) => describeKey(t, m).scaleNames.join(' ') !== names);
  report(!wrong.length, 'Grafia das notas da escala', wrong.length ? wrong.map(([t, m]) => describeKey(t, m).scaleNames.join(' ')).join(' | ') : `${expect.length} escalas conferidas`);
}

{
  const { scaleFile, fileName } = require('../midi.js');
  const problems = [];
  const check = (tonic, mode, bpm, wantNotes, wantSf, wantName) => {
    const key = describeKey(tonic, mode);
    const b = scaleFile(key, bpm);
    const str = (i, n) => String.fromCharCode(...b.subarray(i, i + n));
    const trackLen = (b[18] << 24) | (b[19] << 16) | (b[20] << 8) | b[21];
    if (str(0, 4) !== 'MThd' || str(14, 4) !== 'MTrk') problems.push(`${key.short}: cabeçalho`);
    if (b.length !== 22 + trackLen) problems.push(`${key.short}: tamanho da faixa`);
    if (b[b.length - 3] !== 0xff || b[b.length - 2] !== 0x2f) problems.push(`${key.short}: fim da faixa`);
    const at = (a, c) => b.findIndex((v, i) => v === 0xff && b[i + 1] === a && b[i + 2] === c);
    const t = at(0x51, 3);
    const tempo = Math.round(60e6 / ((b[t + 3] << 16) | (b[t + 4] << 8) | b[t + 5]));
    if (tempo !== (bpm || 120)) problems.push(`${key.short}: andamento ${tempo}`);
    const k = at(0x59, 2);
    const sf = (b[k + 3] << 24) >> 24;
    if (sf !== wantSf || b[k + 4] !== (mode === 'minor' ? 1 : 0)) problems.push(`${key.short}: armadura ${sf}`);
    const notes = [];
    for (let i = k + 5; i < b.length - 3; i++) if (b[i] === 0x90) notes.push(b[i + 1]);
    if (notes.join() !== wantNotes.join()) problems.push(`${key.short}: notas ${notes.join(' ')}`);
    if (fileName(key, bpm) !== wantName) problems.push(`nome: ${fileName(key, bpm)}`);
  };
  check(9, 'minor', 128, [69, 71, 72, 74, 76, 77, 79, 81], 0, 'Ouvidinho - Am (8A) - 128 BPM.mid');
  check(9, 'major', 122, [69, 71, 73, 74, 76, 78, 80, 81], 3, 'Ouvidinho - A (11B) - 122 BPM.mid');
  check(3, 'major', null, [63, 65, 67, 68, 70, 72, 74, 75], -3, 'Ouvidinho - Eb (5B).mid');
  check(6, 'minor', 90, [66, 68, 69, 71, 73, 74, 76, 78], 3, 'Ouvidinho - F#m (11A) - 90 BPM.mid');
  report(!problems.length, 'Arquivo MIDI da escala', problems.length ? problems.join(' | ') : '4 arquivos conferidos byte a byte (cabeçalho, andamento, armadura, notas, nome)');
}

console.log(failures ? `\n${failures} caso(s) falharam.` : '\nTodos os casos passaram.');
process.exitCode = failures ? 1 : 0;
