import { html, useState, useRef, TopBar, navigate, setsSummary } from '../ui.js';
import * as state from '../state.js';
import { useLongPressReorder } from '../dnd.js';

function ExerciseRow({ ex, editing, dayId, lifted, rowRef, onPointerDown, onClickGuard }) {
  const cur = state.currentVersion(ex);
  const alts = state.altSiblings(ex);
  const done = state.groupCompletedToday(ex);
  const click = (e) => {
    onClickGuard(e);
    if (editing) e.preventDefault();
  };
  return html`
    <a class=${`card draggable${lifted ? ' lifting' : ''}`}
      href=${`#/ex/${ex.id}`} ref=${rowRef}
      onPointerDown=${onPointerDown} onClick=${click}>
      <div class="row">
        <div class="grow">
          <div class="ex-name">${cur.name}</div>
          <div class="ex-sub">${setsSummary(cur)}</div>
        </div>
        ${!editing && alts.length > 0 && html`<span class="badge alt">${alts.length} ALT</span>`}
        ${!editing && done && html`<span class="dot-done">✓</span>`}
        ${editing && html`
          <button class="icon-btn danger"
            onPointerDown=${(e) => e.stopPropagation()}
            onClick=${(e) => { e.preventDefault(); state.removeFromDay(dayId, ex.id); }}>✕</button>`}
      </div>
    </a>`;
}

export function DayView({ dayId }) {
  const [editing, setEditing] = useState(false);
  const screenRef = useRef(null);
  const day = state.getDay(dayId);

  const dnd = useLongPressReorder({
    getIds: () => state.getDay(dayId).exerciseIds,
    onCommit: (ids) => state.reorderDay(dayId, ids),
    scrollEl: () => screenRef.current,
  });

  if (!day) return html`<div class="empty">Day not found.</div>`;
  const orderedIds = dnd.order || day.exerciseIds;
  const exs = orderedIds.map(state.getExercise).filter((e) => e && (!e.archived || editing));

  return html`
    <${TopBar} title=${day.name} back="/"
      right=${html`<button onClick=${() => setEditing(!editing)}>${editing ? 'Done' : 'Edit'}</button>`} />
    <div class="screen" ref=${screenRef}>
      ${exs.length === 0 && html`<div class="empty">No exercises yet.</div>`}
      ${exs.map((ex) => html`
        <${ExerciseRow} key=${ex.id} ex=${ex} editing=${editing} dayId=${dayId}
          lifted=${dnd.dragId === ex.id}
          rowRef=${dnd.rowRef(ex.id)}
          onPointerDown=${dnd.onPointerDown(ex.id)}
          onClickGuard=${dnd.onClickGuard} />`)}
      ${exs.length > 1 && html`<div class="hint">Hold a cell, then drag to reorder.</div>`}
      ${editing && html`
        <button class="btn-solid" onClick=${() => navigate(`/day/${dayId}/add`)}>+ Add exercise</button>`}
    </div>`;
}

// Picker: add an existing exercise (not already in this day) or create a new one.
export function DayAddPicker({ dayId }) {
  const [name, setName] = useState('');
  const day = state.getDay(dayId);
  if (!day) return html`<div class="empty">Day not found.</div>`;
  const inDay = new Set(day.exerciseIds);
  const candidates = state.getDoc().exercises.filter((e) => !inDay.has(e.id) && !e.archived);
  const create = () => {
    const n = name.trim();
    if (!n) return;
    const id = state.createExercise({ name: n, dayId });
    navigate(`/ex/${id}/edit`);
  };
  return html`
    <${TopBar} title="Add to ${day.name}" back=${`/day/${dayId}`} />
    <div class="screen">
      <div class="section">New exercise</div>
      <div class="row" style="margin-bottom:8px">
        <input class="grow" placeholder="Exercise name" value=${name}
          onInput=${(e) => setName(e.target.value)} />
        <button class="btn-quiet" onClick=${create}>Create</button>
      </div>
      <div class="hint">Creates the exercise, adds it to ${day.name}, and opens the set editor.</div>
      ${candidates.length > 0 && html`
        <div class="section">Existing exercises</div>
        ${candidates.map((ex) => html`
          <a class="card" key=${ex.id} href="#"
            onClick=${(e) => { e.preventDefault(); state.addToDay(dayId, ex.id); navigate(`/day/${dayId}`); }}>
            <div class="row">
              <div class="grow">
                <div class="ex-name">${state.exName(ex)}</div>
                <div class="ex-sub">${setsSummary(state.currentVersion(ex))}</div>
              </div>
              ${!ex.isPrimary && html`<span class="badge alt">ALT</span>`}
            </div>
          </a>`)}`}
    </div>`;
}
