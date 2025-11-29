// Metronome engine using Web Audio API scheduling with advanced features.
// This class owns all timing logic; UI code should only call its methods.

const SOUND_PROFILES = {
  woodblock: { accentFreq: 1900, normalFreq: 1500, subFreq: 1200, type: 'square' },
  beep: { accentFreq: 1200, normalFreq: 880, subFreq: 660, type: 'sine' },
  click: { accentFreq: 2600, normalFreq: 2200, subFreq: 1800, type: 'triangle' },
  clave: { accentFreq: 1800, normalFreq: 1400, subFreq: 1000, type: 'sawtooth' },
  cowbell: { accentFreq: 1200, normalFreq: 950, subFreq: 750, type: 'square' },
  ping: { accentFreq: 2300, normalFreq: 2000, subFreq: 1800, type: 'triangle' }, // for phrase/phrase pings
};

const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

export default class Metronome {
  constructor() {
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.audioCtx.createGain();
    this.masterGain.connect(this.audioCtx.destination);

    this.lookahead = 0.02; // seconds
    this.scheduleAheadTime = 0.12; // seconds

    this.bpm = 120;
    this.beatsPerBar = 4;
    this.beatUnit = 4;
    this.timeSignature = '4/4';
    this.beatAccents = ['accent', 'normal', 'normal', 'normal'];
    this.subdivision = 'none';
    this.subdivisionPattern = {
      eighth: ['accent', 'normal'],
      triplet: ['accent', 'normal', 'normal'],
      sixteenth: ['accent', 'normal', 'normal', 'normal'],
      quintuplet: ['accent', 'normal', 'normal', 'normal', 'normal'],
    };
    this.swing = 0; // 0-1
    this.sound = 'woodblock';
    this.soundB = 'beep';
    this.volume = 0.8;
    this.muted = false;
    this.quietMode = false;
    this.grooveChallenge = 0; // 0-1 jitter factor
    this.latencyOffset = 0; // seconds, positive schedules slightly earlier
    this.silentBars = { enabled: false, every: 4 };
    this.phrase = { enabled: false, length: 4, target: 0 };
    this.countInBars = 0;
    this.countInRemaining = 0;
    this.isCountingIn = false;

    this.polyrhythm = {
      enabled: false,
      ratioA: 3,
      ratioB: 2,
      volumeA: 1,
      volumeB: 0.7,
      soundA: 'woodblock',
      soundB: 'beep',
    };
    this.polyState = { intervalA: 0, intervalB: 0, nextA: 0, nextB: 0, bar: -1, start: 0 };

    this.isPlaying = false;
    this.currentBeat = 0;
    this.nextNoteTime = 0;
    this.timerId = null;
    this.onTick = null; // callback for UI updates
    this.onPolyTick = null; // callback for polyrhythm layer updates
    this.onBar = null; // callback when a bar starts

    this.recentBeats = [];
    this.maxRecent = 64;

    this.setVolume(this.volume);
  }

  async start() {
    if (this.isPlaying) return;
    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }

