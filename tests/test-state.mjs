// Logic tests for state.js: versioning rules, completions, alt groups, days.
// Run: node tests/test-state.mjs  (db persistence degrades gracefully in Node)
import * as state from '../js/state.js';
import { makeFixtureDoc } from './fixture.mjs';

let pass = 0, fail = 0;
const assert = (cond, msg) => {
  if (cond) { pass++; } else { fail++; console.error('FAIL:', msg); }
};

state.replaceDoc(makeFixtureDoc());
const doc = state.getDoc();

assert(doc.days.length === 4, 'four days');
assert(doc.exercises.length === 4, 'four exercises');

// --- versioning: edit with no completions ⇒ in-place, no new version ---
const ex = state.getExercise('ex_row');
const v0 = state.currentVersion(ex);
state.updatePrescription(ex.id, v0.name, v0.sets.map((s) => ({ ...s, weight: 150, id: null })));
assert(ex.versions.length === 1, 'no-completion edit stays in place');
assert(state.currentVersion(ex).sets[0].weight === 150, 'weight updated');
assert(state.currentVersion(ex).id === v0.id, 'version id unchanged on in-place edit');
assert(ex.hitTopSetIds.length === 0, 'in-place edit with fresh set ids prunes stale ✅');

// --- identical edit ⇒ no-op ---
const revBefore = doc.rev;
const cur = state.currentVersion(ex);
state.updatePrescription(ex.id, cur.name, cur.sets.map((s) => ({ ...s })));
assert(ex.versions.length === 1 && doc.rev === revBefore, 'identical edit is a no-op');

// --- completion pins the version; next edit appends ---
state.logCompletion(ex.id);
assert(state.completionsFor(ex.id).length === 1, 'completion logged');
assert(state.completionsFor(ex.id)[0].versionId === state.currentVersion(ex).id,
  'completion points at current version');
assert(state.completedToday(ex.id) != null, 'completedToday true');

state.updatePrescription(ex.id, cur.name, cur.sets.map((s) => ({ ...s, weight: 155, id: null })));
assert(ex.versions.length === 2, 'edit after completion appends a version');
const newV = state.currentVersion(ex), oldV = ex.versions[0];
assert(oldV.sets[0].weight === 150 && newV.sets[0].weight === 155, 'history preserves old weight');
assert(state.completionsFor(ex.id)[0].versionId === oldV.id, 'old completion resolves to old version');

// --- repeat sessions share one version, ordered stably ---
for (let i = 0; i < 4; i++) state.logCompletion(ex.id);
const cmps = state.completionsFor(ex.id);
assert(new Set(cmps.slice(0, 4).map((c) => c.versionId)).size === 1, 'repeat completions share versionId');
assert(cmps[cmps.length - 1].versionId === oldV.id, 'oldest completion sorts last despite same-ms ties');

// --- hitTop marks: survive untouched sets, pruned on changed sets ---
const keepId = state.currentVersion(ex).sets[0].id;
state.toggleHitTop(ex.id, keepId);
assert(ex.hitTopSetIds.includes(keepId), 'hitTop toggled on');
state.updatePrescription(ex.id, state.currentVersion(ex).name,
  state.currentVersion(ex).sets.map((s, i) => (i === 0 ? { ...s } : { ...s, weight: s.weight + 5, id: null })));
assert(ex.hitTopSetIds.includes(keepId), 'unchanged set keeps its ✅ across version bump');
state.updatePrescription(ex.id, state.currentVersion(ex).name,
  state.currentVersion(ex).sets.map((s) => ({ ...s, weight: 999, id: null })));
assert(ex.hitTopSetIds.length === 0, 'all-new sets clear ✅ marks');

// --- alt siblings + group completion ---
const plate = state.getExercise('ex_plate');
assert(state.altSiblings(ex).some((s) => s.id === plate.id), 'alt sibling found');
assert(state.groupCompletedToday(plate), 'sibling counts group completion today');

// --- day ops ---
const day = state.getDay('pull');
state.moveInDay('pull', 'ex_row', 1);
assert(day.exerciseIds[1] === 'ex_row', 'moved down');
state.moveInDay('pull', 'ex_row', -1);
assert(day.exerciseIds[0] === 'ex_row', 'moved back up');

const reversed = [...day.exerciseIds].reverse();
state.reorderDay('pull', reversed);
assert(day.exerciseIds.join() === reversed.join(), 'reorderDay applies full new order');
state.reorderDay('pull', ['bogus_id', ...reversed]);
assert(day.exerciseIds.length === reversed.length && !day.exerciseIds.includes('bogus_id'),
  'reorderDay ignores unknown ids');

// --- exact rep logging ---
const curl = state.getExercise('ex_curl');
state.logSetReps(curl.id, 's_c1', 11);
let c = state.completedToday(curl.id);
assert(c != null, 'first rep entry creates completion');
assert(c.reps['s_c1'] === 11, 'reps stored on completion');
assert(!curl.hitTopSetIds.includes('s_c1'), '11 < repMax 12: no auto-✅');
state.logSetReps(curl.id, 's_c2', 12);
assert(curl.hitTopSetIds.includes('s_c2'), 'repMax hit auto-marks ✅');
assert(state.completedToday(curl.id).id === c.id, 'second entry reuses completion');
assert(Object.keys(state.todayReps(curl.id)).length === 2, 'todayReps returns both');
state.logSetReps(curl.id, 's_c1', null);
assert(state.todayReps(curl.id)['s_c1'] === undefined, 'null clears an entry');
state.logSetReps(curl.id, 's_c2', null);
assert(state.completedToday(curl.id) == null, 'clearing last entry removes completion');

// --- undo ---
const todays = state.completedToday(ex.id);
const n = state.completionsFor(ex.id).length;
state.undoCompletion(todays.id);
assert(state.completionsFor(ex.id).length === n - 1, 'undo removes a completion');

// --- delete vs archive ---
const freshId = state.createExercise({ name: 'Temp', dayId: 'pull' });
state.deleteExercise(freshId);
assert(!state.getExercise(freshId), 'no-history exercise hard-deleted');
state.deleteExercise(ex.id);
assert(state.getExercise(ex.id)?.archived === true, 'exercise with history archived instead');
assert(!day.exerciseIds.includes(ex.id), 'archived exercise removed from day');

// --- alt group primary/leave ---
state.makePrimary(plate.id);
assert(plate.isPrimary === true && state.getExercise(ex.id).isPrimary === false, 'primary flipped');
state.leaveAltGroup(plate.id);
assert(plate.altGroupId === null && plate.isPrimary === true, 'left group, self-primary');
assert(state.getExercise(ex.id).altGroupId === null, 'last remaining member dissolved group');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
