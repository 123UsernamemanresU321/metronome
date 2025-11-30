// AudioInputDetector: microphone capture + simple energy-based onset detection.
// It tracks a smoothed baseline level and emits onsets when the short-term energy
// crosses a dynamic threshold and respects a refractory window.
const DEFAULT_OPTIONS = {
  minInterval: 0.1, // seconds between onsets to avoid double triggers
  thresholdFactor: 3, // multiplier over baseline energy
  smoothing: 0.995, // baseline decay; closer to 1 = slower updates
  fftSize: 1024,
  filterFrequency: 120,
};

export class AudioInputDetector {
  constructor(audioCtx, options = {}) {
    this.audioCtx = audioCtx;
    this.options = { ...DEFAULT_OPTIONS, ...options };

    this.stream = null;
    this.source = null;
    this.filter = null;
    this.processor = null;
    this.silence = null;

    this.onsetCallbacks = [];
    this.enabled = false;
    this.lastOnsetTime = 0;
    this.baselineEnergy = 0;
  }

  isSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  async start() {
    if (this.enabled) return true;
    if (!this.isSupported()) return false;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.source = this.audioCtx.createMediaStreamSource(this.stream);
      this.filter = this.audioCtx.createBiquadFilter();
      this.filter.type = 'highpass';
      this.filter.frequency.value = this.options.filterFrequency;
      this.processor = this.audioCtx.createScriptProcessor(this.options.fftSize, this.source.channelCount || 1, 1);
      // Keep processor running with a silent sink.
      this.silence = this.audioCtx.createGain();
      this.silence.gain.value = 0;

      this.source.connect(this.filter);
      this.filter.connect(this.processor);
      this.processor.connect(this.silence);
      this.silence.connect(this.audioCtx.destination);

      this.processor.onaudioprocess = (ev) => this._handleAudio(ev);
      this.enabled = true;
      this.baselineEnergy = 0;
      this.lastOnsetTime = 0;
      return true;
    } catch (e) {
      this.stop();
      return false;
    }
  }

  stop() {
    this.enabled = false;
    if (this.processor) this.processor.disconnect();
    if (this.silence) this.silence.disconnect();
    if (this.filter) this.filter.disconnect();
    if (this.source) this.source.disconnect();
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
    }
    this.stream = null;
    this.source = null;
    this.filter = null;
    this.processor = null;
    this.silence = null;
    this.baselineEnergy = 0;
  }

  onOnset(callback) {
    if (typeof callback === 'function') this.onsetCallbacks.push(callback);
  }

  _emitOnset(payload) {
    this.onsetCallbacks.forEach((cb) => {
      try {
        cb(payload);
      } catch (e) {
        // ignore callback errors
      }
    });
  }

  _handleAudio(event) {
    if (!this.enabled) return;
    const input = event.inputBuffer;
    const channels = [];
    for (let c = 0; c < input.numberOfChannels; c += 1) {
      channels.push(input.getChannelData(c));
    }
    const frames = input.length;
    if (!frames || !channels.length) return;

    let energy = 0;
    for (let i = 0; i < frames; i += 1) {
      let sample = 0;
      for (let c = 0; c < channels.length; c += 1) {
        sample += channels[c][i];
      }
      sample /= channels.length;
      energy += sample * sample;
    }
    energy /= frames;

    // Initialize baseline quickly on first frames.
    if (this.baselineEnergy === 0) this.baselineEnergy = energy;
    this.baselineEnergy =
      this.baselineEnergy * this.options.smoothing + energy * (1 - this.options.smoothing);

    const threshold = this.baselineEnergy * this.options.thresholdFactor + 1e-7;
    const now = this.audioCtx.currentTime;
    if (energy > threshold && now - this.lastOnsetTime > this.options.minInterval) {
      this.lastOnsetTime = now;
      this._emitOnset({ time: now, energy });
      // Raise the baseline briefly after an onset to reduce double triggers.
      this.baselineEnergy = Math.max(this.baselineEnergy, energy);
    }
  }
}

// Export legacy name for backward compatibility.
export { AudioInputDetector as AudioInputAnalyzer };