    this.isPlaying = true;
    this.currentBeat = 0;
    this.countInRemaining = this.countInBars;
    this.isCountingIn = this.countInBars > 0;
    this._resetPolyState();
    this.nextNoteTime = this.audioCtx.currentTime + 0.05; // small offset so first beat schedules cleanly
    this.timerId = setInterval(() => this._scheduler(), this.lookahead * 1000);
    this._scheduler(); // prime the scheduler immediately
  }

  stop() {
    this.isPlaying = false;
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  setBpm(bpm) {
    this.bpm = clamp(bpm, 1, 600);
  }

  setTimeSignature(signature) {
    this.timeSignature = signature;
    const beats = parseInt(signature.split('/')[0], 10) || 4;
    const unit = parseInt(signature.split('/')[1], 10) || 4;
    this.beatsPerBar = beats;
    this.beatUnit = unit;
    if (!Array.isArray(this.beatAccents)) {
      this.beatAccents = [];
    }
    if (this.beatAccents.length < beats) {
      while (this.beatAccents.length < beats) {
        this.beatAccents.push('normal');
      }
    } else if (this.beatAccents.length > beats) {
      this.beatAccents = this.beatAccents.slice(0, beats);
    }
    // Always keep first beat accented by default.
    if (this.beatAccents[0] === 'normal' || this.beatAccents[0] === 'mute') {
      this.beatAccents[0] = 'accent';
    }
    this.currentBeat = 0;
  }

  setBeatAccents(accents) {
    const beats = this.beatsPerBar;
    this.beatAccents = accents.slice(0, beats);
    while (this.beatAccents.length < beats) {
      this.beatAccents.push('normal');
    }
    if (this.beatAccents[0] === 'normal' || this.beatAccents[0] === 'mute') {
      this.beatAccents[0] = 'accent';
    }
  }

  setSubdivision(subdivision) {
    this.subdivision = subdivision;
  }

  setSubdivisionPattern(type, pattern) {
    this.subdivisionPattern = {
      ...this.subdivisionPattern,
      [type]: pattern,
    };
  }

  setSwing(amount) {
    this.swing = clamp(amount, 0, 1);
  }

  setGrooveChallenge(amount) {
    this.grooveChallenge = clamp(amount, 0, 1);
  }

  setLatencyOffset(ms) {
    const capped = clamp(ms || 0, -200, 200); // clamp for safety
    this.latencyOffset = capped / 1000;
  }

  setSound(sound) {
    this.sound = SOUND_PROFILES[sound] ? sound : 'woodblock';
  }

  setSecondarySound(sound) {
    this.soundB = SOUND_PROFILES[sound] ? sound : 'beep';
  }

  setVolume(volume) {
    this.volume = clamp(volume, 0, 1);
    const gainValue = this.muted || this.quietMode ? 0 : this.volume;
    this.masterGain.gain.setValueAtTime(gainValue, this.audioCtx.currentTime);
  }

  setMute(isMuted) {
    this.muted = isMuted;
    this.masterGain.gain.setValueAtTime(this.muted || this.quietMode ? 0 : this.volume, this.audioCtx.currentTime);
  }

  setQuietMode(isQuiet) {
    this.quietMode = isQuiet;
    this.masterGain.gain.setValueAtTime(this.muted || this.quietMode ? 0 : this.volume, this.audioCtx.currentTime);
  }

  setSilentBars(config) {
    this.silentBars = config;
  }

  setPhrase(config) {
    this.phrase = config;
  }

  setCountIn(bars) {
    this.countInBars = clamp(parseInt(bars, 10) || 0, 0, 8);
  }

  setPolyrhythm(config) {
    this.polyrhythm = { ...this.polyrhythm, ...config };
    this._resetPolyState();
  }

  _resetPolyState() {
    this.polyState = { intervalA: 0, intervalB: 0, nextA: 0, nextB: 0, bar: -1, start: 0 };
  }

  _scheduler() {
    if (!this.isPlaying) return;

    const ctx = this.audioCtx;
    const horizon = ctx.currentTime + this.scheduleAheadTime;
    const beatDuration = (60 / this.bpm) * (4 / this.beatUnit);

    // Schedule notes slightly ahead of the current time to keep steady timing.
    while (this.nextNoteTime < horizon) {
      const beatInBar = this.currentBeat % this.beatsPerBar;
      const barIndex = Math.floor(this.currentBeat / this.beatsPerBar);
      const barStartTime = this.nextNoteTime - beatInBar * beatDuration;
      const isSilentBar = this.silentBars.enabled && this.silentBars.every > 0 && ((barIndex + 1) % this.silentBars.every === 0);
      const isCountIn = this.isCountingIn;
      const playAudio = !this.muted && !this.quietMode && !isSilentBar;
      const subPattern = this.subdivisionPattern[this.subdivision] || [];
      const totalSubdivisions =
        this.subdivision === 'eighth'
          ? 2
          : this.subdivision === 'triplet'
          ? 3
          : this.subdivision === 'sixteenth'
          ? 4
          : this.subdivision === 'quintuplet'
          ? 5
          : 1;
      const offsetTime = Math.max(ctx.currentTime + 0.001, this.nextNoteTime - this.latencyOffset);

      if (beatInBar === 0) {
        if (typeof this.onBar === 'function') {
          this.onBar({ bar: barIndex, time: this.nextNoteTime, countIn: isCountIn });
        }
        // Prepare polyrhythm schedule for the upcoming bar.
        if (this.polyrhythm.enabled) {
          const barDuration = this.beatsPerBar * beatDuration;
          const validA = Math.max(1, parseFloat(this.polyrhythm.ratioA) || 1);
          const validB = Math.max(1, parseFloat(this.polyrhythm.ratioB) || 1);
          this.polyState = {
            bar: barIndex,
            start: barStartTime,
            end: barStartTime + barDuration,
            intervalA: barDuration / validA,
            intervalB: barDuration / validB,
            nextA: barStartTime,
            nextB: barStartTime,
          };
        }
        // Phrase ping at bar start.
        if (this.phrase.enabled && this.phrase.length > 0 && playAudio) {
          if (barIndex % this.phrase.length === 0) {
            this._scheduleClick(this.nextNoteTime, true, false, { sound: 'ping', gainScale: 0.9 });
          }
        }
      }

      let accentState = this.beatAccents[beatInBar] || 'normal';
      // Apply subdivision accent pattern to the primary hit only if the beat itself is not muted.
      if (totalSubdivisions > 1 && subPattern[0] && accentState !== 'mute') {
        if (subPattern[0] === 'mute') accentState = 'mute';
        else if (subPattern[0] === 'accent') accentState = 'accent';
      }

      if (accentState !== 'mute' && playAudio) {
        this._scheduleClick(offsetTime, accentState === 'accent', false, { sound: this.sound });
      }

      // Subdivisions occur between beats; respect accent patterns and swing.
      const subCount = totalSubdivisions - 1;
      if (subCount > 0) {
        for (let i = 1; i <= subCount; i += 1) {
          const subState = subPattern[i] || 'normal';
          if (subState === 'mute') continue;
          let offset = beatDuration * (i / totalSubdivisions);
          if (this.subdivision === 'eighth' && i === 1 && this.swing > 0) {
            offset += (beatDuration / 2) * 0.6 * this.swing;
          }
          const time = Math.max(ctx.currentTime + 0.001, this.nextNoteTime + offset - this.latencyOffset + this._jitter());
          if (playAudio) {
            this._scheduleClick(time, subState === 'accent', true, { sound: this.sound });
          }
          this._pushRecentBeat(time, barIndex, beatInBar, true);
        }
      }

      if (typeof this.onTick === 'function') {
        this.onTick({ layer: 'main', beat: beatInBar, bar: barIndex, time: this.nextNoteTime, countIn: isCountIn });
      }

      // Track recent beats for adaptive coach.
      this._pushRecentBeat(this.nextNoteTime, barIndex, beatInBar, false);

      this.nextNoteTime += beatDuration;
      this.currentBeat += 1;

      if (isCountIn && beatInBar === this.beatsPerBar - 1) {
        this.countInRemaining -= 1;
        if (this.countInRemaining <= 0) {
          this.isCountingIn = false;
        }
      }
    }

    // Polyrhythm layers: schedule independently of main-beat loop so we never miss mid-beat clicks.
    if (this.polyrhythm.enabled && this.polyState.intervalA && this.polyState.intervalB) {
      this._schedulePolyrhythmLayer('A', horizon, playAudio);
      this._schedulePolyrhythmLayer('B', horizon, playAudio);
    }
  }

  _schedulePolyrhythmLayer(layerKey, horizon, playAudio) {
    const isA = layerKey === 'A';
    const interval = isA ? this.polyState.intervalA : this.polyState.intervalB;
    if (!interval || interval <= 0 || Number.isNaN(interval)) return;
    let next = isA ? this.polyState.nextA : this.polyState.nextB;
    const sound = isA ? this.polyrhythm.soundA : this.polyrhythm.soundB;
    const gainScale = isA ? this.polyrhythm.volumeA : this.polyrhythm.volumeB;
    const ctx = this.audioCtx;

    // Catch up only enough to avoid scheduling in the past.
    const now = ctx.currentTime;
    const start = this.polyState.start || now;
    const barEnd =
      this.polyState.end ||
      start + this.beatsPerBar * ((60 / this.bpm) * (4 / this.beatUnit || 4));
    while (next + 0.0005 < now) {
      next += interval;
    }

    const cutoff = Math.min(horizon, barEnd + 0.0005);
    while (next < cutoff) {
      if (playAudio) {
        const scheduleTime = Math.max(ctx.currentTime + 0.001, next - this.latencyOffset);
        this._scheduleClick(scheduleTime, true, false, { sound, gainScale });
      }
      if (typeof this.onPolyTick === 'function') {
        const idx = Math.round((next - (this.polyState.start || 0)) / interval);
        this.onPolyTick({ layer: isA ? 'A' : 'B', time: next, bar: this.polyState.bar, index: idx });
      }
      next += interval;
    }

    if (isA) {
      this.polyState.nextA = next;
    } else {
      this.polyState.nextB = next;
    }
  }

  _scheduleClick(time, isAccent, isSubdivision, opts = {}) {
    const ctx = this.audioCtx;
    const profile = SOUND_PROFILES[opts.sound] || SOUND_PROFILES[this.sound] || SOUND_PROFILES.woodblock;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const duration = isSubdivision ? 0.04 : 0.07;
    const baseGain = (isSubdivision ? 0.3 : isAccent ? 1 : 0.6) * (opts.gainScale || 1);
    const freq = isSubdivision
      ? profile.subFreq
      : isAccent
      ? profile.accentFreq
      : profile.normalFreq;

    osc.type = profile.type;
    osc.frequency.setValueAtTime(freq, time);

    gain.gain.setValueAtTime(baseGain, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(time);
    osc.stop(time + duration);
  }

  _jitter() {
    if (!this.grooveChallenge) return 0;
    const maxJitter = 0.015 * this.grooveChallenge; // up to ~15ms
    return (Math.random() * 2 - 1) * maxJitter;
  }

  _pushRecentBeat(time, bar, beat, isSubdivision) {
    this.recentBeats.push({ time, bar, beat, isSubdivision });
    if (this.recentBeats.length > this.maxRecent) {
      this.recentBeats.shift();
    }
  }

  getRecentBeats() {
    return [...this.recentBeats];
  }

  previewPattern(pattern, bpm = this.bpm) {
    if (!pattern || !this.audioCtx) return;
    if (this.audioCtx.state === 'suspended') {
      try {
        this.audioCtx.resume();
      } catch (_) {
        // ignore resume issues
      }
    }
    const beats = parseInt(pattern.timeSignature.split('/')[0], 10) || 4;
    const beatDur = 60 / bpm;
    const barDur = beatDur * beats;
    const stepDur = barDur / (pattern.steps.length || 1);
    const start = this.audioCtx.currentTime + 0.05;
    pattern.steps.forEach((hit, idx) => {
      if (!hit) return;
      const time = Math.max(this.audioCtx.currentTime + 0.001, start + idx * stepDur - this.latencyOffset + this._jitter());
      this._scheduleClick(time, hit === 2, false, { sound: this.sound });
    });
  }
}
