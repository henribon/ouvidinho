class OuvidinhoCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.size = 4096;
    this.buf = new Float32Array(this.size);
    this.n = 0;
  }

  process(inputs) {
    const input = inputs[0];
    const left = input && input[0];
    const right = input && input[1];
    const frames = left ? left.length : 128;
    for (let i = 0; i < frames; i++) {
      this.buf[this.n++] = left ? (right ? 0.5 * (left[i] + right[i]) : left[i]) : 0;
      if (this.n === this.size) {
        this.port.postMessage(this.buf, [this.buf.buffer]);
        this.buf = new Float32Array(this.size);
        this.n = 0;
      }
    }
    return true;
  }
}

registerProcessor('ouvidinho-capture', OuvidinhoCapture);
