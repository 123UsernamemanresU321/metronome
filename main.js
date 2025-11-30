import Metronome from './metronome.js';
import { TrainerController } from './trainer.js';
import { SessionLogger } from './log.js';
import {
  loadSettings,
  saveSettings,
  loadPresets,
  savePresets,
  loadSetlists,
  saveSetlists,
  loadSessions,
  saveSessions,
  loadWarmups,
  saveWarmups,
  exportAll,
  importAll,
  loadVersion,
  saveVersion,
  loadPatterns,
  savePatterns,
  loadCoach,
  saveCoach,
  loadProfilesMeta,
  saveProfilesMeta,
  loadCurrentProfileId,
  saveCurrentProfileId,
  saveProfileBundle,
  deleteProfileBundle,
} from './storage.js';
import { setErrorText, trapFocus } from './ui.js';
import { AudioInputDetector } from './audioInput.js';
import { TempoMonitor } from './tempoMonitor.js';
import { GamesController, GAME_MODES } from './games.js';
import { DEFAULT_PATTERNS, createEmptyPattern, toggleStep } from './patterns.js';
import { Coach } from './coach.js';

const APP_VERSION = 3;

const DEFAULT_SETTINGS = {
  bpm: 120,
  timeSignature: '4/4',
  beatAccents: ['accent', 'normal', 'normal', 'normal'],
  subdivision: 'none',
  subdivisionPattern: {
    eighth: ['accent', 'normal'],
    triplet: ['accent', 'normal', 'normal'],
    sixteenth: ['accent', 'normal', 'normal', 'normal'],
    quintuplet: ['accent', 'normal', 'normal', 'normal', 'normal'],
  },
  swing: 0,
  sound: 'woodblock',
  volume: 0.8,
  mute: false,
  quietMode: false,
  theme: 'dark',
  countIn: { enabled: false, bars: 1 },
  grooveChallenge: 0,
  polyrhythm: {
    enabled: false,
    ratioA: 3,
    ratioB: 2,
    volumeA: 1,
    volumeB: 0.7,
    soundA: 'woodblock',
    soundB: 'beep',
  },
  silentBars: { enabled: false, every: 4 },
  phrase: { enabled: false, length: 4, target: 0 },
  trainer: {
    ramp: { enabled: false, start: 100, end: 140, step: 2, interval: 4, mode: 'bars' },
    blocks: [],
    blocksEnabled: false,
  },
  latency: { measuredMs: 0, manualMs: 0 },
  micMonitorEnabled: false,
  midi: { enabled: false, tapNote: 60, transportNote: 62, inputId: null },
  helperSeen: false,
  debugEnabled: false,
};

const MOOD_MAP = {
  Calm: { range: [60, 80], signature: '3/4' },
  Focused: { range: [90, 110], signature: '4/4' },
  Energetic: { range: [120, 150], signature: '4/4' },
  'Nervous Performance': { range: [100, 120], signature: '2/4' },
  'Warm-up': { range: [70, 90], signature: '4/4' },
};

const metronome = new Metronome();
const logger = new SessionLogger(saveSessions, loadSessions);
const trainer = new TrainerController(
  () => state.settings,
  (bpm) => setBpmFromInput(bpm),
  (key, text) => {
    if (key === 'ramp') elements.rampStatus.textContent = text;
    if (key === 'block') elements.blockStatus.textContent = text;
  },
);
const audioInput = new AudioInputDetector(metronome.audioCtx);
const tempoMonitor = new TempoMonitor(metronome);
const games = new GamesController(
  metronome,
  () => state.settings,
  (mode, text) => {
    if (mode === GAME_MODES.HIT) elements.gameHitStatus.textContent = text;
    else if (mode === GAME_MODES.SILENT) elements.gameSilentStatus.textContent = text;
    else if (mode === GAME_MODES.COPY) elements.gameCopyStatus.textContent = text;
    else {
      elements.gameHitStatus.textContent = text;
      elements.gameSilentStatus.textContent = text;
      elements.gameCopyStatus.textContent = text;
    }
  },
  (res) => {
    state.lastGameResult = res;
  },
);
const coach = new Coach(loadCoach, saveCoach);

const elements = {
  bpmDisplay: document.getElementById('bpmDisplay'),
  bpmInput: document.getElementById('bpmInput'),
  bpmSlider: document.getElementById('bpmSlider'),
  bpmUp: document.getElementById('bpmUp'),
  bpmDown: document.getElementById('bpmDown'),
  bpmError: document.getElementById('bpmError'),
  timeSignature: document.getElementById('timeSignature'),
  customTimeNum: document.getElementById('customTimeNum'),
  customTimeDen: document.getElementById('customTimeDen'),
  subdivision: document.getElementById('subdivision'),
  beatIndicators: document.getElementById('beatIndicators'),
  pulse: document.getElementById('pulse'),
  startStop: document.getElementById('startStop'),
  elapsedTime: document.getElementById('elapsedTime'),
  tapTempo: document.getElementById('tapTempo'),
  tapBpm: document.getElementById('tapBpm'),
  soundSelect: document.getElementById('soundSelect'),
  volume: document.getElementById('volume'),
  muteToggle: document.getElementById('muteToggle'),
  themeToggle: document.getElementById('themeToggle'),
  quietToggle: document.getElementById('quietToggle'),
  presetName: document.getElementById('presetName'),
  savePreset: document.getElementById('savePreset'),
  presetList: document.getElementById('presetList'),
  swingSlider: document.getElementById('swingSlider'),
  swingValue: document.getElementById('swingValue'),
  countInToggle: document.getElementById('countInToggle'),
  countInBars: document.getElementById('countInBars'),
  grooveSlider: document.getElementById('grooveSlider'),
  grooveLabel: document.getElementById('grooveLabel'),
  subdivisionPattern: document.getElementById('subdivisionPattern'),
  setlistName: document.getElementById('setlistName'),
  setlistPresetSelect: document.getElementById('setlistPresetSelect'),
  setlistDurationValue: document.getElementById('setlistDurationValue'),
  setlistDurationType: document.getElementById('setlistDurationType'),
  addSetlistItem: document.getElementById('addSetlistItem'),
  setlistSelect: document.getElementById('setlistSelect'),
  newSetlist: document.getElementById('newSetlist'),
  deleteSetlist: document.getElementById('deleteSetlist'),
  playSetlist: document.getElementById('playSetlist'),
  stopSetlist: document.getElementById('stopSetlist'),
  setlistItems: document.getElementById('setlistItems'),
  setlistStatus: document.getElementById('setlistStatus'),
  rampStart: document.getElementById('rampStart'),
  rampEnd: document.getElementById('rampEnd'),
  rampStep: document.getElementById('rampStep'),
  rampInterval: document.getElementById('rampInterval'),
  rampMode: document.getElementById('rampMode'),
  rampEnable: document.getElementById('rampEnable'),
  rampStatus: document.getElementById('rampStatus'),
  rampInfo: document.getElementById('rampInfo'),
  blockBpm: document.getElementById('blockBpm'),
  blockDuration: document.getElementById('blockDuration'),
  blockType: document.getElementById('blockType'),
  blockLabel: document.getElementById('blockLabel'),
  blockToggle: document.getElementById('blockToggle'),
  addBlock: document.getElementById('addBlock'),
  blockList: document.getElementById('blockList'),
  blockStatus: document.getElementById('blockStatus'),
  blockInfo: document.getElementById('blockInfo'),
  polyToggle: document.getElementById('polyToggle'),
  polyRatio: document.getElementById('polyRatio'),
  polyVolA: document.getElementById('polyVolA'),
  polyVolB: document.getElementById('polyVolB'),
  polySoundA: document.getElementById('polySoundA'),
  polySoundB: document.getElementById('polySoundB'),
  polyDotsA: document.getElementById('polyDotsA'),
  polyDotsB: document.getElementById('polyDotsB'),
  rhythmMapMain: document.getElementById('rhythmMapMain'),
  rhythmMapPoly: document.getElementById('rhythmMapPoly'),
  sessionLog: document.getElementById('sessionLog'),
  statToday: document.getElementById('statToday'),
  stat7: document.getElementById('stat7'),
  stat30: document.getElementById('stat30'),
  coachTap: document.getElementById('coachTap'),
  coachFeedback: document.getElementById('coachFeedback'),
  nudgeUp: document.getElementById('nudgeUp'),
  nudgeDown: document.getElementById('nudgeDown'),
  moodSelect: document.getElementById('moodSelect'),
  moodSuggestion: document.getElementById('moodSuggestion'),
  applyMood: document.getElementById('applyMood'),
  silentBarsToggle: document.getElementById('silentBarsToggle'),
  silentBarsEvery: document.getElementById('silentBarsEvery'),
  phraseToggle: document.getElementById('phraseToggle'),
  phraseLength: document.getElementById('phraseLength'),
  phraseTarget: document.getElementById('phraseTarget'),
  phraseStatus: document.getElementById('phraseStatus'),
  generateWarmup: document.getElementById('generateWarmup'),
  regenWarmup: document.getElementById('regenWarmup'),
  warmupList: document.getElementById('warmupList'),
  exportData: document.getElementById('exportData'),
  importData: document.getElementById('importData'),
  confirmImport: document.getElementById('confirmImport'),
  dataArea: document.getElementById('dataArea'),
  importError: document.getElementById('importError'),
  tabButtons: document.querySelectorAll('.tab-buttons button'),
  tabPanels: document.querySelectorAll('.tab-panel'),
  offlineBadge: document.getElementById('offlineBadge'),
  audioStatus: document.getElementById('audioStatus'),
  audioHelp: document.getElementById('audioHelp'),
  latencyMeasured: document.getElementById('latencyMeasured'),
  latencyAdjust: document.getElementById('latencyAdjust'),
  latencyApplied: document.getElementById('latencyApplied'),
  startCalibration: document.getElementById('startCalibration'),
  tapCalibration: document.getElementById('tapCalibration'),
  micToggle: document.getElementById('micToggle'),
  micStatus: document.getElementById('micStatus'),
  micTargetBpm: document.getElementById('micTargetBpm'),
  micPlayerBpm: document.getElementById('micPlayerBpm'),
  micDrift: document.getElementById('micDrift'),
  micVerdict: document.getElementById('micVerdict'),
  micMonitorCard: document.getElementById('micMonitorCard'),
  micMonitorNote: document.getElementById('micMonitorNote'),
  midiStatus: document.getElementById('midiStatus'),
  midiInputSelect: document.getElementById('midiInputSelect'),
  midiTapNote: document.getElementById('midiTapNote'),
  midiTransportNote: document.getElementById('midiTransportNote'),
  applyMidi: document.getElementById('applyMidi'),
  midiMappingInfo: document.getElementById('midiMappingInfo'),
  showHelper: document.getElementById('showHelper'),
  helperOverlay: document.getElementById('helperOverlay'),
  helperDontShow: document.getElementById('helperDontShow'),
  closeHelper: document.getElementById('closeHelper'),
  debugToggle: document.getElementById('debugToggle'),
  debugPanel: document.getElementById('debugPanel'),
  debugTiming: document.getElementById('debugTiming'),
  debugBeats: document.getElementById('debugBeats'),
  debugState: document.getElementById('debugState'),
  profileSelect: document.getElementById('profileSelect'),
  addProfile: document.getElementById('addProfile'),
  renameProfile: document.getElementById('renameProfile'),
  deleteProfile: document.getElementById('deleteProfile'),
  profileInstrument: document.getElementById('profileInstrument'),
  gameHitDuration: document.getElementById('gameHitDuration'),
  startGameHit: document.getElementById('startGameHit'),
  gameHitStatus: document.getElementById('gameHitStatus'),
  gameSilentLead: document.getElementById('gameSilentLead'),
  gameSilentBars: document.getElementById('gameSilentBars'),
  startGameSilent: document.getElementById('startGameSilent'),
  gameSilentStatus: document.getElementById('gameSilentStatus'),
  gameCopyPattern: document.getElementById('gameCopyPattern'),
  startGameCopy: document.getElementById('startGameCopy'),
  gameCopyStatus: document.getElementById('gameCopyStatus'),
  patternName: document.getElementById('patternName'),
  patternSig: document.getElementById('patternSig'),
  patternSubdivision: document.getElementById('patternSubdivision'),
  newPattern: document.getElementById('newPattern'),
  savePattern: document.getElementById('savePattern'),
  deletePattern: document.getElementById('deletePattern'),
  previewPattern: document.getElementById('previewPattern'),
  patternGrid: document.getElementById('patternGrid'),
  patternList: document.getElementById('patternList'),
  practiceChart: document.getElementById('practiceChart'),
  timingChart: document.getElementById('timingChart'),
};

