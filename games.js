// GamesController manages rhythm game modes using tap or audio peaks.
const GAME_MODES = {
  HIT: 'HitTheBeat',
  SILENT: 'SilentBars',
  COPY: 'CopyPattern',
};

const BUILT_IN_PATTERNS = [
  { id: 'clave', name: 'Son Clave', subdivision: 16, steps: [1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0] },
  { id: 'sync', name: 'Syncopation', subdivision: 16, steps: [1, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0] },
  { id: 'off', name: 'Off-beat 8ths', subdivision: 8, steps: [0, 1, 0, 1, 0, 1, 0, 1] },
];

export class GamesController {
  constructor(metronome, settingsGetter, statusSetter, resultCb = () => {}) {
    this.metronome = metronome;
    this.getSettings = settingsGetter;
    this.setStatus = statusSetter;
    this.onResult = resultCb;
    this.active = null;
    this.state = {};
  }

  stopGame() {
    this.active = null;
    this.state = {};
    this.setStatus('', 'Game idle');
  }

  startHit(durationSec = 45) {
    this.active = GAME_MODES.HIT;
    this.state = { hits: [], endAt: performance.now() + durationSec * 1000 };
    this.setStatus(GAME_MODES.HIT, 'Hit on every beat!');
  }

  startSilent(leadBars = 2, silentBars = 2) {
    const bpm = this.getSettings().bpm;
    const sig = this.getSettings().timeSignature || '4/4';
    const den = parseInt(sig.split('/')[1], 10) || 4;
    const beatDur = (60000 / bpm) * (4 / den);
    const beatsPerBar = parseInt(this.getSettings().timeSignature.split('/')[0], 10) || 4;
    const totalBeats = (leadBars + silentBars) * beatsPerBar;
    this.active = GAME_MODES.SILENT;
    this.state = {
      leadBeats: leadBars * beatsPerBar,
      silentBeats: silentBars * beatsPerBar,
      totalBeats,
      startTimeMs: null,
      beatDur,
      beatsPerBar,
      taps: [],
    };
    this.setStatus(GAME_MODES.SILENT, `Stay in time during ${silentBars} silent bars`);
  }

  startCopy(patternInput = 'clave') {
    const pattern =
      typeof patternInput === 'object'
        ? patternInput
        : BUILT_IN_PATTERNS.find((p) => p.id === patternInput) || BUILT_IN_PATTERNS[0];
    this.active = GAME_MODES.COPY;
    this.state = { pattern, phase: 'listen', taps: [], listenStart: performance.now(), tapStart: null };
    this.setStatus(GAME_MODES.COPY, `Listen, then tap the pattern: ${pattern.name}`);
    setTimeout(() => {
      if (this.active === GAME_MODES.COPY) {
        this.state.phase = 'tap';
        this.state.tapStart = performance.now();
        this.setStatus(GAME_MODES.COPY, 'Your turn: tap the pattern');
        setTimeout(() => {
          if (this.active === GAME_MODES.COPY) this._finishCopy();
        }, 3000);
      }
    }, 2000);
  }

  onBeat(time) {
    if (!this.active) return;
    if (this.active === GAME_MODES.SILENT) {
      const s = this.state;
      if (!s.startTimeMs) s.startTimeMs = time;
      const beatIndex = Math.round((time - s.startTimeMs) / s.beatDur);
      if (beatIndex >= s.totalBeats) {
        this._finishSilent();
      }
    }
    if (this.active === GAME_MODES.HIT && performance.now() > this.state.endAt) {
      this._finishHit();
    }
  }

  onTap(timeMs, isAudio) {
    if (!this.active) return;
    if (this.active === GAME_MODES.HIT) {
      this._scoreHit(timeMs);
    } else if (this.active === GAME_MODES.SILENT) {
      this._scoreSilent(timeMs, isAudio);
    } else if (this.active === GAME_MODES.COPY) {
      if (this.state.phase === 'tap') this.state.taps.push(timeMs);
    }
  }

