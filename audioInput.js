// AudioInputAnalyzer: lightweight onset detector using the main AudioContext.
export class AudioInputAnalyzer {
  constructor(audioCtx) {
    this.audioCtx = audioCtx;
    this.stream = null;
    this.source = null;
    this.highpass = null;
    this.analyser = null;
    this.data = null;
    this.raf = null;
    this.onPeak = null;
    this.enabled = false;
    this.threshold = 0.25;
    this.decay = 0.92;
    this.prevLevel = 0;
  }

  async start() {
    if (this.enabled) return true;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.source = this.audioCtx.createMediaStreamSource(this.stream);
      this.highpass = this.audioCtx.createBiquadFilter();
      this.highpass.type = 'highpass';
      this.highpass.frequency.value = 400;
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 512;
      this.data = new Uint8Array(this.analyser.fftSize);
      this.source.connect(this.highpass).connect(this.analyser);
      this.enabled = true;
      this._loop();
      return true;
    } catch (e) {
      this.enabled = false;
      return false;
    }
  }

  stop() {
    this.enabled = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
    }
    this.stream = null;
  }

  _loop() {
    if (!this.enabled) return;
    this.analyser.getByteTimeDomainData(this.data);
    let level = 0;
    for (let i = 0; i < this.data.length; i += 1) {
      const v = (this.data[i] - 128) / 128;
      level += Math.abs(v);
    }
    level /= this.data.length;
    this.prevLevel = this.prevLevel * this.decay + level * (1 - this.decay);
    if (level > this.prevLevel + this.threshold) {
      if (typeof this.onPeak === 'function') {
        this.onPeak(this.audioCtx.currentTime);
      }
      this.prevLevel = level; // reset to avoid double triggers
    }
    this.raf = requestAnimationFrame(() => this._loop());
  }
}