const state = {
  profileId: loadCurrentProfileId(),
  profiles: loadProfilesMeta(),
  settings: normalizeSettings(loadSettings(DEFAULT_SETTINGS)),
  presets: migratePresets(loadPresets()),
  setlists: loadSetlists(),
  sessions: loadSessions(),
  warmups: loadWarmups(),
  patterns: loadPatterns().length ? loadPatterns() : DEFAULT_PATTERNS.map((p) => ({ ...p, steps: [...p.steps] })),
  isRunning: false,
  taps: [],
  timerStart: null,
  timerInterval: null,
  setlistRun: null,
  coachOffsets: [],
  barCounter: 0,
  polyCounters: { A: -1, B: -1 },
  calibration: { active: false, taps: [] },
  midi: { supported: false, access: null, input: null, clockTicks: [] },
  mic: { supported: true, permissionDenied: false, lastHitAt: 0, hits: 0 },
  debugInterval: null,
  helperTrap: null,
  analysis: { hits: [] },
  lastGameResult: null,
  focus: { currentStretchStart: 0, longestStretch: 0, bpmChanges: 0, samples: [] },
  currentPatternId: null,
};

function normalizeSettings(settings) {
  const merged = { ...DEFAULT_SETTINGS, ...settings };
  merged.countIn = { ...DEFAULT_SETTINGS.countIn, ...(settings.countIn || {}) };
  merged.polyrhythm = { ...DEFAULT_SETTINGS.polyrhythm, ...(settings.polyrhythm || {}) };
  merged.silentBars = { ...DEFAULT_SETTINGS.silentBars, ...(settings.silentBars || {}) };
  merged.phrase = { ...DEFAULT_SETTINGS.phrase, ...(settings.phrase || {}) };
  merged.trainer = { ...DEFAULT_SETTINGS.trainer, ...(settings.trainer || {}) };
  merged.trainer.ramp = { ...DEFAULT_SETTINGS.trainer.ramp, ...((settings.trainer && settings.trainer.ramp) || {}) };
  merged.trainer.blocks = settings.trainer && settings.trainer.blocks ? settings.trainer.blocks : [];
  merged.trainer.blocksEnabled = settings.trainer && typeof settings.trainer.blocksEnabled === 'boolean' ? settings.trainer.blocksEnabled : false;
  merged.subdivisionPattern = { ...DEFAULT_SETTINGS.subdivisionPattern, ...(settings.subdivisionPattern || {}) };
  merged.latency = { ...DEFAULT_SETTINGS.latency, ...(settings.latency || {}) };
  merged.micMonitorEnabled = !!settings.micMonitorEnabled;
  merged.midi = { ...DEFAULT_SETTINGS.midi, ...(settings.midi || {}) };
  merged.helperSeen = !!settings.helperSeen;
  merged.debugEnabled = !!settings.debugEnabled;
  return merged;
}

function migratePresets(presets) {
  return presets.map((p) => {
    if (p.settings) return p;
    const settings = normalizeSettings({ ...DEFAULT_SETTINGS, ...p });
    return { name: p.name || 'Preset', settings };
  });
}

function migrateVersion() {
  const stored = loadVersion();
  if (stored !== APP_VERSION) {
    saveVersion(APP_VERSION);
  }
}

function applySettingsToEngine() {
  const s = state.settings;
  metronome.setTimeSignature(s.timeSignature);
  metronome.setBeatAccents(s.beatAccents || []);
  metronome.setSubdivision(s.subdivision);
  Object.keys(s.subdivisionPattern || {}).forEach((key) => metronome.setSubdivisionPattern(key, s.subdivisionPattern[key]));
  metronome.setSwing((s.swing || 0) / 100);
  metronome.setSound(s.sound);
  metronome.setVolume(s.volume);
  metronome.setMute(s.mute);
  metronome.setQuietMode(!!s.quietMode);
  metronome.setGrooveChallenge((s.grooveChallenge || 0) / 100);
  metronome.setPolyrhythm(s.polyrhythm);
  metronome.setSilentBars(s.silentBars);
  metronome.setPhrase(s.phrase);
  metronome.setCountIn(s.countIn.enabled ? s.countIn.bars : 0);
  metronome.setBpm(s.bpm);
  metronome.setLatencyOffset((s.latency.measuredMs || 0) + (s.latency.manualMs || 0));
}

function applySettingsToUI() {
  const s = state.settings;
  updateBpmUI(s.bpm);
  elements.timeSignature.value = s.timeSignature;
  if (!Array.from(elements.timeSignature.options).some((o) => o.value === s.timeSignature)) {
    elements.timeSignature.value = 'custom';
  }
  if (elements.customTimeNum && elements.customTimeDen) {
    const [num, den] = s.timeSignature.split('/').map((n) => parseInt(n, 10));
    elements.customTimeNum.value = num || 4;
    elements.customTimeDen.value = den || 4;
    const customRow = document.getElementById('customTimeControls');
    if (customRow) customRow.classList.toggle('active', elements.timeSignature.value === 'custom');
  }
  elements.subdivision.value = s.subdivision;
  elements.soundSelect.value = s.sound;
  elements.volume.value = s.volume;
  elements.muteToggle.classList.toggle('active', s.mute);
  elements.muteToggle.setAttribute('aria-pressed', s.mute);
  elements.swingSlider.value = s.swing;
  elements.swingValue.textContent = `${s.swing}%`;
  elements.countInToggle.checked = s.countIn.enabled;
  elements.countInBars.value = s.countIn.bars;
  elements.grooveSlider.value = s.grooveChallenge || 0;
  updateGrooveLabel();
  elements.polyToggle.checked = s.polyrhythm.enabled;
  elements.polyRatio.value = `${s.polyrhythm.ratioA}:${s.polyrhythm.ratioB}`;
  elements.polyVolA.value = s.polyrhythm.volumeA;
  elements.polyVolB.value = s.polyrhythm.volumeB;
  elements.polySoundA.value = s.polyrhythm.soundA;
  elements.polySoundB.value = s.polyrhythm.soundB;
  elements.rampStart.value = s.trainer.ramp.start;
  elements.rampEnd.value = s.trainer.ramp.end;
  elements.rampStep.value = s.trainer.ramp.step;
  elements.rampInterval.value = s.trainer.ramp.interval;
  elements.rampMode.value = s.trainer.ramp.mode;
  elements.rampEnable.checked = !!s.trainer.ramp.enabled;
  elements.blockToggle.checked = !!s.trainer.blocksEnabled;
  elements.silentBarsToggle.checked = s.silentBars.enabled;
  elements.silentBarsEvery.value = s.silentBars.every;
  elements.phraseToggle.checked = s.phrase.enabled;
  elements.phraseLength.value = s.phrase.length;
  elements.phraseTarget.value = s.phrase.target;
  elements.quietToggle.classList.toggle('active', s.quietMode);
  elements.quietToggle.setAttribute('aria-pressed', s.quietMode);
  elements.latencyMeasured.textContent = `${s.latency.measuredMs} ms`;
  elements.latencyAdjust.value = s.latency.manualMs || 0;
  elements.latencyApplied.textContent = `${(s.latency.measuredMs || 0) + (s.latency.manualMs || 0)} ms`;
  elements.midiTapNote.value = s.midi.tapNote;
  elements.midiTransportNote.value = s.midi.transportNote;
  elements.showHelper.checked = !s.helperSeen;
  elements.debugToggle.checked = s.debugEnabled;
  if (elements.micToggle) elements.micToggle.checked = !!s.micMonitorEnabled;
  document.body.classList.toggle('theme-light', s.theme === 'light');
  document.body.classList.toggle('theme-dark', s.theme !== 'light');
  updateThemeButton();
}

function saveSettingsNow() {
  saveSettings(state.settings);
}

function clampBpm(bpm) {
  return Math.min(Math.max(Math.round(bpm), 1), 600);
}

function beatDurationMs(sig, bpm) {
  const [, denRaw] = (sig || '4/4').split('/');
  const den = parseInt(denRaw, 10) || 4;
  return (60000 / bpm) * (4 / den);
}

function normalizeAccents() {
  const beats = parseInt(state.settings.timeSignature.split('/')[0], 10) || 4;
  const accents = (state.settings.beatAccents || []).slice(0, beats);
  while (accents.length < beats) accents.push('normal');
  if (accents[0] !== 'accent') accents[0] = 'accent';
  state.settings.beatAccents = accents;
}

function updateBpmUI(bpm) {
  elements.bpmDisplay.textContent = bpm.toString();
  elements.bpmInput.value = bpm;
  elements.bpmSlider.value = bpm;
}

function setBpmFromInput(value) {
  const bpm = clampBpm(Number(value) || state.settings.bpm);
  if (value < 1 || value > 600) {
    setErrorText(elements.bpmError, 'BPM clamped to 1–600');
  } else {
    setErrorText(elements.bpmError, '');
  }
  registerBpmChange(bpm);
  state.settings.bpm = bpm;
  metronome.setBpm(bpm);
  updateBpmUI(bpm);
  updateMicMonitorUI();
  saveSettingsNow();
}

function changeBpm(delta) {
  setBpmFromInput(state.settings.bpm + delta);
}

function setTimeSignature(sig) {
  let nextSig = sig;
  if (sig === 'custom' && elements.customTimeNum && elements.customTimeDen) {
    const num = Math.max(1, parseInt(elements.customTimeNum.value, 10) || 4);
    const den = Math.max(1, parseInt(elements.customTimeDen.value, 10) || 4);
    nextSig = `${num}/${den}`;
    if (elements.timeSignature) elements.timeSignature.value = 'custom';
  }
  state.settings.timeSignature = nextSig;
  const beats = parseInt(nextSig.split('/')[0], 10) || 4;
  const accents = (state.settings.beatAccents || []).slice(0, beats);
  while (accents.length < beats) accents.push('normal');
  if (accents[0] !== 'accent') accents[0] = 'accent';
  state.settings.beatAccents = accents;
  metronome.setTimeSignature(nextSig);
  metronome.setBeatAccents(accents);
  buildBeatIndicators();
  buildSubdivisionPatternUI();
  renderRhythmMap();
  const customRow = document.getElementById('customTimeControls');
  if (customRow) customRow.classList.toggle('active', sig === 'custom');
  saveSettingsNow();
}

function setSubdivision(sub) {
  state.settings.subdivision = sub;
  metronome.setSubdivision(sub);
  buildSubdivisionPatternUI();
  renderRhythmMap();
  saveSettingsNow();
}

function setSound(sound) {
  state.settings.sound = sound;
  metronome.setSound(sound);
  saveSettingsNow();
}

function setVolume(value) {
  const vol = Math.max(0, Math.min(1, parseFloat(value) || state.settings.volume));
  state.settings.volume = vol;
  metronome.setVolume(vol);
  saveSettingsNow();
}

function toggleMute(force) {
  if (typeof force === 'boolean') {
    state.settings.mute = force;
  } else {
    state.settings.mute = !state.settings.mute;
  }
  metronome.setMute(state.settings.mute);
  elements.muteToggle.classList.toggle('active', state.settings.mute);
  elements.muteToggle.setAttribute('aria-pressed', state.settings.mute);
  saveSettingsNow();
}

function toggleQuietMode() {
  state.settings.quietMode = !state.settings.quietMode;
  metronome.setQuietMode(state.settings.quietMode);
  elements.quietToggle.classList.toggle('active', state.settings.quietMode);
  elements.quietToggle.setAttribute('aria-pressed', state.settings.quietMode);
  saveSettingsNow();
}

