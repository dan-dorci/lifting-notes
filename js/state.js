// In-memory store over the single JSON document, with action functions that
// mutate → bump rev → persist (debounced) → notify subscribers.

import * as db from './db.js';

let doc = null;
const subscribers = new Set();
let saveTimer = null;

const uid = (p) => `${p}_${crypto.randomUUID().slice(0, 13)}`;

export function getDoc() { return doc; }

export function subscribe(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

function notify() { subscribers.forEach((fn) => fn()); }

function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => db.save(doc), 300);
}

// Every mutation goes through here.
function mutate(fn) {
  fn(doc);
  doc.rev++;
  persist();
  notify();
}

export async function init() {
  doc = await db.load();
  if (!doc) {
    const res = await fetch('./data/seed.json');
    doc = await res.json();
    await db.save(doc);
    // Fresh install: don't nag for a backup on day one.
    if (!localStorage.getItem('lastBackupAt')) {
      localStorage.setItem('lastBackupAt', new Date().toISOString());
      localStorage.setItem('lastBackupRev', String(doc.rev));
    }
  }
  notify();
}

export function replaceDoc(newDoc) {
  doc = newDoc;
  persist();
  notify();
}

// ---------- lookups ----------

export const getDay = (id) => doc.days.find((d) => d.id === id);
export const getExercise = (id) => doc.exercises.find((e) => e.id === id);
export const currentVersion = (ex) => ex.versions[ex.versions.length - 1];
export const exName = (ex) => currentVersion(ex).name;

export function versionById(ex, vId) {
  return ex.versions.find((v) => v.id === vId) || null;
}

export function altSiblings(ex) {
  if (!ex.altGroupId) return [];
  return doc.exercises.filter((e) => e.altGroupId === ex.altGroupId && e.id !== ex.id && !e.archived);
}

export function completionsFor(exId) {
  // Newest first; ties (same-ms timestamps) broken by insertion order, which
  // is chronological since completions are only ever appended.
  return doc.completions
    .map((c, i) => [c, i])
    .filter(([c]) => c.exerciseId === exId)
    .sort(([a, ai], [b, bi]) => b.completedAt.localeCompare(a.completedAt) || bi - ai)
    .map(([c]) => c);
}

const isToday = (iso) => {
  const d = new Date(iso), n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
};

export function completedToday(exId) {
  return doc.completions.find((c) => c.exerciseId === exId && isToday(c.completedAt)) || null;
}

// Done-today counts the exercise or any alt sibling.
export function groupCompletedToday(ex) {
  if (completedToday(ex.id)) return true;
  return altSiblings(ex).some((s) => completedToday(s.id));
}

export function lastCompletion(exId) {
  return completionsFor(exId)[0] || null;
}

// Exercises not referenced by any day.
export function unassignedExercises() {
  const inDays = new Set(doc.days.flatMap((d) => d.exerciseIds));
  return doc.exercises.filter((e) => !inDays.has(e.id));
}

// ---------- prescription versioning ----------

const setsEqual = (a, b) =>
  a.length === b.length &&
  a.every((s, i) =>
    s.weight === b[i].weight && s.microPlate === b[i].microPlate &&
    s.repMin === b[i].repMin && s.repMax === b[i].repMax && s.isDropSet === b[i].isDropSet);

function versionHasCompletions(vId) {
  return doc.completions.some((c) => c.versionId === vId);
}

// newSets: [{id?, weight, microPlate, repMin, repMax, isDropSet}] — sets carried
// over unchanged keep their id (so ✅ marks survive); edited/new sets get fresh ids.
export function updatePrescription(exId, name, newSets) {
  mutate(() => {
    const ex = getExercise(exId);
    const cur = currentVersion(ex);
    const sets = newSets.map((s) => ({
      id: s.id || uid('set'),
      weight: Number(s.weight) || 0,
      microPlate: !!s.microPlate,
      repMin: Number(s.repMin) || 0,
      repMax: Number(s.repMax) || 0,
      isDropSet: !!s.isDropSet,
    }));
    if (cur.name === name && setsEqual(cur.sets, sets)) return; // no-op
    if (!versionHasCompletions(cur.id)) {
      // Nothing logged against it — edit in place, no orphan version.
      cur.name = name;
      cur.sets = sets;
    } else {
      ex.versions.push({ id: uid('v'), createdAt: new Date().toISOString(), name, sets });
    }
    // Prune ✅ marks that point at sets no longer in the current prescription.
    const liveIds = new Set(currentVersion(ex).sets.map((s) => s.id));
    ex.hitTopSetIds = ex.hitTopSetIds.filter((id) => liveIds.has(id));
  });
}

