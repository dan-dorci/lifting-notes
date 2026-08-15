import { html, useState, TopBar, navigate, setsSummary } from '../ui.js';
import * as state from '../state.js';

const blankSet = () => ({ id: null, weight: 0, microPlate: false, repMin: 8, repMax: 12, isDropSet: false });

function EditSetRow({ set, onChange, onDelete, onMove, first, last }) {
  const upd = (patch) => onChange({ ...set, ...patch, id: null }); // any edit ⇒ fresh id in state.js
  return html`
    <div class="edit-set-row">
      <input type="number" inputmode="decimal" step="2.5" value=${set.weight}
        onInput=${(e) => upd({ weight: e.target.value })} />
      <button class=${`toggle${set.microPlate ? ' on' : ''}`}
        onClick=${() => upd({ microPlate: !set.microPlate })}>$</button>
      <input type="number" inputmode="numeric" value=${set.repMin}
        onInput=${(e) => upd({ repMin: e.target.value })} />
      <span class="reps-sep">–</span>
      <input type="number" inputmode="numeric" value=${set.repMax}
        onInput=${(e) => upd({ repMax: e.target.value })} />
      <button class=${`toggle${set.isDropSet ? ' on' : ''}`} title="drop set — no rest"
        onClick=${() => upd({ isDropSet: !set.isDropSet })}>DROP</button>
      <button class="icon-btn" disabled=${first} onClick=${() => onMove(-1)}>▲</button>
      <button class="icon-btn" disabled=${last} onClick=${() => onMove(1)}>▼</button>
      <button class="icon-btn danger" onClick=${onDelete}>✕</button>
    </div>`;
}

export function ExerciseEdit({ exId }) {
  const ex = state.getExercise(exId);
  const cur = ex && state.currentVersion(ex);
  const [name, setName] = useState(cur ? cur.name : '');
  // Local draft of sets; ids preserved for untouched sets so ✅ marks survive.
  const [sets, setSets] = useState(cur ? cur.sets.map((s) => ({ ...s })) : []);
  const [setupNotes, setSetupNotes] = useState(ex ? ex.setupNotes : '');
  const [notes, setNotes] = useState(ex ? ex.notes : '');
  const [altName, setAltName] = useState('');
  if (!ex) return html`<div class="empty">Exercise not found.</div>`;

  const save = () => {
    state.updatePrescription(ex.id, name.trim() || cur.name, sets);
    state.updateNotes(ex.id, setupNotes.trim(), notes.trim());
    navigate(`/ex/${ex.id}`);
  };

  const changeSet = (i, next) => setSets(sets.map((s, j) => (j === i ? next : s)));
  const moveSet = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= sets.length) return;
    const copy = [...sets];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    setSets(copy);
  };

  const hasHistory = state.completionsFor(ex.id).length > 0;

  return html`
    <${TopBar} title="Edit" back=${`/ex/${ex.id}`}
      right=${html`<button onClick=${save}><b>Save</b></button>`} />
    <div class="screen">
      <label class="field"><span>Name</span>
        <input value=${name} onInput=${(e) => setName(e.target.value)} />
      </label>

      <div class="section">Sets — weight, $, rep range, drop</div>
      ${sets.map((s, i) => html`
        <${EditSetRow} key=${i} set=${s}
          onChange=${(next) => changeSet(i, next)}
          onDelete=${() => setSets(sets.filter((_, j) => j !== i))}
          onMove=${(d) => moveSet(i, d)}
          first=${i === 0} last=${i === sets.length - 1} />`)}
      <button class="btn-quiet" onClick=${() =>
        setSets([...sets, sets.length ? { ...sets[sets.length - 1], id: null } : blankSet()])}>
        + Add set
      </button>
      <div class="hint">Changing name or sets records a new version — history keeps the old prescription.</div>

      <label class="field"><span>Setup notes (seat heights, grips…)</span>
        <textarea value=${setupNotes} onInput=${(e) => setSetupNotes(e.target.value)} />
      </label>
      <label class="field"><span>Notes (cues, warnings…)</span>
        <textarea value=${notes} onInput=${(e) => setNotes(e.target.value)} />
      </label>

      <div class="section">Alternatives</div>
      <div class="row" style="margin-bottom:8px">
        <input class="grow" placeholder="New alternative name" value=${altName}
          onInput=${(e) => setAltName(e.target.value)} />
        <button class="btn-quiet" onClick=${() => {
          const n = altName.trim();
          if (!n) return;
          const id = state.addAlternative(ex.id, n);
          navigate(`/ex/${id}/edit`);
        }}>Add</button>
      </div>
      <button class="btn-quiet" onClick=${() => navigate(`/ex/${ex.id}/linkalt`)}>
        Link existing exercise as ALT
      </button>
      ${ex.altGroupId && html`
        <button class="btn-quiet btn-danger" style="margin-left:8px"
          onClick=${() => state.leaveAltGroup(ex.id)}>Leave ALT group</button>`}

      <div class="section">Danger zone</div>
      ${ex.archived
        ? html`<button class="btn-quiet" onClick=${() => state.setArchived(ex.id, false)}>Unarchive</button>`
        : html`<button class="btn-quiet btn-danger" onClick=${() => {
            if (confirm(hasHistory
              ? 'Archive this exercise? Its history is kept.'
              : 'Delete this exercise? It has no history and will be removed.')) {
              state.deleteExercise(ex.id);
              navigate('/');
            }
          }}>${hasHistory ? 'Archive exercise' : 'Delete exercise'}</button>`}
    </div>`;
}

export function LinkAltPicker({ exId }) {
  const ex = state.getExercise(exId);
  if (!ex) return html`<div class="empty">Exercise not found.</div>`;
  const candidates = state.getDoc().exercises.filter((e) =>
    e.id !== ex.id && !e.archived && (!e.altGroupId || e.altGroupId !== ex.altGroupId));
  return html`
    <${TopBar} title="Link as ALT" back=${`/ex/${exId}/edit`} />
    <div class="screen">
      <div class="hint">The linked exercise becomes an alternative of “${state.exName(ex)}”.</div>
      ${candidates.map((c) => html`
        <a class="card" key=${c.id} href="#"
          onClick=${(e) => { e.preventDefault(); state.joinAltGroup(ex.id, c.id); navigate(`/ex/${exId}/edit`); }}>
          <div class="ex-name">${state.exName(c)}</div>
          <div class="ex-sub">${setsSummary(state.currentVersion(c))}</div>
        </a>`)}
    </div>`;
}