function toggleTheme() {
  state.settings.theme = state.settings.theme === 'light' ? 'dark' : 'light';
  document.body.classList.toggle('theme-light', state.settings.theme === 'light');
  document.body.classList.toggle('theme-dark', state.settings.theme !== 'light');
  updateThemeButton();
  saveSettingsNow();
}

function updateThemeButton() {
  const isLight = state.settings.theme === 'light';
  elements.themeToggle.textContent = isLight ? '☀️ Light' : '🌙 Dark';
}

function buildBeatIndicators() {
  elements.beatIndicators.innerHTML = '';
  const beats = parseInt(state.settings.timeSignature.split('/')[0], 10) || 4;
  const accents = state.settings.beatAccents || [];
  for (let i = 0; i < beats; i += 1) {
    const btn = document.createElement('button');
    btn.className = `beat-dot ${accents[i] || 'normal'}`;
    btn.textContent = i + 1;
    btn.dataset.index = i.toString();
    btn.title = 'Click to cycle Accent / Normal / Mute';
    btn.addEventListener('click', () => {
      const index = parseInt(btn.dataset.index, 10);
      cycleAccent(index);
    });
    elements.beatIndicators.appendChild(btn);
  }
}

function cycleAccent(index) {
  const current = state.settings.beatAccents[index] || 'normal';
  const next = current === 'accent' ? 'normal' : current === 'normal' ? 'mute' : 'accent';
  state.settings.beatAccents[index] = next;
  if (index === 0 && next !== 'accent') {
    state.settings.beatAccents[0] = 'accent';
  }
  metronome.setBeatAccents(state.settings.beatAccents);
  buildBeatIndicators();
  saveSettingsNow();
}

function buildSubdivisionPatternUI() {
  const container = elements.subdivisionPattern;
  if (!container) return;
  container.innerHTML = '';
  const type = state.settings.subdivision;
  if (type === 'none') {
    container.textContent = 'No subdivision';
    return;
  }
  const count = type === 'eighth' ? 2 : type === 'triplet' ? 3 : type === 'sixteenth' ? 4 : type === 'quintuplet' ? 5 : 0;
  const pattern = (state.settings.subdivisionPattern && state.settings.subdivisionPattern[type]) || [];
  while (pattern.length < count) {
    pattern.push(pattern.length === 0 ? 'accent' : 'normal');
  }
  for (let i = 0; i < count; i += 1) {
    const btn = document.createElement('button');
    btn.className = `beat-dot compact ${pattern[i] || 'normal'}`;
    btn.textContent = type === 'eighth' ? (i === 0 ? '1' : '&') : `${i + 1}`;
    btn.addEventListener('click', () => {
      const current = pattern[i] || 'normal';
      const next = current === 'accent' ? 'normal' : current === 'normal' ? 'mute' : 'accent';
      pattern[i] = next;
      state.settings.subdivisionPattern[type] = [...pattern];
      metronome.setSubdivisionPattern(type, state.settings.subdivisionPattern[type]);
      buildSubdivisionPatternUI();
      saveSettingsNow();
    });
    container.appendChild(btn);
  }
}

function handleTick({ layer, beat, bar, countIn, time }) {
  if (layer === 'main') {
    state.barCounter = bar;
    const dots = elements.beatIndicators.querySelectorAll('.beat-dot');
    dots.forEach((dot, idx) => dot.classList.toggle('playing', idx === beat));
    if (elements.pulse) {
      elements.pulse.classList.remove('active');
      void elements.pulse.offsetWidth;
      elements.pulse.classList.add('active');
    }
    renderRhythmMap(beat, countIn);
    games.onBeat((time || metronome.nextNoteTime) * 1000);
  }
}

function handlePolyTick({ layer, index }) {
  const dots = layer === 'A' ? elements.polyDotsA?.querySelectorAll('.beat-dot') : elements.polyDotsB?.querySelectorAll('.beat-dot');
  if (!dots || !dots.length) return;
  dots.forEach((dot) => dot.classList.remove('playing'));
  const count = dots.length;
  const idx = typeof index === 'number' ? index % count : ((state.polyCounters[layer] + 1) % count);
  state.polyCounters[layer] = idx;
  dots[idx].classList.add('playing');
}

function toggleStartStop() {
  if (state.isRunning) {
    const res = games.finishActive();
    if (res) state.lastGameResult = res;
    metronome.stop();
    state.isRunning = false;
    elements.startStop.textContent = 'Start';
    elements.startStop.setAttribute('aria-label', 'Start metronome');
    stopTimer();
    clearPlayingState();
    finishSessionLog();
    stopSetlist();
    if (state.settings.micMonitorEnabled) {
      tempoMonitor.stop();
      updateMicMonitorUI();
      if (elements.micMonitorNote) elements.micMonitorNote.textContent = 'Metronome stopped.';
    }
  } else {
    if (state.settings.quietMode) toggleQuietMode();
    if (state.settings.mute) toggleMute(false);
    metronome.start();
    state.isRunning = true;
    elements.startStop.textContent = 'Stop';
    elements.startStop.setAttribute('aria-label', 'Stop metronome');
    state.polyCounters = { A: -1, B: -1 };
    state.analysis.hits = [];
    resetTimer();
    startTimer();
    startSessionLog();
    trainer.onStart();
    if (state.settings.micMonitorEnabled && audioInput.enabled) {
      tempoMonitor.start();
      updateMicMonitorUI();
      setMicStatus('Mic on • listening', 'green');
    }
  }
}

function clearPlayingState() {
  const dots = elements.beatIndicators.querySelectorAll('.beat-dot');
  dots.forEach((dot) => dot.classList.remove('playing'));
  elements.pulse.classList.remove('active');
}

function resetTimer() {
  state.timerStart = Date.now();
  state.focus.currentStretchStart = Date.now();
  state.focus.longestStretch = 0;
  state.focus.bpmChanges = 0;
  state.focus.samples = [{ bpm: state.settings.bpm, from: Date.now() }];
  updateElapsedTime();
}

function startTimer() {
  if (state.timerInterval) clearInterval(state.timerInterval);
  state.timerInterval = setInterval(updateElapsedTime, 500);
}

function stopTimer() {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
}

function updateElapsedTime() {
  if (!state.timerStart) return;
  const elapsedMs = Date.now() - state.timerStart;
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  elements.elapsedTime.textContent = `${hours}:${minutes}:${seconds}`;
}

function handleTap() {
  processTap(performance.now(), false);
}

function processTap(timeMs, isAudio) {
  const lastTap = state.taps[state.taps.length - 1];
  if (lastTap && timeMs - lastTap > 2000) state.taps = [];
  state.taps.push(timeMs);
  if (state.taps.length > 8) state.taps.shift();
  if (!isAudio) {
    if (state.taps.length >= 3) {
      const intervals = [];
      for (let i = 1; i < state.taps.length; i += 1) intervals.push(state.taps[i] - state.taps[i - 1]);
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const bpm = clampBpm(60000 / avg);
      elements.tapBpm.textContent = bpm.toFixed(0);
      setBpmFromInput(bpm);
    } else {
      elements.tapBpm.textContent = '--';
    }
  }
  recordTimingError(timeMs);
  games.onTap(timeMs, isAudio);
}

function renderPresets() {
  elements.presetList.innerHTML = '';
  if (!state.presets.length) {
    const empty = document.createElement('li');
    empty.className = 'preset-empty';
    empty.textContent = 'No presets yet. Save one to get started.';
    elements.presetList.appendChild(empty);
    return;
  }
  state.presets.forEach((preset, index) => {
    const li = document.createElement('li');
    const info = document.createElement('div');
    info.className = 'preset-info';
    const s = preset.settings || {};
    info.innerHTML = `<strong>${preset.name}</strong><span>${s.bpm || '--'} BPM • ${s.timeSignature || ''} • ${s.subdivision || ''}</span>`;
    const actions = document.createElement('div');
    actions.className = 'preset-actions';
    const loadBtn = document.createElement('button');
    loadBtn.className = 'pill-btn';
    loadBtn.textContent = 'Load';
    loadBtn.addEventListener('click', () => loadPreset(index));
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'ghost-btn small';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', () => deletePreset(index));
    actions.append(loadBtn, deleteBtn);
    li.append(info, actions);
    elements.presetList.appendChild(li);
  });
  renderSetlistPresetPicker();
}

function savePreset() {
  const name = elements.presetName.value.trim() || `Preset ${state.presets.length + 1}`;
  const preset = { name, settings: { ...state.settings } };
  state.presets.push(preset);
  savePresets(state.presets);
  renderPresets();
  elements.presetName.value = '';
}

function loadPreset(index) {
  const preset = state.presets[index];
  if (!preset) return;
  state.settings = normalizeSettings({ ...state.settings, ...(preset.settings || preset) });
  normalizeAccents();
  applySettingsToEngine();
  applySettingsToUI();
  buildBeatIndicators();
  buildSubdivisionPatternUI();
  renderRhythmMap();
  saveSettingsNow();
}

function deletePreset(index) {
  state.presets.splice(index, 1);
  savePresets(state.presets);
  renderPresets();
}

function renderSetlistPresetPicker() {
  elements.setlistPresetSelect.innerHTML = '';
  state.presets.forEach((p, idx) => {
    const opt = document.createElement('option');
    opt.value = idx;
    opt.textContent = p.name;
    elements.setlistPresetSelect.appendChild(opt);
  });
}

function createNewSetlist() {
  const name = elements.setlistName.value.trim() || `Setlist ${state.setlists.length + 1}`;
  const newList = { id: Date.now(), name, items: [] };
  state.setlists.push(newList);
  saveSetlists(state.setlists);
  renderSetlists();
  elements.setlistName.value = '';
}

function renderSetlists() {
  elements.setlistSelect.innerHTML = '';
  state.setlists.forEach((list, idx) => {
    const opt = document.createElement('option');
    opt.value = idx;
    opt.textContent = list.name;
    elements.setlistSelect.appendChild(opt);
  });
  if (state.setlists.length && elements.setlistSelect.selectedIndex === -1) elements.setlistSelect.selectedIndex = 0;
  renderSetlistItems();
}

function getActiveSetlist() {
  const idx = parseInt(elements.setlistSelect.value, 10);
  return state.setlists[idx];
}

function renderSetlistItems() {
  elements.setlistItems.innerHTML = '';
  const setlist = getActiveSetlist();
  if (!setlist || !setlist.items || !setlist.items.length) {
    const li = document.createElement('li');
    li.className = 'preset-empty';
    li.textContent = 'No items yet.';
    elements.setlistItems.appendChild(li);
    return;
  }
  setlist.items.forEach((item, idx) => {
    const li = document.createElement('li');
    const info = document.createElement('div');
    info.className = 'preset-info';
    const presetName = state.presets[item.presetIndex]?.name || 'Preset';
    info.innerHTML = `<strong>${presetName}</strong><span>${item.durationValue} ${item.durationType}</span>`;
    const actions = document.createElement('div');
    actions.className = 'preset-actions';
    const up = document.createElement('button');
    up.className = 'ghost-btn small';
    up.textContent = 'Up';
    up.addEventListener('click', () => moveSetlistItem(idx, -1));
    const down = document.createElement('button');
    down.className = 'ghost-btn small';
    down.textContent = 'Down';
    down.addEventListener('click', () => moveSetlistItem(idx, 1));
    const del = document.createElement('button');
    del.className = 'ghost-btn small';
    del.textContent = 'Delete';
    del.addEventListener('click', () => deleteSetlistItem(idx));
    actions.append(up, down, del);
    li.append(info, actions);
    elements.setlistItems.appendChild(li);
  });
}

function addSetlistItem() {
  let setlist = getActiveSetlist();
  if (!setlist) {
    createNewSetlist();
    renderSetlists();
    setlist = getActiveSetlist();
  }
  const presetIndex = parseInt(elements.setlistPresetSelect.value, 10);
  if (Number.isNaN(presetIndex)) return;
  const durationValue = Math.max(1, parseInt(elements.setlistDurationValue.value, 10) || 1);
  const durationType = elements.setlistDurationType.value;
  setlist.items.push({ presetIndex, durationValue, durationType });
  saveSetlists(state.setlists);
  renderSetlistItems();
}

