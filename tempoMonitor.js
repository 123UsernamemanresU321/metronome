// TempoMonitor consumes onsets, aligns them to the metronome grid, and classifies
// timing as in-time / ahead / behind / rushing / slowing.
const STATUS = {
  NO_DATA: 'NO_DATA',
  IN_TIME: 'IN_TIME',
  AHEAD: 'AHEAD',
  BEHIND: 'BEHIND',
  RUSHING: 'RUSHING',
  SLOWING: 'SLOWING',
};

const DEFAULTS = {
  maxOnsets: 32,
  maxDrifts: 20,
  driftToleranceMs: 20,
  offToleranceMs: 40,
  tempoTolerance: 2.5, // BPM tolerance before calling rushing/slowing
  minStableCount: 2,
  minStatusInterval: 0.6, // seconds between status flips
  minDriftsForStatus: 2,
  noDataTimeoutMs: 8000,
};

export class TempoMonitor {
  constructor(metronomeEngine, options = {}) {
    this.metronome = metronomeEngine;
    this.options = { ...DEFAULTS, ...options };
    this.active = false;
    this.onsetTimes = [];
    this.recentDrifts = [];
    this.lastTempoEstimate = null;
    this.statusCallbacks = [];
    this.lastStatus = this._makeStatus(STATUS.NO_DATA);
    this.pendingStatus = STATUS.NO_DATA;
    this.pendingCount = 0;
    this.lastStatusChange = 0;
    this.lastOnsetWallMs = 0;
    this.idleTimer = null;
  }

  start() {
    this.active = true;
    this.onsetTimes = [];
    this.recentDrifts = [];
    this.lastTempoEstimate = null;
    this.pendingStatus = STATUS.NO_DATA;
    this.pendingCount = 0;
    this.lastOnsetWallMs = 0;
    if (this.idleTimer) clearInterval(this.idleTimer);
    this.idleTimer = setInterval(() => this._checkNoData(), 500);
    this._setStatus(this._makeStatus(STATUS.NO_DATA));
  }

  stop() {
    this.active = false;
    this.onsetTimes = [];
    this.recentDrifts = [];
    this.lastTempoEstimate = null;
    if (this.idleTimer) clearInterval(this.idleTimer);
    this.idleTimer = null;
    this._setStatus(this._makeStatus(STATUS.NO_DATA));
  }

  handleOnset(timeInSeconds) {
    if (!this.active) return;
    const params = this.metronome.getParams ? this.metronome.getParams() : null;
    if (!params) return;
    const corrected = timeInSeconds - (params.audioLatencyMs || 0) / 1000;
    this.lastOnsetWallMs = performance.now();

    this.onsetTimes.push(corrected);
    if (this.onsetTimes.length > this.options.maxOnsets) this.onsetTimes.shift();

    const drift = this._calculateDrift(corrected, params);
    if (typeof drift === 'number') {
      this.recentDrifts.push(drift);
      if (this.recentDrifts.length > this.options.maxDrifts) this.recentDrifts.shift();
    }

    this.lastTempoEstimate = this._estimateTempo();
    this._evaluate(params);
  }

  onStatusChange(cb) {
    if (typeof cb === 'function') this.statusCallbacks.push(cb);
  }

  getStatus() {
    return { ...this.lastStatus };
  }

  _estimateTempo() {
    if (this.onsetTimes.length < 3) return null;
    const iois = [];
    for (let i = 1; i < this.onsetTimes.length; i += 1) {
      iois.push(this.onsetTimes[i] - this.onsetTimes[i - 1]);
    }
    const sorted = iois.slice().sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    if (!median || !Number.isFinite(median) || median <= 0) return null;
    return 60 / median;
  }

  _calculateDrift(onsetTime, params) {
    if (!this.metronome.getBeatGridAround) return null;
    const beatDuration = (60 / params.bpm) * (4 / (params.beatUnit || 4));
    const grid = this.metronome.getBeatGridAround(onsetTime, 1.25) || [];
    if (!grid.length) return null;
    let best = null;
    let bestAbs = Infinity;
    grid.forEach((evt) => {
      const delta = onsetTime - evt.time;
      const abs = Math.abs(delta);
      if (abs < bestAbs) {
        bestAbs = abs;
        best = delta;
      }
    });
    if (best === null) return null;
    if (bestAbs > beatDuration / 3) return null; // likely noise, too far from grid
    return best * 1000;
  }

