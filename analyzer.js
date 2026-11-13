(function (global) {
  'use strict';

  const TWO_PI = Math.PI * 2;

  class FFT {
    constructor(n) {
      const levels = Math.round(Math.log2(n));
      if (1 << levels !== n) throw new Error('O tamanho da FFT precisa ser potência de 2');
      this.n = n;
      this.cos = new Float64Array(n / 2);
      this.sin = new Float64Array(n / 2);
      for (let i = 0; i < n / 2; i++) {
        this.cos[i] = Math.cos((TWO_PI * i) / n);
        this.sin[i] = Math.sin((TWO_PI * i) / n);
      }
      this.rev = new Uint32Array(n);
      for (let i = 0; i < n; i++) {
        let x = i;
        let r = 0;
        for (let b = 0; b < levels; b++) {
          r = (r << 1) | (x & 1);
          x >>>= 1;
        }
        this.rev[i] = r;
      }
      this.re = new Float64Array(n);
      this.im = new Float64Array(n);
    }

    magnitudes(input, out) {
      const { n, re, im, rev, cos, sin } = this;
      for (let i = 0; i < n; i++) {
        re[rev[i]] = input[i];
        im[rev[i]] = 0;
      }
      for (let size = 2; size <= n; size <<= 1) {
        const half = size >>> 1;
        const step = n / size;
        for (let i = 0; i < n; i += size) {
          for (let j = 0, k = 0; j < half; j++, k += step) {
            const a = i + j;
            const b = a + half;
            const tr = re[b] * cos[k] + im[b] * sin[k];
            const ti = im[b] * cos[k] - re[b] * sin[k];
            re[b] = re[a] - tr;
            im[b] = im[a] - ti;
            re[a] += tr;
            im[a] += ti;
          }
        }
      }
      for (let k = 0; k <= n / 2; k++) out[k] = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
    }
  }

  function hann(n) {
    const w = new Float64Array(n);
    for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((TWO_PI * i) / n);
    return w;
  }

  function lowpass(fc, fs, q) {
    const w0 = (TWO_PI * fc) / fs;
    const cw = Math.cos(w0);
    const alpha = Math.sin(w0) / (2 * q);
    const a0 = 1 + alpha;
    return {
      b0: (1 - cw) / 2 / a0,
      b1: (1 - cw) / a0,
      b2: (1 - cw) / 2 / a0,
      a1: (-2 * cw) / a0,
      a2: (1 - alpha) / a0,
      z1: 0,
      z2: 0,
    };
  }

  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

  function median(values) {
    const s = values.slice().sort((a, b) => a - b);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  const PROFILES = [
    {
      major: [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88],
      minor: [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17],
    },
    {
      major: [5.0, 2.0, 3.5, 2.0, 4.5, 4.0, 2.0, 4.5, 2.0, 3.5, 1.5, 4.0],
      minor: [5.0, 2.0, 3.5, 4.5, 2.0, 4.0, 2.0, 4.5, 3.5, 2.0, 1.5, 4.0],
    },
  ].map((set) => {
    const prep = (p) => {
      const mean = p.reduce((a, b) => a + b, 0) / 12;
      const centered = p.map((v) => v - mean);
      const norm = Math.sqrt(centered.reduce((a, b) => a + b * b, 0));
      return { centered, norm };
    };
    return { major: prep(set.major), minor: prep(set.minor) };
  });

  const PT_MAJOR = ['Dó', 'Ré♭', 'Ré', 'Mi♭', 'Mi', 'Fá', 'Fá♯', 'Sol', 'Lá♭', 'Lá', 'Si♭', 'Si'];
  const PT_MINOR = ['Dó', 'Dó♯', 'Ré', 'Mi♭', 'Mi', 'Fá', 'Fá♯', 'Sol', 'Sol♯', 'Lá', 'Si♭', 'Si'];
  const EN_MAJOR = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
  const EN_MINOR = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'B♭', 'B'];
  const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
  const MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10];

  const LETTERS = ['Dó', 'Ré', 'Mi', 'Fá', 'Sol', 'Lá', 'Si'];
  const NATURALS = [0, 2, 4, 5, 7, 9, 11];

  function spellScale(tonicName, pitchClasses) {
    const first = LETTERS.indexOf(tonicName.replace(/[♯♭]/g, ''));
    return pitchClasses.map((pc, i) => {
      const letter = (first + i) % 7;
      const shift = ((pc - NATURALS[letter] + 18) % 12) - 6;
      return LETTERS[letter] + (shift > 0 ? '♯'.repeat(shift) : '♭'.repeat(-shift));
    });
  }

  function describeKey(tonic, mode) {
    const minor = mode === 'minor';
    const relMajor = minor ? (tonic + 3) % 12 : tonic;
    const camelotNumber = ((7 * relMajor + 7) % 12) + 1;
    const relative = minor ? relMajor : (tonic + 9) % 12;
    const scale = (minor ? MINOR_STEPS : MAJOR_STEPS).map((s) => (tonic + s) % 12);
    return {
      tonic,
      mode,
      name: (minor ? PT_MINOR : PT_MAJOR)[tonic] + (minor ? ' menor' : ' maior'),
      short: (minor ? EN_MINOR : EN_MAJOR)[tonic] + (minor ? 'm' : ''),
      camelot: camelotNumber + (minor ? 'A' : 'B'),
      relative: minor
        ? PT_MAJOR[relative] + ' maior'
        : PT_MINOR[relative] + ' menor',
      scale,
      scaleNames: spellScale((minor ? PT_MINOR : PT_MAJOR)[tonic], scale),
    };
  }

  function isNeighborKey(a, b) {
    if (a.tonic === b.tonic) return true;
    const pos = (k) => (7 * (k.mode === 'minor' ? k.tonic + 3 : k.tonic)) % 12;
    const d = Math.abs(pos(a) - pos(b));
    return Math.min(d, 12 - d) <= 1;
  }

  function leadingToneEvidence(chroma, majorTonic) {
    const at = (degree) => chroma[(majorTonic + degree) % 12];
    const background = median([at(1), at(3), at(10)]);
    let diatonic = 0;
    for (const step of MAJOR_STEPS) diatonic += at(step) / 7;
    const span = diatonic - background;
    if (span <= 0) return 0;
    return Math.min(0.3, Math.max(0, (at(8) - background) / span));
  }

  class Analyzer {
    constructor(sampleRate, options = {}) {
      this.inputRate = sampleRate;
      this.decim = Math.max(1, Math.floor(sampleRate / 11000));
      this.sr = sampleRate / this.decim;
      const fc = Math.min(0.42 * this.sr, 0.45 * sampleRate);
      this.filters = [lowpass(fc, sampleRate, 0.5412), lowpass(fc, sampleRate, 1.3066)];
      this.phase = 0;

      this.ringSize = 16384;
      this.mask = this.ringSize - 1;
      this.ring = new Float32Array(this.ringSize);
      this.count = 0;

      this.silenceRms = options.silenceRms ?? 3e-4;
      this.autoResetSilenceSec = options.autoResetSilenceSec ?? 2;

      this.listenBars = options.listenBars ?? 8;
      this.listenFloorSec = options.listenFloorSec ?? 16;
      this.listenCeilSec = options.listenCeilSec ?? 32;
      this.listenDefaultSec = options.listenDefaultSec ?? 24;
      this.listenFixedSec = options.listenFixedSec ?? null;
      this.listenSteadySec = options.listenSteadySec ?? 6;
      this.listenExtraSec = options.listenExtraSec ?? 12;
      this.minorBonus = options.minorBonus ?? 0.5;
      this.driftGap = options.driftGap ?? 0.15;
      this.driftSec = options.driftSec ?? 15;
      this.replaceGap = options.replaceGap ?? 0.08;

      this.onN = 1024;
      this.onHop = 128;
      this.hopSec = this.onHop / this.sr;
      this.fps = this.sr / this.onHop;
      this.onFFT = new FFT(this.onN);
      this.onWin = hann(this.onN);
      this.onFrame = new Float64Array(this.onN);
      this.onMag = new Float64Array(this.onN / 2 + 1);
      this._buildBands();
      this.nextOnset = this.onN;

      this.envCap = 2048;
      this.env = new Float32Array(this.envCap);
      this.tempoWindowSec = 10;
      this.tempoMinSec = 4;
      this.tempoEvery = Math.round(this.fps);
      const maxN = Math.round(this.tempoWindowSec * this.fps);
      this._e = new Float64Array(maxN);
      this._d = new Float64Array(maxN);
      this._prefix = new Float64Array(maxN + 1);

      this.bpmMin = 60;
      this.bpmMax = 200;
      const grid = [];
      for (let b = this.bpmMin; b <= this.bpmMax + 1e-9; b += 0.5) grid.push(b);
      this.grid = Float64Array.from(grid);
      this.prior = this.grid.map((b) => Math.exp(-0.5 * Math.log2(b / 120) ** 2));
      this.lagMax = Math.ceil((4 * 60 * this.fps) / this.bpmMin) + 2;
      this._r = new Float64Array(this.lagMax + 1);
      this._score = new Float64Array(this.grid.length);
      this.tempoHist = new Float64Array(this.grid.length);

      this.keyN = 8192;
      this.keyHop = 2048;
      this.keyHopSec = this.keyHop / this.sr;
      this.keyFFT = new FFT(this.keyN);
      this.keyWin = hann(this.keyN);
      this.keyFrame = new Float64Array(this.keyN);
      this.keyMag = new Float64Array(this.keyN / 2 + 1);
      this.keyPrefix = new Float64Array(this.keyN / 2 + 2);
      this.binHz = this.sr / this.keyN;
      this.kMin = Math.max(2, Math.ceil(50 / this.binHz));
      this.kMax = Math.min(this.keyN / 2 - 2, Math.floor(2100 / this.binHz));
      this.keyDecay = Math.exp(-this.keyHopSec / (options.keyMemorySec ?? 30));
      this.tuneDecay = Math.exp(-this.keyHopSec / 60);
      this.frameChroma = new Float64Array(12);
      this.nextKey = this.keyN;
      this.keyEvery = Math.max(1, Math.round(1 / this.keyHopSec));
      this.sessChroma = new Float64Array(12);

      this.levelDb = -120;
      this.generation = 0;
      this.reset();
    }

    reset() {
      this._resetTempo();
      this.stableBpm = null;
      this.bpmRival = null;
      this.bpmRivalCount = 0;

      this.keyChroma = new Float64Array(12);
      this.keyFrames = 0;
      this.tuneRe = 0;
      this.tuneIm = 0;
      this.tuning = 0;

      this.locked = null;
      this.lockedTuning = 0;
      this.checking = false;
      this.checkReason = null;
      this.drift = 0;
      this.driftNeed = this.driftSec;
      this.keyTick = 0;
      this._newSession();

      this.activeTime = 0;
      this.silentFor = 0;
      this.pendingReset = false;
      this.generation++;
    }

    _resetTempo() {
      this.envCount = 0;
      this.framesSinceTempo = 0;
      this.tempoHist.fill(0);
      this.fineHistory = [];
      this.bpm = null;
      this.bpmStrength = 0;
      this.bpmVotes = 0;
      this.prevBands1 = new Float64Array(this.nBands);
      this.prevBands2 = new Float64Array(this.nBands);
      this.curBands = new Float64Array(this.nBands);
    }

    _newSession() {
      this.sessChroma.fill(0);
      this.sessFrames = 0;
      this.sessSec = 0;
      this.candId = -1;
      this.candSince = 0;
    }

    _afterGap() {
      if (!this.locked) {
        this.reset();
        return;
      }
      this.pendingReset = false;
      this._resetTempo();
      this.keyChroma.fill(0);
      this.keyFrames = 0;
      this.tuneRe = 0;
      this.tuneIm = 0;
      this._startCheck('gap');
    }

    _startCheck(reason) {
      this.checking = true;
      this.checkReason = reason;
      this.drift = 0;
      this._newSession();
    }

    _buildBands() {
      const nyq = this.sr / 2;
      const fLo = 40;
      const fHi = Math.min(nyq * 0.95, 5000);
      const count = 32;
      const binHz = this.sr / this.onN;
      const edges = [];
      for (let i = 0; i <= count; i++) {
        const f = fLo * Math.pow(fHi / fLo, i / count);
        const k = Math.max(1, Math.round(f / binHz));
        if (!edges.length || k > edges[edges.length - 1]) edges.push(k);
      }
      this.bandLo = Int32Array.from(edges.slice(0, -1));
      this.bandHi = Int32Array.from(edges.slice(1));
      this.nBands = this.bandLo.length;
    }

    process(input) {
      const f0 = this.filters[0];
      const f1 = this.filters[1];
      const decim = this.decim;
      const ring = this.ring;
      const mask = this.mask;
      for (let i = 0; i < input.length; i++) {
        let x = input[i];
        let y = f0.b0 * x + f0.z1;
        f0.z1 = f0.b1 * x - f0.a1 * y + f0.z2;
        f0.z2 = f0.b2 * x - f0.a2 * y;
        x = y;
        y = f1.b0 * x + f1.z1;
        f1.z1 = f1.b1 * x - f1.a1 * y + f1.z2;
        f1.z2 = f1.b2 * x - f1.a2 * y;
        if (++this.phase < decim) continue;
        this.phase = 0;
        ring[this.count & mask] = y;
        this.count++;
        if (this.count >= this.nextOnset) {
          this._onsetFrame();
          this.nextOnset += this.onHop;
        }
        if (this.count >= this.nextKey) {
          this._keyFrame();
          this.nextKey += this.keyHop;
        }
      }
    }

    _onsetFrame() {
      const N = this.onN;
      const start = this.count - N;
      const { ring, mask, onWin, onFrame } = this;
      let ss = 0;
      for (let i = 0; i < N; i++) {
        const s = ring[(start + i) & mask];
        ss += s * s;
        onFrame[i] = s * onWin[i];
      }
      this._trackLevel(Math.sqrt(ss / N));
      for (const f of this.filters) {
        if (Math.abs(f.z1) < 1e-25) f.z1 = 0;
        if (Math.abs(f.z2) < 1e-25) f.z2 = 0;
      }

      this.onFFT.magnitudes(onFrame, this.onMag);
      const mag = this.onMag;
      const bands = this.curBands;
      const scale = 1000 / N;
      for (let b = 0; b < this.nBands; b++) {
        let s = 0;
        for (let k = this.bandLo[b]; k < this.bandHi[b]; k++) s += mag[k];
        bands[b] = Math.log1p(s * scale);
      }
      let flux = 0;
      const prev = this.prevBands2;
      for (let b = 0; b < this.nBands; b++) {
        const d = bands[b] - prev[b];
        if (d > 0) flux += d;
      }
      this.prevBands2 = this.prevBands1;
      this.prevBands1 = bands;
      this.curBands = prev;

      if (this.silentFor > 0) flux = 0;
      this.env[this.envCount % this.envCap] = flux;
      this.envCount++;

      if (++this.framesSinceTempo >= this.tempoEvery) {
        this.framesSinceTempo = 0;
        this._estimateTempo();
      }
    }

    _trackLevel(rms) {
      const db = 20 * Math.log10(rms + 1e-9);
      this.levelDb += (db - this.levelDb) * (db > this.levelDb ? 0.5 : 0.04);
      if (rms < this.silenceRms) {
        this.silentFor += this.hopSec;
        if (this.silentFor >= this.autoResetSilenceSec && this.activeTime > 1) this.pendingReset = true;
      } else {
        if (this.pendingReset) this._afterGap();
        this.silentFor = 0;
        this.activeTime += this.hopSec;
      }
    }

    _acfAt(lag) {
      const i = Math.floor(lag);
      if (i < 0 || i + 1 > this._rLen) return 0;
      const f = lag - i;
      return this._r[i] * (1 - f) + this._r[i + 1] * f;
    }

    _estimateTempo() {
      const fps = this.fps;
      const n = Math.min(this.envCount, Math.round(this.tempoWindowSec * fps));
      if (n < this.tempoMinSec * fps) return;

      const e = this._e;
      const d = this._d;
      const P = this._prefix;
      const first = this.envCount - n;
      P[0] = 0;
      for (let i = 0; i < n; i++) {
        e[i] = this.env[(first + i) % this.envCap];
        P[i + 1] = P[i] + e[i];
      }
      const w = Math.max(1, Math.round(0.25 * fps));
      let mean = 0;
      for (let i = 0; i < n; i++) {
        const lo = Math.max(0, i - w);
        const hi = Math.min(n, i + w + 1);
        const v = e[i] - (P[hi] - P[lo]) / (hi - lo);
        d[i] = v > 0 ? v : 0;
        mean += d[i];
      }
      mean /= n;
      for (let i = 0; i < n; i++) d[i] -= mean;

      const L = Math.min(this.lagMax, n - 1);
      const r = this._r;
      for (let l = 0; l <= L; l++) {
        let s = 0;
        for (let i = l; i < n; i++) s += d[i] * d[i - l];
        r[l] = s / (n - l);
      }
      if (r[0] <= 1e-12) return;
      const r0 = r[0];
      for (let l = 0; l <= L; l++) r[l] /= r0;
      this._rLen = L;

      const grid = this.grid;
      const score = this._score;
      let best = 0;
      for (let g = 0; g < grid.length; g++) {
        const T = (60 * fps) / grid[g];
        let s = this._acfAt(T) + 0.5 * this._acfAt(2 * T);
        s = s > 0 ? s * this.prior[g] : 0;
        score[g] = s;
        if (s > best) best = s;
      }
      if (best <= 0) return;
      const hist = this.tempoHist;
      let p = 0;
      for (let g = 0; g < grid.length; g++) {
        hist[g] = hist[g] * 0.8 + score[g] / best;
        if (hist[g] > hist[p]) p = g;
      }
      let coarse = grid[p];
      if (p > 0 && p < grid.length - 1) {
        const a = hist[p - 1];
        const b = hist[p];
        const c = hist[p + 1];
        const den = a - 2 * b + c;
        if (den < 0) coarse += (0.5 * (a - c) / den) * (grid[1] - grid[0]);
      }

      const T0 = (60 * fps) / coarse;
      let num = 0;
      let den = 0;
      let strength = 0;
      let found = 0;
      for (let m = 1; m <= 4; m++) {
        const c = m * T0;
        const tol = Math.max(1, Math.ceil(0.03 * c));
        const lo = Math.max(1, Math.floor(c - tol));
        const hi = Math.min(L - 1, Math.ceil(c + tol));
        if (hi <= lo) break;
        let bi = -1;
        let bv = -Infinity;
        for (let l = lo; l <= hi; l++) {
          if (r[l] > bv) {
            bv = r[l];
            bi = l;
          }
        }
        if (bi <= 0 || bv <= 0 || r[bi] < r[bi - 1] || r[bi] < r[bi + 1]) continue;
        const a = r[bi - 1];
        const cc = r[bi + 1];
        const den2 = a - 2 * bv + cc;
        const lag = bi + (den2 < 0 ? (0.5 * (a - cc)) / den2 : 0);
        num += bv * m * lag;
        den += bv * m * m;
        strength += bv;
        found++;
      }
      if (!found) return;
      const fine = (60 * fps) / (num / den);
      this.fineHistory.push(fine);
      if (this.fineHistory.length > 12) this.fineHistory.shift();
      const consistent = this.fineHistory.filter((b) => Math.abs(b / coarse - 1) < 0.03);
      this.bpm = consistent.length ? median(consistent) : fine;
      this.bpmStrength = strength / found;
      this.bpmVotes = consistent.length;
      this._settleBpm();
    }

    _settleBpm() {
      const live = this.bpm;
      if (live == null || this.bpmVotes < 5) return;
      if (this.stableBpm == null) {
        this.stableBpm = Math.round(live);
        return;
      }
      if (Math.abs(live - this.stableBpm) <= 0.75) {
        this.bpmRival = null;
        this.bpmRivalCount = 0;
        return;
      }
      if (this.bpmRival != null && Math.abs(live - this.bpmRival) <= 0.75) this.bpmRivalCount++;
      else {
        this.bpmRival = live;
        this.bpmRivalCount = 1;
      }
      const ratio = live / this.stableBpm;
      const octave = Math.abs(ratio - 2) < 0.04 || Math.abs(ratio - 0.5) < 0.01;
      if (this.bpmRivalCount >= (octave ? 30 : 8)) {
        this.stableBpm = Math.round(live);
        this.bpmRival = null;
        this.bpmRivalCount = 0;
      }
    }

    _keyFrame() {
      if (this.silentFor > 0.25) return;
      const N = this.keyN;
      const start = this.count - N;
      const { ring, mask, keyWin, keyFrame } = this;
      let ss = 0;
      for (let i = 0; i < N; i++) {
        const s = ring[(start + i) & mask];
        ss += s * s;
        keyFrame[i] = s * keyWin[i];
      }
      if (Math.sqrt(ss / N) < this.silenceRms) return;

      const mag = this.keyMag;
      this.keyFFT.magnitudes(keyFrame, mag);
      const P = this.keyPrefix;
      P[0] = 0;
      for (let k = 0; k < mag.length; k++) P[k + 1] = P[k] + mag[k];

      let maxMag = 0;
      for (let k = this.kMin; k <= this.kMax; k++) if (mag[k] > maxMag) maxMag = mag[k];
      if (maxMag <= 0) return;
      const floor = maxMag * 0.01;

      const fc = this.frameChroma.fill(0);
      const tuning = this.tuning;
      let tRe = 0;
      let tIm = 0;
      for (let k = this.kMin; k <= this.kMax; k++) {
        const m = mag[k];
        if (m < floor || m <= mag[k - 1] || m < mag[k + 1]) continue;
        const W = Math.max(3, Math.round(k * 0.12));
        const lo = Math.max(0, k - W);
        const hi = Math.min(mag.length - 1, k + W);
        const local = (P[hi + 1] - P[lo]) / (hi - lo + 1);
        const excess = m - 2 * local;
        if (excess <= 0) continue;

        const la = Math.log(mag[k - 1] + 1e-12);
        const lb = Math.log(m);
        const lc = Math.log(mag[k + 1] + 1e-12);
        const den = la - 2 * lb + lc;
        const delta = den < 0 ? (0.5 * (la - lc)) / den : 0;
        const f = (k + delta) * this.binHz;
        const pitch = 69 + 12 * Math.log2(f / 440);

        const dev = pitch - Math.round(pitch);
        tRe += excess * Math.cos(TWO_PI * dev);
        tIm += excess * Math.sin(TWO_PI * dev);

        const q = pitch - tuning;
        const note = Math.round(q);
        const c = Math.cos(Math.PI * (q - note));
        fc[((note % 12) + 12) % 12] += excess * c * c;
      }

      let fmax = 0;
      for (let i = 0; i < 12; i++) if (fc[i] > fmax) fmax = fc[i];
      if (fmax <= 0) return;

      const norm = 1 / (tRe * tRe + tIm * tIm > 0 ? Math.hypot(tRe, tIm) : 1);
      this.tuneRe = this.tuneRe * this.tuneDecay + tRe * norm;
      this.tuneIm = this.tuneIm * this.tuneDecay + tIm * norm;
      this.tuning = Math.atan2(this.tuneIm, this.tuneRe) / TWO_PI;

      for (let i = 0; i < 12; i++) this.keyChroma[i] = this.keyChroma[i] * this.keyDecay + fc[i] / fmax;
      this.keyFrames++;

      const listening = !this.locked || this.checking;
      if (listening) {
        for (let i = 0; i < 12; i++) this.sessChroma[i] += fc[i] / fmax;
        this.sessFrames++;
        this.sessSec += this.keyHopSec;
      }
      if (++this.keyTick >= this.keyEvery) {
        this.keyTick = 0;
        if (listening) this._listen();
        else this._watch();
      }
    }

    _listenNeed() {
      if (this.listenFixedSec != null) return this.listenFixedSec;
      let bpm = this.bpmVotes >= 5 ? this.bpm : this.stableBpm;
      if (!bpm) return this.listenDefaultSec;
      while (bpm >= 120) bpm /= 2;
      const sec = (this.listenBars * 4 * 60) / bpm;
      return Math.min(this.listenCeilSec, Math.max(this.listenFloorSec, sec));
    }

    _listen() {
      const scores = this._scoreChroma(this.sessChroma, this.sessFrames);
      if (!scores) return;
      const [best, second] = scores;
      const id = best.tonic + (best.mode === 'minor' ? 12 : 0);
      if (id !== this.candId) {
        this.candId = id;
        this.candSince = this.sessSec;
      }
      const need = this._listenNeed();
      const steady = this.sessSec - this.candSince >= this.listenSteadySec && best.score - second.score >= 0.02;
      if (!(this.sessSec >= need && steady) && this.sessSec < need + this.listenExtraSec) return;

      const lk = this.locked;
      let define = !lk;
      if (lk && (best.tonic !== lk.tonic || best.mode !== lk.mode)) {
        const current = scores.find((s) => s.tonic === lk.tonic && s.mode === lk.mode);
        define = best.score - current.score > this.replaceGap;
      }
      if (define) {
        this.locked = {
          tonic: best.tonic,
          mode: best.mode,
          score: best.score,
          confidence: 0.55 * clamp01((best.score - second.score) / 0.1) + 0.45 * clamp01((best.score - 0.4) / 0.45),
        };
        this.lockedTuning = this.tuning;
        this.driftNeed = this.driftSec;
      } else if (this.checkReason === 'drift') {
        this.driftNeed = Math.min(8 * this.driftSec, this.driftNeed * 2);
      }
      this.checking = false;
      this.checkReason = null;
      this.drift = 0;
    }

    _watch() {
      const scores = this._scoreChroma(this.keyChroma, this.keyFrames);
      if (!scores) return;
      const best = scores[0];
      const lk = this.locked;
      const current = scores.find((s) => s.tonic === lk.tonic && s.mode === lk.mode);
      const dt = this.keyEvery * this.keyHopSec;
      this.driftGapNow = best.score - current.score;
      if (this.driftGapNow <= this.driftGap) {
        this.drift = Math.max(0, this.drift - 2 * dt);
        return;
      }
      this.drift += isNeighborKey(best, lk) ? dt / 3 : dt;
      if (this.drift >= this.driftNeed) this._startCheck('drift');
    }

    _scoreChroma(c, frames) {
      let sum = 0;
      for (let i = 0; i < 12; i++) sum += c[i];
      if (sum <= 0 || frames < 3) return null;
      const mean = sum / 12;
      const cc = new Float64Array(12);
      let cn = 0;
      for (let i = 0; i < 12; i++) {
        cc[i] = c[i] - mean;
        cn += cc[i] * cc[i];
      }
      cn = Math.sqrt(cn);
      if (cn <= 0) return null;

      const scores = [];
      for (const mode of ['major', 'minor']) {
        for (let tonic = 0; tonic < 12; tonic++) {
          let s = 0;
          for (const set of PROFILES) {
            const prof = set[mode];
            let dot = 0;
            for (let pc = 0; pc < 12; pc++) dot += cc[pc] * prof.centered[(pc - tonic + 12) % 12];
            s += dot / (cn * prof.norm);
          }
          scores.push({ tonic, mode, score: s / PROFILES.length });
        }
      }
      scores.sort((a, b) => b.score - a.score);

      const top = scores[0];
      const majorTonic = top.mode === 'major' ? top.tonic : (top.tonic + 3) % 12;
      const bonus = this.minorBonus * leadingToneEvidence(c, majorTonic);
      if (bonus > 0) {
        scores.find((s) => s.mode === 'minor' && s.tonic === (majorTonic + 9) % 12).score += bonus;
        scores.sort((a, b) => b.score - a.score);
      }
      return scores;
    }

    getResult() {
      const lk = this.locked;
      const listening = !lk || this.checking;
      let candidate = null;
      if (listening) {
        const scores = this._scoreChroma(this.sessChroma, this.sessFrames);
        if (scores) candidate = describeKey(scores[0].tonic, scores[0].mode).short;
      }
      return {
        state: !lk ? 'listening' : this.checking ? 'checking' : 'locked',
        progress: listening ? clamp01(this.sessSec / this._listenNeed()) : 1,
        listenLeftSec: listening ? Math.max(0, this._listenNeed() - this.sessSec) : 0,
        listenedSec: this.sessSec,
        key: lk ? { ...describeKey(lk.tonic, lk.mode), score: lk.score, confidence: lk.confidence } : null,
        candidate,
        bpm: this.stableBpm,
        bpmLive: this.bpm,
        tuningCents: Math.round((lk ? this.lockedTuning : this.tuning) * 100),
        analyzedSec: this.activeTime,
        levelDb: this.levelDb,
        silent: this.silentFor > 0.5,
        generation: this.generation,
      };
    }
  }

  const api = { Analyzer, FFT, describeKey, isNeighborKey };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.Ouvidinho = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