function moveSetlistItem(idx, delta) {
  const setlist = getActiveSetlist();
  if (!setlist) return;
  const newIdx = idx + delta;
  if (newIdx < 0 || newIdx >= setlist.items.length) return;
  const [item] = setlist.items.splice(idx, 1);
  setlist.items.splice(newIdx, 0, item);
  saveSetlists(state.setlists);
  renderSetlistItems();
}

function deleteSetlistItem(idx) {
  const setlist = getActiveSetlist();
  if (!setlist) return;
  setlist.items.splice(idx, 1);
  saveSetlists(state.setlists);
  renderSetlistItems();
}

function deleteSetlist() {
  const idx = parseInt(elements.setlistSelect.value, 10);
  if (Number.isNaN(idx)) return;
  state.setlists.splice(idx, 1);
  saveSetlists(state.setlists);
  renderSetlists();
}

function playSetlist() {
  const setlist = getActiveSetlist();
  if (!setlist || !setlist.items.length) return;
  state.setlistRun = { listIndex: parseInt(elements.setlistSelect.value, 10), itemIndex: 0, startedAt: Date.now(), remaining: null };
  elements.setlistStatus.textContent = `Running: ${setlist.name}`;
  loadSetlistItem();
  if (!state.isRunning) toggleStartStop();
}

function stopSetlist() {
  state.setlistRun = null;
  elements.setlistStatus.textContent = 'Idle';
}

function loadSetlistItem() {
  if (!state.setlistRun) return;
  const setlist = state.setlists[state.setlistRun.listIndex];
  if (!setlist) return;
  const item = setlist.items[state.setlistRun.itemIndex];
  if (!item) {
    stopSetlist();
    return;
  }
  loadPreset(item.presetIndex);
  state.setlistRun.remaining = item.durationType === 'bars' ? item.durationValue : item.durationValue * 1000;
  state.setlistRun.durationType = item.durationType;
  state.setlistRun.startedAt = Date.now();
  elements.setlistStatus.textContent = `${setlist.name} • Item ${state.setlistRun.itemIndex + 1}/${setlist.items.length}`;
}

function handleSetlistProgress(barInfo) {
  if (!state.setlistRun) return;
  const setlist = state.setlists[state.setlistRun.listIndex];
  const item = setlist?.items[state.setlistRun.itemIndex];
  if (!item) {
    stopSetlist();
    return;
  }
  if (item.durationType === 'bars' && barInfo && !barInfo.countIn) {
    state.setlistRun.remaining -= 1;
    if (state.setlistRun.remaining <= 0) {
      state.setlistRun.itemIndex += 1;
      loadSetlistItem();
    }
  } else if (item.durationType === 'seconds') {
    const elapsed = Date.now() - state.setlistRun.startedAt;
    if (elapsed >= state.setlistRun.remaining) {
      state.setlistRun.itemIndex += 1;
      loadSetlistItem();
    }
  }
}

function initializeTrainers() {
  state.rampState = null;
  state.blockState = null;
  if (state.settings.trainer.ramp.enabled) {
    state.rampState = {
      nextTarget: state.settings.trainer.ramp.start,
      interval: state.settings.trainer.ramp.interval,
      mode: state.settings.trainer.ramp.mode,
      step: state.settings.trainer.ramp.step,
      end: state.settings.trainer.ramp.end,
      timerStart: Date.now(),
      barsLeft: state.settings.trainer.ramp.interval,
    };
    setBpmFromInput(state.settings.trainer.ramp.start);
    elements.rampStatus.textContent = `Ramp ${state.settings.trainer.ramp.start}→${state.settings.trainer.ramp.end}`;
  } else {
    elements.rampStatus.textContent = 'Off';
  }

  if (state.settings.trainer.blocks && state.settings.trainer.blocks.length && (elements.blockToggle.checked || state.settings.trainer.blocksEnabled)) {
    const first = state.settings.trainer.blocks[0];
    state.blockState = {
      index: 0,
      remaining: first.durationType === 'bars' ? first.durationValue : first.durationValue * 1000,
      mode: first.durationType,
      startedAt: Date.now(),
    };
    setBpmFromInput(first.bpm);
    elements.blockStatus.textContent = `Block 1/${state.settings.trainer.blocks.length}`;
  } else {
    elements.blockStatus.textContent = 'Off';
  }
}

function handleRamp(barInfo) {
  const ramp = state.rampState;
  if (!ramp || !state.settings.trainer.ramp.enabled) return;
  if (state.setlistRun || state.blockState) return;
  if (ramp.mode === 'bars' && barInfo && !barInfo.countIn) {
    ramp.barsLeft -= 1;
    if (ramp.barsLeft <= 0) {
      ramp.barsLeft = state.settings.trainer.ramp.interval;
      stepRamp();
    }
  } else if (ramp.mode === 'seconds') {
    const elapsed = Date.now() - ramp.timerStart;
    if (elapsed >= state.settings.trainer.ramp.interval * 1000) {
      ramp.timerStart = Date.now();
      stepRamp();
    }
  }
}

function stepRamp() {
  const ramp = state.settings.trainer.ramp;
  const current = state.settings.bpm;
  let next = current + ramp.step;
  if ((ramp.step > 0 && next > ramp.end) || (ramp.step < 0 && next < ramp.end)) next = ramp.end;
  setBpmFromInput(next);
  elements.rampInfo.textContent = `Now ${next} BPM`;
}

function handleBlocks(barInfo) {
  const blocks = state.settings.trainer.blocks || [];
  const blockState = state.blockState;
  if (!blockState || !elements.blockToggle.checked || !blocks.length) return;
  if (state.setlistRun) return;
  const currentBlock = blocks[blockState.index];
  if (!currentBlock) {
    elements.blockStatus.textContent = 'Done';
    state.blockState = null;
    return;
  }
  if (blockState.mode === 'bars' && barInfo && !barInfo.countIn) {
    blockState.remaining -= 1;
  } else if (blockState.mode === 'seconds') {
    const elapsed = Date.now() - blockState.startedAt;
    blockState.remaining = Math.max(0, currentBlock.durationValue * 1000 - elapsed);
  }
  if (blockState.remaining <= 0) {
    blockState.index += 1;
    const nextBlock = blocks[blockState.index];
    if (nextBlock) {
      blockState.remaining = nextBlock.durationType === 'bars' ? nextBlock.durationValue : nextBlock.durationValue * 1000;
      blockState.mode = nextBlock.durationType;
      blockState.startedAt = Date.now();
      setBpmFromInput(nextBlock.bpm);
      elements.blockStatus.textContent = `Block ${blockState.index + 1}/${blocks.length} • ${nextBlock.label || ''}`;
    } else {
      elements.blockStatus.textContent = 'Done';
      state.blockState = null;
    }
  } else {
    const remainingDisplay = blockState.mode === 'seconds' ? `${Math.max(0, Math.ceil(blockState.remaining / 1000))}s` : `${blockState.remaining} bars`;
    elements.blockStatus.textContent = `Block ${blockState.index + 1}/${blocks.length} • ${remainingDisplay} remaining`;
  }
}

function renderBlocks() {
  const list = elements.blockList;
  list.innerHTML = '';
  const blocks = state.settings.trainer.blocks || [];
  if (!blocks.length) {
    const empty = document.createElement('li');
    empty.className = 'preset-empty';
    empty.textContent = 'No blocks yet.';
    list.appendChild(empty);
    return;
  }
  blocks.forEach((b, idx) => {
    const li = document.createElement('li');
    li.className = 'compact';
    const info = document.createElement('div');
    info.className = 'preset-info';
    info.innerHTML = `<strong>${b.label || 'Block'}</strong><span>${b.bpm} BPM • ${b.durationValue} ${b.durationType}</span>`;
    const actions = document.createElement('div');
    actions.className = 'preset-actions';
    const del = document.createElement('button');
    del.className = 'ghost-btn small';
    del.textContent = 'Delete';
    del.addEventListener('click', () => {
      blocks.splice(idx, 1);
      state.settings.trainer.blocks = blocks;
      renderBlocks();
      saveSettingsNow();
    });
    actions.append(del);
    li.append(info, actions);
    list.append(li);
  });
}

function renderPolyrhythmDots() {
  const ratio = (elements.polyRatio.value || '3:2').trim();
  const parts = ratio.split(':').map((n) => parseInt(n, 10));
  const a = Math.max(1, parts[0] || 3);
  const b = Math.max(1, parts[1] || 2);
  const makeDots = (container, count) => {
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < count; i += 1) {
      const dot = document.createElement('div');
      dot.className = 'beat-dot tiny';
      dot.textContent = i + 1;
      container.appendChild(dot);
    }
  };
  makeDots(elements.polyDotsA, a);
  makeDots(elements.polyDotsB, b);
  if (elements.rhythmMapPoly) {
    elements.rhythmMapPoly.innerHTML = '';
    [a, b].forEach((count, idx) => {
      const row = document.createElement('div');
      row.className = 'inline-group';
      row.innerHTML = `<span class="label">Layer ${idx === 0 ? 'A' : 'B'}</span>`;
      const dotWrap = document.createElement('div');
      dotWrap.className = 'beat-indicators compact';
      for (let i = 0; i < count; i += 1) {
        const d = document.createElement('div');
        d.className = 'beat-dot tiny';
        d.textContent = i + 1;
        dotWrap.appendChild(d);
      }
      row.appendChild(dotWrap);
      elements.rhythmMapPoly.appendChild(row);
    });
  }
}

function handleBar(info) {
  if (state.settings.polyrhythm.enabled) state.polyCounters = { A: -1, B: -1 };
  handleSetlistProgress(info);
  trainer.onBar(info);
  updatePhraseStatus(info);
  if (state.calibration.active) updateCalibrationWithBeat(info);
  updateDebug();
}

function renderRhythmMap(activeBeat = null, countIn = false) {
  const beats = parseInt(state.settings.timeSignature.split('/')[0], 10) || 4;
  const subdivision = state.settings.subdivision;
  const subCount =
    subdivision === 'eighth'
      ? 2
      : subdivision === 'triplet'
      ? 3
      : subdivision === 'sixteenth'
      ? 4
      : subdivision === 'quintuplet'
      ? 5
      : 1;
  const container = elements.rhythmMapMain;
  if (!container) return;
  container.innerHTML = '';
  for (let b = 0; b < beats; b += 1) {
    const col = document.createElement('div');
    col.className = 'grid-cell';
    if (activeBeat === b) {
      col.classList.add('active');
      if (countIn) col.classList.add('count-in');
    }
    const subWrap = document.createElement('div');
    subWrap.className = 'sub-grid';
    for (let s = 0; s < subCount; s += 1) {
      const sub = document.createElement('span');
      sub.className = 'sub-cell';
      subWrap.appendChild(sub);
    }
    col.appendChild(subWrap);
    container.appendChild(col);
  }
}

function renderStats() {
  const stats = logger.getStats();
  state.sessions = stats.sessions;
  elements.statToday.textContent = `${stats.today.durationMin} min (${stats.today.count} sessions)`;
  elements.stat7.textContent = `${stats.week.durationMin} min (${stats.week.count})`;
  elements.stat30.textContent = `${stats.month.durationMin} min (${stats.month.count})`;
  renderLog();
  const streak = coach.state;
  const milestone = (streak.milestones || []).slice(-1)[0];
  elements.coachFeedback.textContent = `Streak: ${streak.streak} days (longest ${streak.longest})` + (milestone ? ` • ${milestone}` : '');
  renderPracticeChart(stats);
  renderTimingChart();
}