export function updateNotes(exId, setupNotes, notes) {
  mutate(() => {
    const ex = getExercise(exId);
    ex.setupNotes = setupNotes;
    ex.notes = notes;
  });
}

export function toggleHitTop(exId, setId) {
  mutate(() => {
    const ex = getExercise(exId);
    const i = ex.hitTopSetIds.indexOf(setId);
    if (i >= 0) ex.hitTopSetIds.splice(i, 1);
    else ex.hitTopSetIds.push(setId);
  });
}

// ---------- exercises ----------

export function createExercise({ name, dayId = null, altGroupId = null, isPrimary = true }) {
  const ex = {
    id: uid('ex'),
    setupNotes: '',
    notes: '',
    altGroupId,
    isPrimary,
    archived: false,
    hitTopSetIds: [],
    versions: [{
      id: uid('v'),
      createdAt: new Date().toISOString(),
      name,
      sets: [{ id: uid('set'), weight: 0, microPlate: false, repMin: 8, repMax: 12, isDropSet: false }],
    }],
  };
  mutate(() => {
    doc.exercises.push(ex);
    if (dayId) getDay(dayId).exerciseIds.push(ex.id);
  });
  return ex.id;
}

export function setArchived(exId, archived) {
  mutate(() => { getExercise(exId).archived = archived; });
}

// Hard-delete only when no completions reference it; otherwise archive.
export function deleteExercise(exId) {
  mutate(() => {
    const ex = getExercise(exId);
    doc.days.forEach((d) => { d.exerciseIds = d.exerciseIds.filter((id) => id !== exId); });
    if (doc.completions.some((c) => c.exerciseId === exId)) {
      ex.archived = true;
    } else {
      doc.exercises = doc.exercises.filter((e) => e.id !== exId);
    }
  });
}

// ---------- alt groups ----------

export function addAlternative(exId, altName) {
  const ex = getExercise(exId);
  let groupId = ex.altGroupId;
  if (!groupId) {
    groupId = uid('alt');
    mutate(() => { ex.altGroupId = groupId; ex.isPrimary = true; });
  }
  return createExercise({ name: altName, altGroupId: groupId, isPrimary: false });
}

export function joinAltGroup(exId, otherExId) {
  mutate(() => {
    const ex = getExercise(exId);
    const other = getExercise(otherExId);
    if (!ex.altGroupId) { ex.altGroupId = uid('alt'); ex.isPrimary = true; }
    other.altGroupId = ex.altGroupId;
    other.isPrimary = false;
  });
}

export function leaveAltGroup(exId) {
  mutate(() => {
    const ex = getExercise(exId);
    const groupId = ex.altGroupId;
    ex.altGroupId = null;
    ex.isPrimary = true;
    const rest = doc.exercises.filter((e) => e.altGroupId === groupId);
    if (rest.length === 1) { rest[0].altGroupId = null; rest[0].isPrimary = true; }
    else if (rest.length > 1 && !rest.some((e) => e.isPrimary)) rest[0].isPrimary = true;
  });
}

export function makePrimary(exId) {
  mutate(() => {
    const ex = getExercise(exId);
    if (!ex.altGroupId) return;
    doc.exercises.forEach((e) => {
      if (e.altGroupId === ex.altGroupId) e.isPrimary = (e.id === exId);
    });
  });
}

// ---------- days ----------

export function addToDay(dayId, exId) {
  mutate(() => {
    const d = getDay(dayId);
    if (!d.exerciseIds.includes(exId)) d.exerciseIds.push(exId);
  });
}

export function removeFromDay(dayId, exId) {
  mutate(() => {
    const d = getDay(dayId);
    d.exerciseIds = d.exerciseIds.filter((id) => id !== exId);
  });
}

// Replace a day's order with the given ids; ids not in the day are ignored,
// ids missing from the list are appended (safety against stale drag state).
export function reorderDay(dayId, orderedIds) {
  mutate(() => {
    const d = getDay(dayId);
    const valid = new Set(d.exerciseIds);
    const next = orderedIds.filter((id) => valid.has(id));
    const seen = new Set(next);
    d.exerciseIds = [...next, ...d.exerciseIds.filter((id) => !seen.has(id))];
  });
}

export function moveInDay(dayId, exId, delta) {
  mutate(() => {
    const ids = getDay(dayId).exerciseIds;
    const i = ids.indexOf(exId);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
  });
}

// ---------- completions ----------

export function logCompletion(exId) {
  mutate(() => {
    const ex = getExercise(exId);
    doc.completions.push({
      id: uid('cmp'),
      exerciseId: exId,
      versionId: currentVersion(ex).id,
      completedAt: new Date().toISOString(),
    });
  });
}

export function undoCompletion(cmpId) {
  mutate(() => {
    doc.completions = doc.completions.filter((c) => c.id !== cmpId);
  });
}
