// Coach generates summaries and tracks streaks/milestones.
export class Coach {
  constructor(load, save) {
    this.load = load;
    this.save = save;
    this.state = this.load() || { streak: 0, longest: 0, lastDay: null, milestones: [] };
  }

  updateStreak(dateMs) {
    const day = new Date(dateMs).toISOString().slice(0, 10);
    if (this.state.lastDay === day) return;
    if (!this.state.lastDay) {
      this.state.streak = 1;
    } else {
      const prev = new Date(this.state.lastDay);
      const cur = new Date(day);
      const diff = (cur - prev) / (1000 * 60 * 60 * 24);
      if (diff === 1) this.state.streak += 1;
      else this.state.streak = 1;
    }
    this.state.longest = Math.max(this.state.longest, this.state.streak);
    this.state.lastDay = day;
    this._checkMilestones();
    this.save(this.state);
  }

  _checkMilestones() {
    const ms = this.state.milestones;
    const add = (m) => {
      if (!ms.includes(m)) ms.push(m);
    };
    if (this.state.streak === 7) add('1-week streak');
    if (this.state.streak === 14) add('2-week streak');
    if (this.state.streak === 30) add('30-day streak');
  }

  summarizeSession(session, lastSimilar) {
    const parts = [];
    if (session.focusScore < 40) parts.push('Focus was low; try longer runs at one tempo.');
    else if (session.focusScore > 80) parts.push('Great focus today.');
    if (session.extras?.analysis) {
      const a = session.extras.analysis;
      parts.push(`Timing avg ${a.mean} ms, spread ${a.std} ms.`);
    }
    if (session.extras?.game) {
      const g = session.extras.game;
      if (g.mode === 'HitTheBeat') parts.push(`Game: Hit-the-Beat grade ${g.grade}.`);
      else if (g.mode === 'SilentBars') parts.push(`Game: Silent Bars drift ${g.avgDrift?.toFixed?.(1) || 0} ms.`);
      else if (g.mode === 'CopyPattern') parts.push(`Game: Copy Pattern ${g.percent?.toFixed?.(0) || 0}% hits.`);
    }
    if (lastSimilar) {
      if (session.focusScore > lastSimilar.focusScore) parts.push('Focus improved over last similar session.');
      if (session.extras?.analysis && lastSimilar.extras?.analysis) {
        if (session.extras.analysis.std < lastSimilar.extras.analysis.std) parts.push('Timing spread improved.');
      }
    }
    return parts.join(' ');
  }
}