function renderPracticeChart() {
  const svg = elements.practiceChart;
  if (!svg) return;
  const sessions = state.sessions || [];
  const days = 30;
  const dayMs = 24 * 60 * 60 * 1000;
  const today = new Date();
  const data = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = new Date(today);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - i);
    const start = day.getTime();
    const end = start + dayMs;
    const minutes = sessions
      .filter((s) => s.startedAt >= start && s.startedAt < end)
      .reduce((acc, s) => acc + (s.durationSec || 0) / 60, 0);
    data.push({ label: day.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' }), minutes });
  }
  const max = Math.max(...data.map((d) => d.minutes), 1);
  const width = Math.max(320, data.length * 8 + 20);
  const height = 160;
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.innerHTML = '';
  const axis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  axis.setAttribute('x1', '6');
  axis.setAttribute('x2', String(width - 6));
  axis.setAttribute('y1', String(height - 12));
  axis.setAttribute('y2', String(height - 12));
  axis.setAttribute('stroke-width', '1');
  axis.style.stroke = 'var(--border)';
  svg.appendChild(axis);
  data.forEach((d, idx) => {
    const barW = 6;
    const x = 8 + idx * (barW + 2);
    const h = Math.max(2, (d.minutes / max) * (height - 24));
    const y = height - 12 - h;
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', barW);
    rect.setAttribute('height', h);
    rect.setAttribute('opacity', '0.85');
    rect.style.fill = 'var(--accent)';
    rect.setAttribute('aria-label', `${d.label}: ${d.minutes.toFixed(1)} minutes`);
    svg.appendChild(rect);
  });
}

function renderTimingChart() {
  const svg = elements.timingChart;
  if (!svg) return;
  const session = (state.sessions || []).find((s) => s.extras?.analysis);
  svg.innerHTML = '';
  const widthMin = 320;
  const height = 160;
  if (!session) {
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.textContent = 'No timing data yet';
    text.setAttribute('x', '12');
    text.setAttribute('y', '80');
    text.style.fill = 'var(--muted)';
    svg.appendChild(text);
    svg.setAttribute('viewBox', `0 0 ${widthMin} ${height}`);
    return;
  }
  const analysis = session.extras.analysis;
  const samples = analysis.samples || [];
  if (samples.length) {
    const width = Math.max(widthMin, samples.length * 8 + 20);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    const maxAbs = Math.max(20, ...samples.map((s) => Math.abs(s)));
    const mid = height / 2;
    const axis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    axis.setAttribute('x1', '0');
    axis.setAttribute('x2', String(width));
    axis.setAttribute('y1', String(mid));
    axis.setAttribute('y2', String(mid));
    axis.setAttribute('stroke-width', '1');
    axis.style.stroke = 'var(--border)';
    svg.appendChild(axis);
    samples.forEach((err, idx) => {
      const x = 10 + idx * 8;
      const y = mid - (err / maxAbs) * (height / 2 - 12);
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('cx', x);
      dot.setAttribute('cy', y);
      dot.setAttribute('r', '3');
      dot.style.fill = Math.abs(err) < 20 ? 'var(--accent)' : 'var(--accent-warm)';
      svg.appendChild(dot);
    });
  } else {
    const buckets = analysis.buckets || {};
    const labels = ['<15', '15-30', '30-50', '>50'];
    const values = labels.map((l) => buckets[l] || 0);
    const max = Math.max(...values, 1);
    const width = 200;
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    labels.forEach((label, idx) => {
      const barW = 30;
      const x = 10 + idx * (barW + 12);
      const h = Math.max(2, (values[idx] / max) * (height - 28));
      const y = height - 16 - h;
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', x);
      rect.setAttribute('y', y);
      rect.setAttribute('width', barW);
      rect.setAttribute('height', h);
      rect.style.fill = 'var(--accent)';
      svg.appendChild(rect);
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.textContent = label;
      text.setAttribute('x', x);
      text.setAttribute('y', height - 2);
      text.style.fill = 'var(--muted)';
      text.setAttribute('font-size', '10');
      svg.appendChild(text);
    });
  }
}

function renderLog() {
  const list = elements.sessionLog;
  list.innerHTML = '';
  const sessions = state.sessions || logger.sessions || [];
  if (!sessions.length) {
    const li = document.createElement('li');
    li.className = 'preset-empty';
    li.textContent = 'No sessions yet.';
    list.appendChild(li);
    return;
  }
  sessions.slice(0, 50).forEach((s) => {
    const li = document.createElement('li');
    li.className = 'log-item';
    const date = new Date(s.startedAt);
    li.innerHTML = `<strong>${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
    <span>${Math.round(s.durationSec / 60)} min • Avg ${s.avgBpm || '--'} BPM • Focus ${s.focusScore || '--'}</span>
    <span class="subtext">${(s.extras && summarizeCoach(s)) || ''}</span>`;
    list.appendChild(li);
  });
}

function summarizeCoach(session) {
  const similar = state.sessions.find(
    (s) => s !== session && Math.abs((s.avgBpm || 0) - (session.avgBpm || 0)) < 10,
  );
  return coach.summarizeSession(session, similar);
}

function startSessionLog() {
  logger.start(state.settings.bpm);
}

function registerBpmChange(nextBpm) {
  logger.registerBpmChange(nextBpm);
}

function finishSessionLog() {
  const summary = summarizeAnalysis();
  const game = state.lastGameResult;
  coach.updateStreak(Date.now());
  const session = logger.finish(state.settings.bpm, { analysis: summary, game });
  if (session) {
    state.sessions = logger.sessions;
    renderStats();
  }
  if (summary) {
    elements.audioStatus.textContent = `Timing avg ${summary.mean} ms, spread ${summary.std} ms`;
  }
  state.analysis.hits = [];
  state.lastGameResult = null;
}

function updateMoodSuggestion() {
  const mood = elements.moodSelect.value;
  const info = MOOD_MAP[mood];
  if (!info) return;
  elements.moodSuggestion.textContent = `${info.range[0]}–${info.range[1]} BPM • ${info.signature}`;
}

function applyMoodSuggestion() {
  const mood = elements.moodSelect.value;
  const info = MOOD_MAP[mood];
  if (!info) return;
  const bpm = Math.round((info.range[0] + info.range[1]) / 2);
  setBpmFromInput(bpm);
  setTimeSignature(info.signature);
}

function updateGrooveLabel() {
  const val = parseInt(elements.grooveSlider.value, 10) || 0;
  const label = val < 30 ? 'Easy' : val < 70 ? 'Medium' : 'Hard';
  elements.grooveLabel.textContent = label;
  state.settings.grooveChallenge = val;
  metronome.setGrooveChallenge(val / 100);
  saveSettingsNow();
}

function handleSwing() {
  const val = parseInt(elements.swingSlider.value, 10) || 0;
  state.settings.swing = val;
  elements.swingValue.textContent = `${val}%`;
  metronome.setSwing(val / 100);
  saveSettingsNow();
}

function handleCountIn() {
  state.settings.countIn.enabled = elements.countInToggle.checked;
  state.settings.countIn.bars = Math.max(1, parseInt(elements.countInBars.value, 10) || 1);
  metronome.setCountIn(state.settings.countIn.enabled ? state.settings.countIn.bars : 0);
  saveSettingsNow();
}

function handlePolyrhythmChange() {
  const ratio = (elements.polyRatio.value || '3:2').trim();
  const parts = ratio.split(':').map((n) => parseFloat(n));
  const a = Math.max(1, parts[0] || 3);
  const b = Math.max(1, parts[1] || 2);
  elements.polyRatio.value = `${a}:${b}`;
  state.settings.polyrhythm.enabled = elements.polyToggle.checked;
  state.settings.polyrhythm.ratioA = a;
  state.settings.polyrhythm.ratioB = b;
  state.settings.polyrhythm.volumeA = parseFloat(elements.polyVolA.value) || 1;
  state.settings.polyrhythm.volumeB = parseFloat(elements.polyVolB.value) || 0.7;
  state.settings.polyrhythm.soundA = elements.polySoundA.value;
  state.settings.polyrhythm.soundB = elements.polySoundB.value;
  metronome.setPolyrhythm(state.settings.polyrhythm);
  state.polyCounters = { A: -1, B: -1 };
  renderPolyrhythmDots();
  renderRhythmMap();
  saveSettingsNow();
}

function handleSilentBars() {
  state.settings.silentBars.enabled = elements.silentBarsToggle.checked;
  state.settings.silentBars.every = Math.max(2, parseInt(elements.silentBarsEvery.value, 10) || 2);
  metronome.setSilentBars(state.settings.silentBars);
  saveSettingsNow();
}

function handlePhrase() {
  state.settings.phrase.enabled = elements.phraseToggle.checked;
  state.settings.phrase.length = Math.max(2, parseInt(elements.phraseLength.value, 10) || 4);
  state.settings.phrase.target = Math.max(0, parseInt(elements.phraseTarget.value, 10) || 0);
  metronome.setPhrase(state.settings.phrase);
  updatePhraseStatus({ bar: state.barCounter || 0 });
  saveSettingsNow();
}

function updatePhraseStatus(info) {
  if (!state.settings.phrase.enabled) {
    elements.phraseStatus.textContent = 'Pings at start of each phrase.';
    return;
  }
  const phraseIndex = info ? Math.floor(info.bar / state.settings.phrase.length) + 1 : 1;
  elements.phraseStatus.textContent = `Phrase ${phraseIndex}` + (state.settings.phrase.target ? ` / ${state.settings.phrase.target}` : '');
}

function generateWarmupRoutine() {
  const today = new Date().toISOString().slice(0, 10);
  const blocks = [];
  const blockCount = Math.floor(Math.random() * 3) + 3;
  let bpm = clampBpm(state.settings.bpm || 100);
  let sig = state.settings.timeSignature;
  for (let i = 0; i < blockCount; i += 1) {
    bpm = clampBpm(bpm + Math.floor(Math.random() * 10) + 2);
    if (i === 1) sig = '3/4';
    if (i === 2) sig = '6/8';
    blocks.push({ label: `Block ${i + 1}`, bpm, durationValue: 3 + i, durationType: 'minutes', signature: sig });
  }
  state.warmups[today] = blocks;
  saveWarmups(state.warmups);
  renderWarmup();
}

function renderWarmup() {
  const list = elements.warmupList;
  if (!list) return;
  list.innerHTML = '';
  const today = new Date().toISOString().slice(0, 10);
  const blocks = state.warmups[today];
  if (!blocks || !blocks.length) {
    const li = document.createElement('li');
    li.className = 'preset-empty';
    li.textContent = 'No warm-up generated for today yet.';
    list.appendChild(li);
    return;
  }
  blocks.forEach((b) => {
    const li = document.createElement('li');
    li.className = 'compact';
    li.innerHTML = `<strong>${b.label}</strong><span>${b.bpm} BPM • ${b.signature || state.settings.timeSignature} • ${b.durationValue} ${b.durationType}</span>`;
    list.appendChild(li);
  });
}

function renderProfilesUI() {
  if (!elements.profileSelect) return;
  elements.profileSelect.innerHTML = '';
  state.profiles.forEach((p) => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = `${p.name}${p.instrument ? ` • ${p.instrument}` : ''}`;
    elements.profileSelect.appendChild(opt);
  });
  if (state.profileId) elements.profileSelect.value = state.profileId;
  const current = state.profiles.find((p) => p.id === state.profileId);
  if (elements.profileInstrument) elements.profileInstrument.value = current?.instrument || '';
}

function loadProfileState() {
  state.settings = normalizeSettings(loadSettings(DEFAULT_SETTINGS));
  normalizeAccents();
  state.presets = migratePresets(loadPresets());
  state.setlists = loadSetlists();
  state.sessions = loadSessions();
  state.warmups = loadWarmups();
  const loadedPatterns = loadPatterns();
  state.patterns = loadedPatterns.length ? loadedPatterns : DEFAULT_PATTERNS.map((p) => ({ ...p, steps: [...p.steps] }));
  coach.state = loadCoach() || coach.state;
  logger.sessions = state.sessions;
  trainer.warmups = state.warmups;
  if (state.patterns.length) state.currentPatternId = state.patterns[0].id;
}

function switchProfile(id) {
  if (!id || id === state.profileId) return;
  saveCurrentProfileId(id);
  state.profileId = id;
  loadProfileState();
  applySettingsToEngine();
  applySettingsToUI();
  buildBeatIndicators();
  buildSubdivisionPatternUI();
  renderPresets();
  renderSetlists();
  renderBlocks();
  renderPolyrhythmDots();
  renderWarmup();
  renderStats();
  renderPatternsList();
  if (state.patterns.length) loadPatternToEditor(state.patterns[0].id);
  renderRhythmMap();
  renderProfilesUI();
  updateMicMonitorUI();
  if (state.settings.micMonitorEnabled) {
    if (elements.micToggle) elements.micToggle.checked = true;
    enableMicMonitor();
  } else if (audioInput.enabled) {
    disableMicMonitor();
  }
}

