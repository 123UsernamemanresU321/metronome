// LocalStorage helpers for settings, presets, setlists, sessions, and warmups.

const SETTINGS_KEY = 'piano-metronome-settings';
const PRESETS_KEY = 'piano-metronome-presets';
const SETLISTS_KEY = 'piano-metronome-setlists';
const SESSIONS_KEY = 'piano-metronome-sessions';
const WARMUPS_KEY = 'piano-metronome-warmups';
const PATTERNS_KEY = 'piano-metronome-patterns';
const COACH_KEY = 'piano-metronome-coach';
const VERSION_KEY = 'piano-metronome-version';

const PROFILE_META_KEY = 'piano-metronome-profiles';
const PROFILE_DATA_KEY = 'piano-metronome-profiles-data';
const CURRENT_PROFILE_KEY = 'piano-metronome-current-profile';

const safeParse = (value, fallback) => {
  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch (e) {
    return fallback;
  }
};

function ensureProfiles() {
  let meta = safeParse(localStorage.getItem(PROFILE_META_KEY), null);
  let data = safeParse(localStorage.getItem(PROFILE_DATA_KEY), null);
  let current = localStorage.getItem(CURRENT_PROFILE_KEY);
  if (!meta || !data) {
    // migrate legacy single-profile data into the profile store
    const legacy = {
      settings: safeParse(localStorage.getItem(SETTINGS_KEY), {}),
      presets: safeParse(localStorage.getItem(PRESETS_KEY), []),
      setlists: safeParse(localStorage.getItem(SETLISTS_KEY), []),
      sessions: safeParse(localStorage.getItem(SESSIONS_KEY), []),
      warmups: safeParse(localStorage.getItem(WARMUPS_KEY), {}),
      patterns: safeParse(localStorage.getItem(PATTERNS_KEY), []),
      coach: safeParse(localStorage.getItem(COACH_KEY), null),
    };
    meta = [{ id: 'profile-default', name: 'Player 1', instrument: 'Piano' }];
    data = { 'profile-default': legacy };
    current = 'profile-default';
    localStorage.setItem(PROFILE_META_KEY, JSON.stringify(meta));
    localStorage.setItem(PROFILE_DATA_KEY, JSON.stringify(data));
    localStorage.setItem(CURRENT_PROFILE_KEY, current);
  }
  if (!current && meta && meta.length) {
    current = meta[0].id;
    localStorage.setItem(CURRENT_PROFILE_KEY, current);
  }
  return { meta, data, current };
}

export function loadProfilesMeta() {
  const { meta } = ensureProfiles();
  return meta || [];
}

export function saveProfilesMeta(meta) {
  ensureProfiles();
  try {
    localStorage.setItem(PROFILE_META_KEY, JSON.stringify(meta));
  } catch (e) {}
}

export function loadCurrentProfileId() {
  const { current, meta } = ensureProfiles();
  if (current) return current;
  return meta && meta[0] ? meta[0].id : 'profile-default';
}

export function saveCurrentProfileId(id) {
  ensureProfiles();
  try {
    localStorage.setItem(CURRENT_PROFILE_KEY, id);
  } catch (e) {}
}

function loadProfileData() {
  const { data } = ensureProfiles();
  return data || {};
}

function saveProfileData(data) {
  try {
    localStorage.setItem(PROFILE_DATA_KEY, JSON.stringify(data));
  } catch (e) {}
}

function getCurrentSlot() {
  const current = loadCurrentProfileId();
  const data = loadProfileData();
  if (!data[current]) data[current] = {};
  return { current, data };
}

export function saveSettings(settings) {
  const { current, data } = getCurrentSlot();
  data[current].settings = settings;
  saveProfileData(data);
}

export function loadSettings(defaults = {}) {
  const { current, data } = getCurrentSlot();
  const stored = data[current]?.settings || safeParse(localStorage.getItem(SETTINGS_KEY), null);
  if (!stored) return { ...defaults };
  return { ...defaults, ...stored };
}

export function savePresets(presets) {
  const { current, data } = getCurrentSlot();
  data[current].presets = presets;
  saveProfileData(data);
}

export function loadPresets() {
  const { current, data } = getCurrentSlot();
  return data[current]?.presets || safeParse(localStorage.getItem(PRESETS_KEY), []) || [];
}