  _evaluate(params) {
    const now = (this.metronome.audioCtx && this.metronome.audioCtx.currentTime) || performance.now() / 1000;
    if (!this.active) {
      this._setStatus(this._makeStatus(STATUS.NO_DATA));
      return;
    }
    if (this.lastOnsetWallMs && performance.now() - this.lastOnsetWallMs > this.options.noDataTimeoutMs) {
      this._setStatus(this._makeStatus(STATUS.NO_DATA));
      return;
    }

    const driftCount = this.recentDrifts.length;
    if (driftCount < this.options.minDriftsForStatus) {
      this._setStatus(this._makeStatus(STATUS.NO_DATA));
      return;
    }
    const avgDriftMs = this.recentDrifts.reduce((a, b) => a + b, 0) / driftCount;
    const playerBpm = this.lastTempoEstimate;
    const targetBpm = params.bpm;

    let statusCode = STATUS.IN_TIME;
    const driftAbs = Math.abs(avgDriftMs);
    if (!Number.isFinite(playerBpm)) {
      statusCode = driftAbs <= this.options.driftToleranceMs ? STATUS.IN_TIME : avgDriftMs < 0 ? STATUS.AHEAD : STATUS.BEHIND;
    } else if (playerBpm > targetBpm + this.options.tempoTolerance && avgDriftMs < -this.options.driftToleranceMs) {
      statusCode = STATUS.RUSHING;
    } else if (playerBpm < targetBpm - this.options.tempoTolerance && avgDriftMs > this.options.driftToleranceMs) {
      statusCode = STATUS.SLOWING;
    } else if (driftAbs <= this.options.driftToleranceMs) {
      statusCode = STATUS.IN_TIME;
    } else if (avgDriftMs < -this.options.driftToleranceMs) {
      statusCode = STATUS.AHEAD;
    } else if (avgDriftMs > this.options.driftToleranceMs) {
      statusCode = STATUS.BEHIND;
    }

    // Require some stability before flipping status to avoid jitter.
    if (statusCode !== this.pendingStatus) {
      this.pendingStatus = statusCode;
      this.pendingCount = 1;
    } else {
      this.pendingCount += 1;
    }
    const stableEnough = this.pendingCount >= this.options.minStableCount || statusCode === STATUS.NO_DATA;
    const spacingEnough = now - this.lastStatusChange >= this.options.minStatusInterval;
    if (stableEnough && spacingEnough) {
      this._setStatus(this._makeStatus(statusCode, avgDriftMs, targetBpm, playerBpm));
      this.lastStatusChange = now;
    }
  }

  _checkNoData() {
    if (!this.active) return;
    if (!this.lastOnsetWallMs) return;
    if (performance.now() - this.lastOnsetWallMs > this.options.noDataTimeoutMs) {
      this.recentDrifts = [];
      this.onsetTimes = [];
      this._setStatus(this._makeStatus(STATUS.NO_DATA));
    }
  }

  _makeStatus(code, avgDriftMs = null, targetBpm = null, playerBpm = null) {
    const roundedDrift = avgDriftMs !== null ? Math.round(avgDriftMs) : null;
    const deltaBpm = playerBpm && targetBpm ? playerBpm - targetBpm : null;
    const tempoDelta = deltaBpm !== null ? Math.round(deltaBpm * 10) / 10 : null;

    let text = 'Waiting for clear hits...';
    let color = 'grey';
    if (code === STATUS.IN_TIME) {
      text = 'In time';
      color = 'green';
    } else if (code === STATUS.AHEAD && roundedDrift !== null) {
      text = `Slightly ahead (~${Math.abs(roundedDrift)} ms early)`;
      color = 'yellow';
    } else if (code === STATUS.BEHIND && roundedDrift !== null) {
      text = `Slightly behind (~${roundedDrift} ms late)`;
      color = 'yellow';
    } else if (code === STATUS.RUSHING) {
      text =
        tempoDelta !== null && tempoDelta > 0
          ? `Rushing (~${Math.abs(tempoDelta)} BPM faster)`
          : 'Rushing';
      color = 'red';
    } else if (code === STATUS.SLOWING) {
      text =
        tempoDelta !== null && tempoDelta < 0
          ? `Slowing (~${Math.abs(tempoDelta)} BPM slower)`
          : 'Slowing';
      color = 'red';
    }

    return {
      active: this.active,
      playerBpm: playerBpm ? Math.round(playerBpm * 10) / 10 : null,
      targetBpm: targetBpm || null,
      avgDriftMs: roundedDrift,
      statusCode: code,
      statusText: text,
      color,
    };
  }

  _setStatus(status) {
    this.lastStatus = status;
    this.statusCallbacks.forEach((cb) => {
      try {
        cb({ ...status });
      } catch (e) {
        // ignore callback failures
      }
    });
  }
}