function addProfile() {
  const name = (prompt('Profile name?') || '').trim() || `Profile ${state.profiles.length + 1}`;
  const instrument = elements.profileInstrument?.value || 'Piano';
  const id = `profile-${Date.now()}`;
  state.profiles.push({ id, name, instrument });
  saveProfilesMeta(state.profiles);
  saveCurrentProfileId(id);
  state.profileId = id;
  saveProfileBundle(id, {
    settings: { ...DEFAULT_SETTINGS },
    presets: [],
    setlists: [],
    sessions: [],
    warmups: {},
    patterns: DEFAULT_PATTERNS.map((p) => ({ ...p, steps: [...p.steps] })),
    coach: { streak: 0, longest: 0, lastDay: null, milestones: [] },
  });
  loadProfileState();
  applySettingsToEngine();
  applySettingsToUI();
  buildBeatIndicators();
  buildSubdivisionPatternUI();
  renderPresets();
  renderSetlists();
  renderBlocks();
  renderPolyrhythmDots();
  renderWarmup();
  renderStats();
  renderPatternsList();
  renderProfilesUI();
  updateMicMonitorUI();
  if (audioInput.enabled) disableMicMonitor();
}

function renameProfile() {
  const current = state.profiles.find((p) => p.id === state.profileId);
  if (!current) return;
  const name = (prompt('New profile name?', current.name) || '').trim();
  if (!name) return;
  current.name = name;
  if (elements.profileInstrument) current.instrument = elements.profileInstrument.value.trim();
  saveProfilesMeta(state.profiles);
  renderProfilesUI();
}

function deleteProfile() {
  if (state.profiles.length <= 1) {
    elements.audioStatus.textContent = 'Cannot delete the last profile.';
    return;
  }
  const currentId = state.profileId;
  const confirmDelete = window.confirm('Delete this profile and its data?');
  if (!confirmDelete) return;
  state.profiles = state.profiles.filter((p) => p.id !== currentId);
  deleteProfileBundle(currentId);
  saveProfilesMeta(state.profiles);
  const nextId = state.profiles[0].id;
  saveCurrentProfileId(nextId);
  state.profileId = nextId;
  switchProfile(nextId);
}

function updateProfileInstrument() {
  const current = state.profiles.find((p) => p.id === state.profileId);
  if (!current) return;
  current.instrument = elements.profileInstrument.value.trim();
  saveProfilesMeta(state.profiles);
  renderProfilesUI();
}

function getCurrentPattern() {
  return state.patterns.find((p) => p.id === state.currentPatternId) || state.patterns[0];
}

function renderPatternGrid(pattern) {
  if (!elements.patternGrid || !pattern) return;
  const beats = parseInt(pattern.timeSignature.split('/')[0], 10) || 4;
  const stepsPerBar = pattern.steps.length || pattern.subdivision;
  const columns = Math.max(stepsPerBar, 1);
  elements.patternGrid.innerHTML = '';
  elements.patternGrid.style.gridTemplateColumns = `repeat(${columns}, minmax(18px, 1fr))`;
  pattern.steps.forEach((step, idx) => {
    const cell = document.createElement('button');
    cell.className = `pattern-step ${step === 1 ? 'hit' : step === 2 ? 'accent' : ''}`;
    cell.setAttribute('role', 'gridcell');
    cell.setAttribute('aria-label', `Step ${idx + 1} ${step === 0 ? 'rest' : step === 1 ? 'hit' : 'accent'}`);
    if (idx % Math.max(1, Math.round(columns / beats)) === 0) cell.classList.add('beat-start');
    cell.textContent = step === 2 ? 'A' : step === 1 ? '●' : '';
    cell.addEventListener('click', () => {
      const next = toggleStep(pattern, idx);
      const index = state.patterns.findIndex((p) => p.id === pattern.id);
      if (index >= 0) {
        state.patterns[index] = next;
        savePatterns(state.patterns);
        renderPatternGrid(next);
      }
    });
    elements.patternGrid.appendChild(cell);
  });
}

function loadPatternToEditor(id) {
  const pattern = state.patterns.find((p) => p.id === id) || state.patterns[0];
  if (!pattern) return;
  state.currentPatternId = pattern.id;
  if (elements.patternName) elements.patternName.value = pattern.name || '';
  if (elements.patternSig) elements.patternSig.value = pattern.timeSignature || '4/4';
  if (elements.patternSubdivision) elements.patternSubdivision.value = String(pattern.subdivision || 16);
  renderPatternGrid(pattern);
  renderPatternsList();
}

function updatePatternMeta() {
  const pattern = getCurrentPattern();
  if (!pattern) return;
  const beats = parseInt(elements.patternSig.value, 10) || 4;
  const subdivision = parseInt(elements.patternSubdivision.value, 10) || 16;
  const expectedSteps = Math.max(1, Math.round((subdivision / 4) * beats));
  const steps = new Array(expectedSteps).fill(0).map((_, idx) => pattern.steps[idx] || 0);
  const updated = {
    ...pattern,
    name: elements.patternName.value.trim() || pattern.name,
    timeSignature: elements.patternSig.value || '4/4',
    subdivision,
    steps,
  };
  const index = state.patterns.findIndex((p) => p.id === pattern.id);
  if (index >= 0) state.patterns[index] = updated;
  savePatterns(state.patterns);
  renderPatternGrid(updated);
  renderPatternsList();
}

function saveCurrentPattern() {
  const pattern = getCurrentPattern();
  if (!pattern) return;
  updatePatternMeta();
}

function deleteCurrentPattern() {
  if (!state.patterns.length) return;
  state.patterns = state.patterns.filter((p) => p.id !== state.currentPatternId);
  if (!state.patterns.length) state.patterns = [createEmptyPattern()];
  state.currentPatternId = state.patterns[0].id;
  savePatterns(state.patterns);
  renderPatternsList();
  loadPatternToEditor(state.currentPatternId);
}

function previewCurrentPattern() {
  const pattern = getCurrentPattern();
  if (!pattern || !metronome || !metronome.audioCtx) return;
  metronome.previewPattern?.(pattern, state.settings.bpm);
  elements.audioStatus.textContent = `Previewing ${pattern.name}`;
}

function renderPatternsList() {
  if (!elements.patternList) return;
  if (!state.currentPatternId && state.patterns.length) state.currentPatternId = state.patterns[0].id;
  elements.patternList.innerHTML = '';
  if (!state.patterns.length) {
    const li = document.createElement('li');
    li.className = 'preset-empty';
    li.textContent = 'No patterns yet.';
    elements.patternList.appendChild(li);
  } else {
    state.patterns.forEach((p) => {
      const li = document.createElement('li');
      li.className = `preset-item compact ${p.id === state.currentPatternId ? 'active' : ''}`;
      const info = document.createElement('div');
      info.className = 'preset-info';
      info.innerHTML = `<strong>${p.name}</strong><span>${p.timeSignature} • ${p.subdivision}th grid</span>`;
      const actions = document.createElement('div');
      actions.className = 'preset-actions';
      const loadBtn = document.createElement('button');
      loadBtn.className = 'ghost-btn small';
      loadBtn.textContent = 'Edit';
      loadBtn.addEventListener('click', () => loadPatternToEditor(p.id));
      actions.append(loadBtn);
      li.append(info, actions);
      elements.patternList.appendChild(li);
    });
  }
  if (elements.gameCopyPattern) {
    elements.gameCopyPattern.innerHTML = '';
    state.patterns.forEach((p) => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      elements.gameCopyPattern.appendChild(opt);
    });
    if (state.currentPatternId) elements.gameCopyPattern.value = state.currentPatternId;
  }
}

function exportData() {
  const bundle = exportAll({
    settings: state.settings,
    presets: state.presets,
    setlists: state.setlists,
    sessions: state.sessions,
    warmups: state.warmups,
  });
  elements.dataArea.value = JSON.stringify(bundle, null, 2);
  elements.importError.textContent = '';
}

function importData() {
  const text = elements.dataArea.value.trim();
  if (!text) return;
  try {
    const parsed = JSON.parse(text);
    importAll(parsed);
    state.profiles = loadProfilesMeta();
    state.profileId = loadCurrentProfileId();
    state.settings = normalizeSettings(loadSettings(DEFAULT_SETTINGS));
    state.presets = migratePresets(loadPresets());
    state.setlists = loadSetlists();
    state.sessions = loadSessions();
    state.warmups = loadWarmups();
    state.patterns = loadPatterns().length ? loadPatterns() : DEFAULT_PATTERNS;
    coach.state = loadCoach() || coach.state;
    applySettingsToEngine();
    applySettingsToUI();
    renderPresets();
    renderSetlists();
    renderWarmup();
    renderStats();
    renderPatternsList();
    renderProfilesUI();
    buildBeatIndicators();
    buildSubdivisionPatternUI();
    renderPolyrhythmDots();
    renderRhythmMap();
    elements.importError.textContent = 'Imported successfully';
  } catch (e) {
    elements.importError.textContent = 'Invalid JSON. Import failed.';
  }
}

function handleCoachTap() {
  const beats = metronome.getRecentBeats();
  if (!beats.length) {
    elements.coachFeedback.textContent = 'No beat detected yet.';
    return;
  }
  const nowAudioTime = metronome.audioCtx ? metronome.audioCtx.currentTime : 0;
  let closest = beats[0];
  let minDiff = Math.abs(nowAudioTime - beats[0].time);
  beats.forEach((b) => {
    const diff = Math.abs(nowAudioTime - b.time);
    if (diff < minDiff) {
      minDiff = diff;
      closest = b;
    }
  });
  const diffMs = Math.round((nowAudioTime - closest.time) * 1000);
  state.coachOffsets.push(diffMs);
  if (state.coachOffsets.length > 10) state.coachOffsets.shift();
  const avg = state.coachOffsets.reduce((a, b) => a + b, 0) / state.coachOffsets.length;
  if (avg > 5) {
    elements.coachFeedback.textContent = `You tend to be ahead by ${Math.round(avg)} ms`;
  } else if (avg < -5) {
    elements.coachFeedback.textContent = `You tend to be behind by ${Math.abs(Math.round(avg))} ms`;
  } else {
    elements.coachFeedback.textContent = 'Locked in!';
  }
}

function recordTimingError(timeMs) {
  if (!state.isRunning) return;
  const beats = metronome.getRecentBeats();
  if (!beats.length) return;
  const t = timeMs / 1000;
  let nearest = beats[0].time;
  let min = Math.abs(t - nearest);
  beats.forEach((b) => {
    const diff = Math.abs(t - b.time);
    if (diff < min) {
      min = diff;
      nearest = b.time;
    }
  });
  const errMs = (t - nearest) * 1000;
  state.analysis.hits.push(errMs);
}

function summarizeAnalysis() {
  const hits = state.analysis.hits || [];
  if (!hits.length) return null;
  const mean = hits.reduce((a, b) => a + b, 0) / hits.length;
  const sorted = [...hits].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const std =
    Math.sqrt(
      hits.reduce((a, b) => a + (b - mean) * (b - mean), 0) / hits.length,
    ) || 0;
  const buckets = { '<15': 0, '15-30': 0, '30-50': 0, '>50': 0 };
  hits.forEach((h) => {
    const a = Math.abs(h);
    if (a < 15) buckets['<15'] += 1;
    else if (a < 30) buckets['15-30'] += 1;
    else if (a < 50) buckets['30-50'] += 1;
    else buckets['>50'] += 1;
  });
  return {
    mean: Math.round(mean),
    median: Math.round(median),
    best: Math.round(best),
    worst: Math.round(worst),
    std: Math.round(std),
    buckets,
    count: hits.length,
    samples: hits.slice(-120),
  };
}