  _scoreHit(timeMs) {
    const nearest = this._nearestBeatTime(timeMs);
    if (!nearest) return;
    const err = Math.abs(timeMs - nearest);
    const score = err < 10 ? 100 : err < 25 ? 80 : err < 50 ? 60 : 30;
    this.state.hits.push({ err, score });
    this.setStatus(GAME_MODES.HIT, `Last: ${err.toFixed(0)} ms • Score ${score}`);
  }

  _finishHit() {
    const hits = this.state.hits;
    if (!hits.length) {
      this.setStatus(GAME_MODES.HIT, 'No hits recorded.');
      this.stopGame();
      return;
    }
    const avg = hits.reduce((a, h) => a + h.err, 0) / hits.length;
    const total = hits.reduce((a, h) => a + h.score, 0);
    const grade = total / hits.length >= 90 ? 'S' : total / hits.length >= 75 ? 'A' : total / hits.length >= 60 ? 'B' : 'C';
    this.setStatus(GAME_MODES.HIT, `Avg ${avg.toFixed(1)} ms • Grade ${grade}`);
    const res = { mode: GAME_MODES.HIT, avgError: avg, grade, totalScore: total };
    this.onResult(res);
    this.stopGame();
    return res;
  }

  _scoreSilent(timeMs) {
    const s = this.state;
    if (!s.startTimeMs) return;
    const beatIndex = Math.floor((timeMs - s.startTimeMs) / s.beatDur);
    s.taps.push({ beatIndex, timeMs });
    if (beatIndex >= s.totalBeats) this._finishSilent();
  }

  _finishSilent() {
    const s = this.state;
    const errors = s.taps
      .filter((t) => t.beatIndex >= s.leadBeats)
      .map((t) => {
        const expected = s.startTimeMs + t.beatIndex * s.beatDur;
        return t.timeMs - expected;
      });
    const spread = errors.length ? errors.reduce((a, b) => a + Math.abs(b), 0) / errors.length : 0;
    this.setStatus(GAME_MODES.SILENT, `Drift avg ${spread.toFixed(1)} ms`);
    const res = { mode: GAME_MODES.SILENT, avgDrift: spread };
    this.onResult(res);
    this.stopGame();
    return res;
  }

  _finishCopy() {
    const { pattern, taps } = this.state;
    if (!pattern) return;
    const beats = parseInt((pattern.timeSignature || '4/4').split('/')[0], 10) || 4;
    const den = parseInt((pattern.timeSignature || '4/4').split('/')[1], 10) || 4;
    const beatDurMs = (60000 / this.getSettings().bpm) * (4 / den);
    const barDur = beatDurMs * beats;
    const subDur = barDur / (pattern.steps.length || 1);
    const tapStart = this.state.tapStart || this.state.listenStart || performance.now();
    const expected = pattern.steps
      .map((hit, idx) => (hit ? idx * subDur : null))
      .filter((v) => v !== null);
    const correct = taps.filter((t) => expected.some((e) => Math.abs(t - tapStart - e) < subDur * 0.4));
    const pct = expected.length ? (correct.length / expected.length) * 100 : 0;
    this.setStatus(GAME_MODES.COPY, `Matched ${pct.toFixed(0)}% of hits`);
    const res = { mode: GAME_MODES.COPY, percent: pct };
    this.onResult(res);
    this.stopGame();
    return res;
  }

  finishActive() {
    if (this.active === GAME_MODES.HIT) return this._finishHit();
    if (this.active === GAME_MODES.SILENT) return this._finishSilent();
    if (this.active === GAME_MODES.COPY) return this._finishCopy();
    return null;
  }

  _nearestBeatTime(timeMs) {
    const beats = this.metronome.getRecentBeats();
    if (!beats.length) return null;
    const target = timeMs / 1000;
    let nearest = beats[0].time;
    let min = Math.abs(target - nearest);
    beats.forEach((b) => {
      const diff = Math.abs(target - b.time);
      if (diff < min) {
        min = diff;
        nearest = b.time;
      }
    });
    return nearest * 1000;
  }
}

export { GAME_MODES, BUILT_IN_PATTERNS };
