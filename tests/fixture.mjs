// Synthetic test data shaped like real usage: an alt group in Pull,
// a standalone exercise, and one in Legs for long-history tests.
const T = '2026-08-01T12:00:00.000Z';

const set = (id, weight, o = {}) => ({
  id, weight,
  microPlate: !!o.m,
  repMin: o.min ?? 8,
  repMax: o.max ?? 12,
  isDropSet: !!o.d,
});

const ex = (id, vId, name, sets, o = {}) => ({
  id,
  setupNotes: o.setup || '',
  notes: o.notes || '',
  altGroupId: o.alt || null,
  isPrimary: o.primary !== false,
  archived: false,
  hitTopSetIds: o.hit || [],
  versions: [{ id: vId, createdAt: T, name, sets }],
});

export function makeFixtureDoc() {
  return {
    schemaVersion: 1,
    rev: 5,
    days: [
      { id: 'pull', name: 'Pull', order: 0, exerciseIds: ['ex_row', 'ex_curl'] },
      { id: 'push', name: 'Push', order: 1, exerciseIds: [] },
      { id: 'legs', name: 'Legs', order: 2, exerciseIds: ['ex_ham'] },
      { id: 'therapy', name: 'Therapy', order: 3, exerciseIds: [] },
    ],
    exercises: [
      ex('ex_row', 'v_row1', 'Seated row',
        [set('s_r1', 145), set('s_r2', 145), set('s_r3', 145)],
        { alt: 'g1', hit: ['s_r1'], setup: 'Seat height 9.', notes: 'Pull with back.' }),
      ex('ex_plate', 'v_pl1', 'Plate row', [set('s_p1', 115)], { alt: 'g1', primary: false }),
      ex('ex_curl', 'v_cu1', 'Curls', [set('s_c1', 50), set('s_c2', 45, { m: 1 })]),
      ex('ex_ham', 'v_ha1', 'Hamstring curls', [set('s_h1', 140)]),
    ],
    completions: [],
  };
}