function startCalibration() {
  state.calibration = { active: true, taps: [], wasRunning: state.isRunning };
  setBpmFromInput(80);
  elements.startCalibration.disabled = true;
  elements.tapCalibration.disabled = false;
  elements.audioStatus.textContent = 'Calibration: tap when you hear the click (20 taps)';
  if (!state.isRunning) toggleStartStop();
}

function updateCalibrationWithBeat(info) {
  if (!state.calibration.active) return;
  // calibration uses tap difference; beats stored for context
}

function tapCalibration() {
  if (!state.calibration.active) return;
  const beats = metronome.getRecentBeats();
  if (!beats.length) return;
  const audioTime = metronome.audioCtx.currentTime;
  let nearest = beats[0];
  let minDiff = Math.abs(audioTime - beats[0].time);
  beats.forEach((b) => {
    const diff = Math.abs(audioTime - b.time);
    if (diff < minDiff) {
      minDiff = diff;
      nearest = b;
    }
  });
  const diffMs = (audioTime - nearest.time) * 1000;
  state.calibration.taps.push(diffMs);
  if (state.calibration.taps.length >= 20) finishCalibration();
  elements.audioStatus.textContent = `Captured ${state.calibration.taps.length}/20 taps`;
}

function finishCalibration() {
  const taps = state.calibration.taps;
  if (!taps.length) return;
  const avg = Math.round(taps.reduce((a, b) => a + b, 0) / taps.length);
  state.settings.latency.measuredMs = avg;
  metronome.setLatencyOffset(avg + (state.settings.latency.manualMs || 0));
  elements.latencyMeasured.textContent = `${avg} ms`;
  elements.latencyApplied.textContent = `${avg + (state.settings.latency.manualMs || 0)} ms`;
  elements.audioStatus.textContent = 'Calibration saved';
  state.calibration.active = false;
  elements.startCalibration.disabled = false;
  elements.tapCalibration.disabled = true;
  if (!state.calibration.wasRunning && state.isRunning) toggleStartStop();
  saveSettingsNow();
}

function handleLatencyAdjust() {
  const manual = parseInt(elements.latencyAdjust.value, 10) || 0;
  state.settings.latency.manualMs = manual;
  const applied = (state.settings.latency.measuredMs || 0) + manual;
  elements.latencyApplied.textContent = `${applied} ms`;
  metronome.setLatencyOffset(applied);
  saveSettingsNow();
}

async function initMidi() {
  if (!navigator.requestMIDIAccess) {
    elements.midiStatus.textContent = 'MIDI not supported in this browser.';
    if (document.getElementById('midiCard')) document.getElementById('midiCard').classList.add('muted');
    return;
  }
  try {
    const access = await navigator.requestMIDIAccess();
    state.midi.supported = true;
    state.midi.access = access;
    access.onstatechange = populateMidiInputs;
    populateMidiInputs();
    elements.midiStatus.textContent = 'MIDI ready.';
  } catch (e) {
    elements.midiStatus.textContent = 'MIDI access denied.';
  }
}

function populateMidiInputs() {
  const access = state.midi.access;
  if (!access) return;
  elements.midiInputSelect.innerHTML = '';
  access.inputs.forEach((input) => {
    const opt = document.createElement('option');
    opt.value = input.id;
    opt.textContent = input.name;
    elements.midiInputSelect.appendChild(opt);
  });
  if (access.inputs.size === 0) elements.midiStatus.textContent = 'No MIDI inputs detected.';
  const selected = state.settings.midi.inputId;
  if (selected) elements.midiInputSelect.value = selected;
  bindMidiInput();
}

function bindMidiInput() {
  const access = state.midi.access;
  if (!access) return;
  if (state.midi.input) state.midi.input.onmidimessage = null;
  const id = elements.midiInputSelect.value;
  const input = access.inputs.get(id);
  if (!input) return;
  state.midi.input = input;
  state.settings.midi.inputId = id;
  input.onmidimessage = handleMidiMessage;
  saveSettingsNow();
}

function handleMidiMessage(event) {
  const [status, note, velocity] = event.data;
  const command = status & 0xf0;
  // MIDI clock tick 0xF8 for BPM detect
  if (status === 0xf8) {
    const now = performance.now();
    state.midi.clockTicks.push(now);
    if (state.midi.clockTicks.length > 24) state.midi.clockTicks.shift();
    if (state.midi.clockTicks.length >= 2) {
      const interval = (state.midi.clockTicks[state.midi.clockTicks.length - 1] - state.midi.clockTicks[0]) / (state.midi.clockTicks.length - 1);
      const bpm = 60000 / (interval * 24);
      elements.midiMappingInfo.textContent = `MIDI clock BPM ~${bpm.toFixed(1)}`;
    }
  }
  if (command === 0x90 && velocity > 0) {
    if (note === Number(state.settings.midi.tapNote)) {
      handleTap();
      elements.midiMappingInfo.textContent = `Tapped via MIDI note ${note}`;
    }
    if (note === Number(state.settings.midi.transportNote)) {
      toggleStartStop();
      elements.midiMappingInfo.textContent = `Start/Stop via MIDI note ${note}`;
    }
  }
}

function applyMidiMapping() {
  state.settings.midi.tapNote = parseInt(elements.midiTapNote.value, 10) || 60;
  state.settings.midi.transportNote = parseInt(elements.midiTransportNote.value, 10) || 62;
  bindMidiInput();
  saveSettingsNow();
}

function updateGrooveChallenge() {
  updateGrooveLabel();
}

function showHelperOverlay(force) {
  if (force || (!state.settings.helperSeen && elements.showHelper.checked)) {
    elements.helperOverlay.classList.add('active');
    elements.helperOverlay.setAttribute('aria-hidden', 'false');
    elements.closeHelper.focus();
    state.helperTrap = trapFocus(elements.helperOverlay, true);
  }
}

function hideHelperOverlay() {
  elements.helperOverlay.classList.remove('active');
  elements.helperOverlay.setAttribute('aria-hidden', 'true');
  if (state.helperTrap) state.helperTrap();
  if (elements.helperDontShow.checked) state.settings.helperSeen = true;
  saveSettingsNow();
}

function updateDebug() {
  if (!state.settings.debugEnabled || !elements.debugPanel) return;
  const ctxTime = metronome.audioCtx ? metronome.audioCtx.currentTime : 0;
  elements.debugTiming.textContent = `AudioContext: ${ctxTime.toFixed(3)}s\nNext beat time: ${(metronome.nextNoteTime || 0).toFixed(3)}s`;
  const recent = metronome.getRecentBeats().slice(-8);
  elements.debugBeats.textContent = recent.map((b) => `bar ${b.bar} beat ${b.beat} t=${b.time.toFixed(3)}`).join('\n');
  elements.debugState.textContent = JSON.stringify(
    {
      bpm: state.settings.bpm,
      meter: state.settings.timeSignature,
      swing: state.settings.swing,
      subdivision: state.settings.subdivision,
      latency: state.settings.latency,
      trainer: state.settings.trainer,
    },
    null,
    2,
  );
}

function toggleDebugPanel() {
  state.settings.debugEnabled = elements.debugToggle.checked;
  elements.debugPanel.hidden = !state.settings.debugEnabled;
  saveSettingsNow();
  if (state.settings.debugEnabled) updateDebug();
}

function setMicStatus(text, tone = 'muted') {
  if (!elements.micStatus) return;
  elements.micStatus.textContent = text;
  elements.micStatus.className = `status-pill ${tone}`;
}

function updateMicMonitorUI(status = tempoMonitor.getStatus()) {
  const toneClasses = ['green', 'yellow', 'red', 'grey', 'muted'];
  const target = status.targetBpm || state.settings.bpm || null;
  const verdictColor = state.settings.micMonitorEnabled ? status.color || 'grey' : 'grey';
  const verdictText = state.settings.micMonitorEnabled ? status.statusText || 'Listening...' : 'Mic off';
  if (elements.micTargetBpm) elements.micTargetBpm.textContent = target ? (Math.round(target * 10) / 10).toFixed(1) : '--';
  if (elements.micPlayerBpm) elements.micPlayerBpm.textContent = status.playerBpm && state.settings.micMonitorEnabled ? status.playerBpm.toFixed(1) : '--';
  if (elements.micDrift) {
    const drift =
      typeof status.avgDriftMs === 'number' && state.settings.micMonitorEnabled
        ? `${status.avgDriftMs > 0 ? '+' : ''}${status.avgDriftMs} ms`
        : '--';
    elements.micDrift.textContent = drift;
  }
  if (elements.micVerdict) {
    toneClasses.forEach((c) => elements.micVerdict.classList.remove(c));
    elements.micVerdict.classList.add(verdictColor);
    elements.micVerdict.textContent = verdictText;
  }
  if (elements.micMonitorCard) {
    toneClasses.forEach((c) => elements.micMonitorCard.classList.remove(c));
    elements.micMonitorCard.classList.add(verdictColor);
  }
  if (elements.micMonitorNote) {
    if (!state.mic.supported) elements.micMonitorNote.textContent = 'Mic not supported in this browser.';
    else if (!state.settings.micMonitorEnabled) elements.micMonitorNote.textContent = 'Mic monitor is off.';
    else if (!audioInput.enabled) elements.micMonitorNote.textContent = 'Enable mic access to analyze timing.';
    else if (!state.isRunning) elements.micMonitorNote.textContent = 'Start the metronome to analyze timing.';
    else if (status.statusCode === 'NO_DATA') {
      if (state.mic.hits > 0) {
        const since = state.mic.lastHitAt ? Math.round((Date.now() - state.mic.lastHitAt) / 1000) : 0;
        elements.micMonitorNote.textContent = since ? `Heard ${state.mic.hits} hits (${since}s ago)... keep playing.` : 'Heard hits... syncing.';
      } else {
        elements.micMonitorNote.textContent = 'Listening... play or clap near the mic.';
      }
    }
    else elements.micMonitorNote.textContent = 'Comparing your hits to the current beat grid.';
  }
}

async function enableMicMonitor() {
  if (!audioInput.isSupported || !audioInput.isSupported()) {
    state.mic.supported = false;
    setMicStatus('Mic not supported in this browser', 'red');
    updateMicMonitorUI();
    if (elements.micToggle) elements.micToggle.checked = false;
    return false;
  }
  try {
    if (metronome.audioCtx?.state === 'suspended') await metronome.audioCtx.resume();
  } catch (e) {}
  const ok = await audioInput.start();
  if (!ok) {
    state.mic.permissionDenied = true;
    setMicStatus('Mic permission denied or unavailable', 'red');
    if (elements.micToggle) elements.micToggle.checked = false;
    state.settings.micMonitorEnabled = false;
    saveSettingsNow();
    updateMicMonitorUI();
    return false;
  }
  state.mic.supported = true;
  state.mic.permissionDenied = false;
  state.settings.micMonitorEnabled = true;
  state.mic.hits = 0;
  state.mic.lastHitAt = 0;
  tempoMonitor.start();
  setMicStatus('Mic on • listening', 'green');
  updateMicMonitorUI();
  if (elements.micToggle) elements.micToggle.checked = true;
  saveSettingsNow();
  return true;
}

function disableMicMonitor() {
  state.settings.micMonitorEnabled = false;
  state.mic.hits = 0;
  state.mic.lastHitAt = 0;
  audioInput.stop();
  tempoMonitor.stop();
  setMicStatus('Mic off', 'muted');
  updateMicMonitorUI();
  if (elements.micToggle) elements.micToggle.checked = false;
  saveSettingsNow();
}

async function toggleMic() {
  if (elements.micToggle?.checked) {
    await enableMicMonitor();
  } else {
    disableMicMonitor();
  }
}

