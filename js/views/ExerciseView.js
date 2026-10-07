import { html, TopBar, navigate, setsSummary, fmtReps, fmtTime } from '../ui.js';
import * as state from '../state.js';
import { ProgressChart, ProgressLog } from './ProgressChart.js';

function SetRow({ ex, set, entered }) {
  const hit = ex.hitTopSetIds.includes(set.id);
  const commit = (e) => {
    const v = e.target.value.trim();
    state.logSetReps(ex.id, set.id, v === '' ? null : Math.max(0, Math.round(Number(v)) || 0));
  };
  return html`
    <div class=${`set-row${set.isDropSet ? ' drop' : ''}`}>
      <div class="set-weight">${set.weight}${set.microPlate && html`<span class="micro">$</span>`}</div>
      <div class="set-reps">
        ${fmtReps(set)} reps
        ${set.isDropSet && html` <span class="set-drop-tag">DROP — no rest</span>`}
      </div>
      <input class=${`rep-input${entered != null ? ' got' : ''}`} type="number"
        inputmode="numeric" placeholder="—" aria-label="reps done"
        value=${entered ?? ''} onChange=${commit} />
      <button class=${`check${hit ? ' on' : ''}`} aria-label="hit top of range"
        onClick=${() => state.toggleHitTop(ex.id, set.id)}>✓</button>
    </div>`;
}

export function ExerciseView({ exId }) {
  const ex = state.getExercise(exId);
  if (!ex) return html`<div class="empty">Exercise not found.</div>`;
  const cur = state.currentVersion(ex);
  const alts = state.altSiblings(ex);
  const doneToday = state.completedToday(ex.id);
  const entered = state.todayReps(ex.id);
  const nEntered = cur.sets.filter((s) => entered[s.id] != null).length;
  const allHit = cur.sets.length > 0 && cur.sets.every((s) => ex.hitTopSetIds.includes(s.id));

  // Back target: the day containing this exercise, else library.
  const day = state.getDoc().days.find((d) => d.exerciseIds.includes(ex.id));
  const back = day ? `/day/${day.id}` : '/library';

  return html`
    <${TopBar} title=${cur.name} back=${back}
      right=${html`<button onClick=${() => navigate(`/ex/${ex.id}/edit`)}>Edit</button>`} />
    <div class="screen">
      ${ex.archived && html`<div class="banner">This exercise is archived.</div>`}

      <div class="sets">
        ${cur.sets.map((s) => html`
          <${SetRow} key=${s.id} ex=${ex} set=${s} entered=${entered[s.id]} />`)}
      </div>
      <div class="hint">
        Enter the reps you hit as you finish each set — that logs the session.
        Top of the range marks ✓ automatically.
        ${allHit && html`<b> All sets hit — time to raise the weight.</b>`}
      </div>

      ${doneToday && html`
        <div class="today-status">
          <span class="grow">
            ✓ ${nEntered}/${cur.sets.length} sets logged today
            (started ${fmtTime(doneToday.completedAt)})
          </span>
          <button class="btn-quiet btn-danger"
            onClick=${() => confirm('Clear everything logged today for this exercise?')
              && state.undoCompletion(doneToday.id)}>Clear</button>
        </div>`}

      ${ex.setupNotes && html`
        <div class="notes-block" style="margin-top:14px">
          <div class="label">Setup</div>${ex.setupNotes}
        </div>`}
      ${ex.notes && html`
        <div class="notes-block" style=${ex.setupNotes ? '' : 'margin-top:14px'}>
          <div class="label">Notes</div>${ex.notes}
        </div>`}

      ${alts.length > 0 && html`
        <div class="section">Alternatives</div>
        ${alts.map((alt) => html`
          <a class="card" key=${alt.id} href=${`#/ex/${alt.id}`}>
            <div class="row">
              <div class="grow">
                <div class="ex-name">${state.exName(alt)}</div>
                <div class="ex-sub">${setsSummary(state.currentVersion(alt))}</div>
              </div>
              ${state.completedToday(alt.id) && html`<span class="dot-done">✓</span>`}
            </div>
          </a>`)}
        ${!ex.isPrimary && html`
          <button class="btn-quiet" onClick=${() => state.makePrimary(ex.id)}>
            Make this the primary
          </button>`}`}

      <div class="section">Progress</div>
      <${ProgressChart} ex=${ex} />
      <${ProgressLog} ex=${ex} />
    </div>`;
}
