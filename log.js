// SessionLogger handles session timing, focus score, and stats aggregation.
export class SessionLogger {
  constructor(saveFn, loadFn) {
    this.saveSessions = saveFn;
    this.sessions = loadFn() || [];
    this.sessionMeta = null;
  }

  start(bpm) {
    this.sessionMeta = {
      start: Date.now(),
      bpmHistory: [{ bpm, at: Date.now() }],
      focus: { bpmChanges: 0, longestStretch: 0, currentStretchStart: Date.now() },
    };
  }

  registerBpmChange(nextBpm) {
    if (!this.sessionMeta) return;
    const now = Date.now();
    const history = this.sessionMeta.bpmHistory;
    const last = history[history.length - 1];
    if (last) last.duration = now - last.at;
    history.push({ bpm: nextBpm, at: now });
    const focus = this.sessionMeta.focus;
    focus.bpmChanges += 1;
    const stretch = now - focus.currentStretchStart;
    focus.longestStretch = Math.max(focus.longestStretch, stretch);
    focus.currentStretchStart = now;
  }

  finish(currentBpm, extras = {}) {
    if (!this.sessionMeta) return null;
    const now = Date.now();
    const durationMs = now - this.sessionMeta.start;
    const history = this.sessionMeta.bpmHistory;
    const weighted = history.reduce(
      (acc, sample) => {
        const dur = sample.duration || (now - sample.at);
        return { totalDur: acc.totalDur + dur, weighted: acc.weighted + sample.bpm * dur };
      },
      { totalDur: 0, weighted: 0 },
    );
    const avgBpm = weighted.totalDur ? Math.round(weighted.weighted / weighted.totalDur) : currentBpm;
    const focusScore = this._computeFocusScore(durationMs, this.sessionMeta.focus);
    const session = {
      startedAt: this.sessionMeta.start,
      durationSec: Math.round(durationMs / 1000),
      avgBpm,
      focusScore,
      extras,
    };
    this.sessions = [session, ...this.sessions].slice(0, 500);
    this.saveSessions(this.sessions);
    this.sessionMeta = null;
    return session;
  }

  _computeFocusScore(durationMs, focus) {
    const minutes = durationMs / 60000;
    const stability = Math.min(1, focus.longestStretch / durationMs);
    const changePenalty = Math.max(0, 1 - focus.bpmChanges / 10);
    const durationFactor = Math.min(1, minutes / 20);
    return Math.round(100 * (0.5 * stability + 0.3 * changePenalty + 0.2 * durationFactor));
  }

  getStats() {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const sumDur = (arr) => arr.reduce((acc, s) => acc + (s.durationSec || 0), 0);
    const todaySessions = this.sessions.filter((s) => now - s.startedAt < dayMs);
    const weekSessions = this.sessions.filter((s) => now - s.startedAt < 7 * dayMs);
    const monthSessions = this.sessions.filter((s) => now - s.startedAt < 30 * dayMs);
    return {
      today: { durationMin: Math.round(sumDur(todaySessions) / 60), count: todaySessions.length },
      week: { durationMin: Math.round(sumDur(weekSessions) / 60), count: weekSessions.length },
      month: { durationMin: Math.round(sumDur(monthSessions) / 60), count: monthSessions.length },
      sessions: this.sessions.slice(0, 200),
    };
  }
}