function attachEventListeners() {
  elements.bpmInput.addEventListener('change', (e) => setBpmFromInput(e.target.value));
  elements.bpmSlider.addEventListener('input', (e) => setBpmFromInput(e.target.value));
  elements.bpmUp.addEventListener('click', () => changeBpm(1));
  elements.bpmDown.addEventListener('click', () => changeBpm(-1));
  elements.timeSignature.addEventListener('change', (e) => setTimeSignature(e.target.value));
  elements.customTimeNum?.addEventListener('change', () => setTimeSignature('custom'));
  elements.customTimeDen?.addEventListener('change', () => setTimeSignature('custom'));
  elements.subdivision.addEventListener('change', (e) => setSubdivision(e.target.value));
  elements.soundSelect.addEventListener('change', (e) => setSound(e.target.value));
  elements.volume.addEventListener('input', (e) => setVolume(e.target.value));
  elements.muteToggle.addEventListener('click', () => toggleMute());
  elements.quietToggle.addEventListener('click', toggleQuietMode);
  elements.themeToggle.addEventListener('click', toggleTheme);
  elements.startStop.addEventListener('click', toggleStartStop);
  elements.tapTempo.addEventListener('click', handleTap);
  elements.savePreset.addEventListener('click', savePreset);
  elements.swingSlider.addEventListener('input', handleSwing);
  elements.countInToggle.addEventListener('change', handleCountIn);
  elements.countInBars.addEventListener('change', handleCountIn);
  elements.grooveSlider.addEventListener('input', updateGrooveChallenge);
  elements.addSetlistItem.addEventListener('click', addSetlistItem);
  elements.setlistSelect.addEventListener('change', renderSetlistItems);
  elements.newSetlist.addEventListener('click', createNewSetlist);
  elements.deleteSetlist.addEventListener('click', deleteSetlist);
  elements.playSetlist.addEventListener('click', playSetlist);
  elements.stopSetlist.addEventListener('click', stopSetlist);
  elements.rampEnable.addEventListener('change', () => {
    state.settings.trainer.ramp.enabled = elements.rampEnable.checked;
    saveSettingsNow();
  });
  elements.rampStart.addEventListener('change', (e) => {
    state.settings.trainer.ramp.start = clampBpm(parseInt(e.target.value, 10) || state.settings.trainer.ramp.start);
    saveSettingsNow();
  });
  elements.rampEnd.addEventListener('change', (e) => {
    state.settings.trainer.ramp.end = clampBpm(parseInt(e.target.value, 10) || state.settings.trainer.ramp.end);
    saveSettingsNow();
  });
  elements.rampStep.addEventListener('change', (e) => {
    state.settings.trainer.ramp.step = parseInt(e.target.value, 10) || state.settings.trainer.ramp.step;
    saveSettingsNow();
  });
  elements.rampInterval.addEventListener('change', (e) => {
    state.settings.trainer.ramp.interval = Math.max(1, parseInt(e.target.value, 10) || state.settings.trainer.ramp.interval);
    saveSettingsNow();
  });
  elements.rampMode.addEventListener('change', (e) => {
    state.settings.trainer.ramp.mode = e.target.value;
    saveSettingsNow();
  });
  elements.addBlock.addEventListener('click', () => {
    const bpm = clampBpm(parseInt(elements.blockBpm.value, 10) || 100);
    const durationValue = Math.max(1, parseInt(elements.blockDuration.value, 10) || 4);
    const durationType = elements.blockType.value === 'seconds' ? 'seconds' : 'bars';
    const label = elements.blockLabel.value.trim();
    const blocks = state.settings.trainer.blocks || [];
    blocks.push({ bpm, durationValue, durationType, label });
    state.settings.trainer.blocks = blocks;
    renderBlocks();
    saveSettingsNow();
    elements.blockLabel.value = '';
  });
  elements.blockToggle.addEventListener('change', () => {
    state.settings.trainer.blocksEnabled = elements.blockToggle.checked;
    saveSettingsNow();
  });
  ['polyToggle', 'polyRatio', 'polyVolA', 'polyVolB', 'polySoundA', 'polySoundB'].forEach((id) => {
    const el = elements[id];
    if (el) {
      el.addEventListener('input', handlePolyrhythmChange);
      el.addEventListener('change', handlePolyrhythmChange);
    }
  });
  elements.silentBarsToggle.addEventListener('change', handleSilentBars);
  elements.silentBarsEvery.addEventListener('change', handleSilentBars);
  elements.phraseToggle.addEventListener('change', handlePhrase);
  elements.phraseLength.addEventListener('change', handlePhrase);
  elements.phraseTarget.addEventListener('change', handlePhrase);
  elements.moodSelect.addEventListener('change', updateMoodSuggestion);
  elements.applyMood.addEventListener('click', applyMoodSuggestion);
  elements.generateWarmup.addEventListener('click', () => {
    if (!state.warmups[new Date().toISOString().slice(0, 10)]) generateWarmupRoutine();
  });
  elements.regenWarmup.addEventListener('click', generateWarmupRoutine);
  elements.exportData.addEventListener('click', exportData);
  elements.importData.addEventListener('click', () => elements.dataArea.focus());
  elements.confirmImport.addEventListener('click', importData);
  elements.coachTap.addEventListener('click', handleCoachTap);
  elements.nudgeUp.addEventListener('click', () => changeBpm(1));
  elements.nudgeDown.addEventListener('click', () => changeBpm(-1));
  elements.tabButtons.forEach((btn) =>
    btn.addEventListener('click', () => {
      elements.tabButtons.forEach((b) => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      elements.tabPanels.forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      const tabId = btn.dataset.tab;
      const panel = document.getElementById(`tab-${tabId}`);
      if (panel) {
        panel.classList.add('active');
        panel.focus();
      }
    }),
  );
  document.addEventListener('keydown', (e) => {
    const tag = e.target.tagName;
    const isFormField = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
    if (e.code === 'Space') {
      if (isFormField) return;
      e.preventDefault();
      toggleStartStop();
    } else if (e.code === 'ArrowUp') {
      if (isFormField) return;
      e.preventDefault();
      changeBpm(e.shiftKey ? 5 : 1);
    } else if (e.code === 'ArrowDown') {
      if (isFormField) return;
      e.preventDefault();
      changeBpm(e.shiftKey ? -5 : -1);
    }
  });
  elements.startCalibration.addEventListener('click', startCalibration);
  elements.tapCalibration.addEventListener('click', tapCalibration);
  elements.latencyAdjust.addEventListener('input', handleLatencyAdjust);
  elements.midiInputSelect.addEventListener('change', bindMidiInput);
  elements.applyMidi.addEventListener('click', applyMidiMapping);
  elements.audioHelp.addEventListener('click', () => {
    elements.audioStatus.textContent = 'If silent: tap Start, ensure device not muted, interact to unlock audio.';
  });
  elements.micToggle.addEventListener('change', toggleMic);
  elements.startGameHit.addEventListener('click', () => {
    games.startHit(Number(elements.gameHitDuration.value) || 45);
    state.lastGameResult = null;
    if (!state.isRunning) toggleStartStop();
  });
  elements.startGameSilent.addEventListener('click', () => {
    games.startSilent(Number(elements.gameSilentLead.value) || 2, Number(elements.gameSilentBars.value) || 2);
    state.lastGameResult = null;
    if (!state.isRunning) toggleStartStop();
  });
  elements.startGameCopy.addEventListener('click', () => {
    const pid = elements.gameCopyPattern.value;
    const pattern = state.patterns.find((p) => p.id === pid);
    games.startCopy(pattern || pid);
    state.lastGameResult = null;
    if (!state.isRunning) toggleStartStop();
  });
  if (elements.newPattern) {
    elements.newPattern.addEventListener('click', () => {
      const p = createEmptyPattern();
      state.currentPatternId = p.id;
      state.patterns = [...state.patterns, p];
      renderPatternsList();
      loadPatternToEditor(p.id);
    });
    elements.savePattern.addEventListener('click', () => saveCurrentPattern());
    elements.deletePattern.addEventListener('click', () => deleteCurrentPattern());
    elements.previewPattern.addEventListener('click', () => previewCurrentPattern());
    elements.patternName?.addEventListener('input', updatePatternMeta);
    elements.patternSig?.addEventListener('change', updatePatternMeta);
    elements.patternSubdivision?.addEventListener('change', updatePatternMeta);
  }
  elements.showHelper.addEventListener('change', () => {
    state.settings.helperSeen = !elements.showHelper.checked;
    saveSettingsNow();
  });
  elements.closeHelper.addEventListener('click', hideHelperOverlay);
  elements.helperOverlay.addEventListener('click', (e) => {
    if (e.target === elements.helperOverlay) hideHelperOverlay();
  });
  elements.debugToggle.addEventListener('change', toggleDebugPanel);
  elements.profileSelect?.addEventListener('change', (e) => switchProfile(e.target.value));
  elements.addProfile?.addEventListener('click', addProfile);
  elements.renameProfile?.addEventListener('click', renameProfile);
  elements.deleteProfile?.addEventListener('click', deleteProfile);
  elements.profileInstrument?.addEventListener('change', updateProfileInstrument);
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  }
}

function offlineIndicator() {
  const update = () => {
    if (navigator.onLine) {
      elements.offlineBadge.textContent = 'Offline-ready';
      elements.offlineBadge.classList.remove('danger');
    } else {
      elements.offlineBadge.textContent = 'You are offline';
      elements.offlineBadge.classList.add('danger');
    }
  };
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
}

function initAudioContextWatcher() {
  const ctx = metronome.audioCtx;
  const check = () => {
    if (ctx.state === 'suspended') {
      elements.audioStatus.textContent = 'Audio blocked: tap Start or any control to enable.';
    } else {
      elements.audioStatus.textContent = 'Audio ready';
    }
  };
  document.addEventListener('click', () => ctx.resume().then(check));
  ctx.onstatechange = check;
  check();
}

function initHelper() {
  if (!state.settings.helperSeen) showHelperOverlay(true);
}

function initDebug() {
  elements.debugPanel.hidden = !state.settings.debugEnabled;
  if (state.settings.debugEnabled) updateDebug();
}

function init() {
  migrateVersion();
  state.profiles = loadProfilesMeta();
  state.profileId = loadCurrentProfileId();
  loadProfileState();
  normalizeAccents();
  applySettingsToEngine();
  applySettingsToUI();
  updateMicMonitorUI();
  setMicStatus('Mic off', 'muted');
  buildBeatIndicators();
  buildSubdivisionPatternUI();
  renderPresets();
  renderSetlists();
  renderSetlistPresetPicker();
  renderBlocks();
  renderPolyrhythmDots();
  renderWarmup();
  renderStats();
  renderPatternsList();
  renderProfilesUI();
  if (state.patterns.length) loadPatternToEditor(state.currentPatternId || state.patterns[0].id);
  attachEventListeners();
  elements.startCalibration.disabled = false;
  elements.tapCalibration.disabled = true;
  metronome.onTick = handleTick;
  metronome.onPolyTick = handlePolyTick;
  metronome.onBar = handleBar;
  updateMoodSuggestion();
  updatePhraseStatus({ bar: 0 });
  offlineIndicator();
  registerServiceWorker();
  initAudioContextWatcher();
  initMidi();
  initHelper();
  initDebug();
  trainer.warmups = state.warmups;
  tempoMonitor.onStatusChange(updateMicMonitorUI);
  audioInput.onOnset(({ time }) => {
    processTap(time * 1000, true);
    tempoMonitor.handleOnset(time);
    state.mic.lastHitAt = Date.now();
    state.mic.hits += 1;
    setMicStatus('Mic on • hit detected', 'green');
    updateMicMonitorUI();
  });
  state.mic.supported = audioInput.isSupported ? audioInput.isSupported() : true;
  if (!state.mic.supported) {
    setMicStatus('Mic not supported in this browser', 'red');
    if (elements.micToggle) elements.micToggle.disabled = true;
  } else if (state.settings.micMonitorEnabled) {
    if (elements.micToggle) elements.micToggle.checked = true;
    enableMicMonitor();
  } else {
    updateMicMonitorUI();
  }
  // Periodic sanity ping to ensure mic still capturing.
  setInterval(() => {
    if (!state.settings.micMonitorEnabled || !audioInput.enabled) return;
    if (state.mic.lastHitAt && Date.now() - state.mic.lastHitAt > 7000) {
      setMicStatus('Mic on • no hits yet', 'yellow');
      updateMicMonitorUI();
    }
  }, 3000);
  renderPatternsList();
}

renderRhythmMap();
init();