export function saveSetlists(setlists) {
  const { current, data } = getCurrentSlot();
  data[current].setlists = setlists;
  saveProfileData(data);
}

export function loadSetlists() {
  const { current, data } = getCurrentSlot();
  return data[current]?.setlists || safeParse(localStorage.getItem(SETLISTS_KEY), []) || [];
}

export function saveSessions(sessions) {
  const { current, data } = getCurrentSlot();
  data[current].sessions = sessions;
  saveProfileData(data);
}

export function loadSessions() {
  const { current, data } = getCurrentSlot();
  return data[current]?.sessions || safeParse(localStorage.getItem(SESSIONS_KEY), []) || [];
}

export function saveWarmups(warmups) {
  const { current, data } = getCurrentSlot();
  data[current].warmups = warmups;
  saveProfileData(data);
}

export function loadWarmups() {
  const { current, data } = getCurrentSlot();
  return data[current]?.warmups || safeParse(localStorage.getItem(WARMUPS_KEY), {}) || {};
}

export function savePatterns(patterns) {
  const { current, data } = getCurrentSlot();
  data[current].patterns = patterns;
  saveProfileData(data);
}

export function loadPatterns() {
  const { current, data } = getCurrentSlot();
  return data[current]?.patterns || safeParse(localStorage.getItem(PATTERNS_KEY), []) || [];
}

export function saveCoach(state) {
  const { current, data } = getCurrentSlot();
  data[current].coach = state;
  saveProfileData(data);
}

export function loadCoach() {
  const { current, data } = getCurrentSlot();
  return data[current]?.coach || safeParse(localStorage.getItem(COACH_KEY), null);
}

export function saveVersion(version) {
  try {
    localStorage.setItem(VERSION_KEY, JSON.stringify(version));
  } catch (e) {
    // Ignore.
  }
}

export function loadVersion() {
  return safeParse(localStorage.getItem(VERSION_KEY), 1);
}

export function exportAll(data) {
  const profiles = safeParse(localStorage.getItem(PROFILE_META_KEY), null);
  const profileData = safeParse(localStorage.getItem(PROFILE_DATA_KEY), null);
  const currentProfileId = localStorage.getItem(CURRENT_PROFILE_KEY);
  const bundle = {
    settings: safeParse(localStorage.getItem(SETTINGS_KEY), data.settings || {}),
    presets: safeParse(localStorage.getItem(PRESETS_KEY), data.presets || []),
    setlists: safeParse(localStorage.getItem(SETLISTS_KEY), data.setlists || []),
    sessions: safeParse(localStorage.getItem(SESSIONS_KEY), data.sessions || []),
    warmups: safeParse(localStorage.getItem(WARMUPS_KEY), data.warmups || {}),
    patterns: safeParse(localStorage.getItem(PATTERNS_KEY), data.patterns || []),
    coach: safeParse(localStorage.getItem(COACH_KEY), data.coach || null),
    version: loadVersion(),
    profiles,
    profilesData: profileData,
    currentProfileId,
  };
  return bundle;
}

export function importAll(bundle) {
  if (!bundle || typeof bundle !== 'object') return;
  if (bundle.profiles && bundle.profilesData) {
    try {
      localStorage.setItem(PROFILE_META_KEY, JSON.stringify(bundle.profiles));
      localStorage.setItem(PROFILE_DATA_KEY, JSON.stringify(bundle.profilesData));
      if (bundle.currentProfileId) localStorage.setItem(CURRENT_PROFILE_KEY, bundle.currentProfileId);
    } catch (e) {}
  } else {
    if (bundle.settings) saveSettings(bundle.settings);
    if (bundle.presets) savePresets(bundle.presets);
    if (bundle.setlists) saveSetlists(bundle.setlists);
    if (bundle.sessions) saveSessions(bundle.sessions);
    if (bundle.warmups) saveWarmups(bundle.warmups);
    if (bundle.patterns) savePatterns(bundle.patterns);
    if (bundle.coach) saveCoach(bundle.coach);
  }
  if (bundle.version) saveVersion(bundle.version);
}

export function saveProfileBundle(profileId, payload) {
  const data = loadProfileData();
  data[profileId] = { ...(data[profileId] || {}), ...payload };
  saveProfileData(data);
}

export function deleteProfileBundle(profileId) {
  const data = loadProfileData();
  delete data[profileId];
  saveProfileData(data);
}
