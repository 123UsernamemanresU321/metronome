// Pattern storage and editor helpers.
export const DEFAULT_PATTERNS = [
  {
    id: 'clave',
    name: 'Son Clave',
    timeSignature: '4/4',
    subdivision: 16,
    steps: [1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0],
    author: 'Built-in',
  },
  {
    id: 'sync',
    name: 'Syncopation',
    timeSignature: '4/4',
    subdivision: 16,
    steps: [1, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0],
    author: 'Built-in',
  },
  {
    id: 'off',
    name: 'Off-beat 8ths',
    timeSignature: '4/4',
    subdivision: 8,
    steps: [0, 1, 0, 1, 0, 1, 0, 1],
    author: 'Built-in',
  },
];

export function createEmptyPattern() {
  return {
    id: `p-${Date.now()}`,
    name: 'New Pattern',
    timeSignature: '4/4',
    subdivision: 16,
    steps: new Array(16).fill(0),
    author: 'You',
  };
}

export function toggleStep(pattern, index) {
  const next = { ...pattern };
  const current = pattern.steps[index] || 0;
  // 0 -> 1 (hit), 1 -> 2 (accent), 2 -> 0 (rest)
  const nextVal = current === 0 ? 1 : current === 1 ? 2 : 0;
  next.steps = pattern.steps.map((v, i) => (i === index ? nextVal : v));
  return next;
}

export function patternDuration(pattern) {
  const beats = parseInt(pattern.timeSignature.split('/')[0], 10) || 4;
  return (pattern.steps.length / pattern.subdivision) * beats;
}
