// TrainerController manages ramp trainer, tempo blocks, and warmup routines.
export class TrainerController {
  constructor(settingsAccessor, bpmSetter, statusUpdater) {
    this.getSettings = settingsAccessor; // () => settings object
    this.setBpm = bpmSetter; // (bpm: number) => void
    this.setStatus = statusUpdater; // (key, text) => void
    this.rampState = null;
    this.blockState = null;
    this.warmups = {};
  }

  onStart() {
    this.rampState = null;
    this.blockState = null;
    const settings = this.getSettings();
    if (settings.trainer.ramp.enabled) {
      this.rampState = {
        barsLeft: settings.trainer.ramp.interval,
        timerStart: Date.now(),
      };
      this.setBpm(settings.trainer.ramp.start);
      this.setStatus('ramp', `Ramp ${settings.trainer.ramp.start}→${settings.trainer.ramp.end}`);
    } else {
      this.setStatus('ramp', 'Off');
    }

    if (settings.trainer.blocksEnabled && settings.trainer.blocks.length) {
      const first = settings.trainer.blocks[0];
      this.blockState = {
        index: 0,
        remaining: first.durationType === 'bars' ? first.durationValue : first.durationValue * 1000,
        mode: first.durationType,
        startedAt: Date.now(),
      };
      this.setBpm(first.bpm);
      this.setStatus('block', `Block 1/${settings.trainer.blocks.length}`);
    } else {
      this.setStatus('block', 'Off');
    }
  }

  onBar(info) {
    if (!info) return;
    this._handleRamp(info);
    this._handleBlocks(info);
  }

  _handleRamp(info) {
    const settings = this.getSettings();
    const ramp = settings.trainer.ramp;
    if (!ramp.enabled || !this.rampState) return;
    if (ramp.mode === 'bars' && !info.countIn) {
      this.rampState.barsLeft -= 1;
      if (this.rampState.barsLeft <= 0) {
        this.rampState.barsLeft = ramp.interval;
        this._stepRamp();
      }
    } else if (ramp.mode === 'seconds') {
      const elapsed = Date.now() - this.rampState.timerStart;
      if (elapsed >= ramp.interval * 1000) {
        this.rampState.timerStart = Date.now();
        this._stepRamp();
      }
    }
  }

  _stepRamp() {
    const settings = this.getSettings();
    const ramp = settings.trainer.ramp;
    const current = settings.bpm;
    let next = current + ramp.step;
    if ((ramp.step > 0 && next > ramp.end) || (ramp.step < 0 && next < ramp.end)) next = ramp.end;
    this.setBpm(next);
    this.setStatus('ramp', `Now ${next} BPM`);
  }

  _handleBlocks(info) {
    const settings = this.getSettings();
    const blocks = settings.trainer.blocks || [];
    if (!settings.trainer.blocksEnabled || !this.blockState || !blocks.length) return;
    if (settings.setlistRun) return;
    const currentBlock = blocks[this.blockState.index];
    if (!currentBlock) {
      this.setStatus('block', 'Done');
      this.blockState = null;
      return;
    }
    if (this.blockState.mode === 'bars' && !info.countIn) {
      this.blockState.remaining -= 1;
    } else if (this.blockState.mode === 'seconds') {
      const elapsed = Date.now() - this.blockState.startedAt;
      this.blockState.remaining = Math.max(0, currentBlock.durationValue * 1000 - elapsed);
    }
    if (this.blockState.remaining <= 0) {
      this.blockState.index += 1;
      const nextBlock = blocks[this.blockState.index];
      if (nextBlock) {
        this.blockState.remaining = nextBlock.durationType === 'bars' ? nextBlock.durationValue : nextBlock.durationValue * 1000;
        this.blockState.mode = nextBlock.durationType;
        this.blockState.startedAt = Date.now();
        this.setBpm(nextBlock.bpm);
        this.setStatus('block', `Block ${this.blockState.index + 1}/${blocks.length} • ${nextBlock.label || ''}`);
      } else {
        this.setStatus('block', 'Done');
        this.blockState = null;
      }
    } else {
      const remainingDisplay =
        this.blockState.mode === 'seconds'
          ? `${Math.max(0, Math.ceil(this.blockState.remaining / 1000))}s`
          : `${this.blockState.remaining} bars`;
      this.setStatus('block', `Block ${this.blockState.index + 1}/${blocks.length} • ${remainingDisplay} remaining`);
    }
  }

  generateWarmup(todayKey, currentBpm, signature) {
    const blocks = [];
    const blockCount = Math.floor(Math.random() * 3) + 3;
    let bpm = currentBpm || 100;
    let sig = signature || '4/4';
    for (let i = 0; i < blockCount; i += 1) {
      bpm = Math.min(300, bpm + Math.floor(Math.random() * 10) + 2);
      if (i === 1) sig = '3/4';
      if (i === 2) sig = '6/8';
      blocks.push({ label: `Block ${i + 1}`, bpm, durationValue: 3 + i, durationType: 'minutes', signature: sig });
    }
    this.warmups[todayKey] = blocks;
    return blocks;
  }
}
