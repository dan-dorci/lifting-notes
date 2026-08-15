import { html, TopBar, navigate, setsSummary, fmtWeight, fmtReps, fmtDate, fmtTime } from '../ui.js';
import * as state from '../state.js';

function SetRow({ ex, set }) {
  const hit = ex.hitTopSetIds.includes(set.id);
  return html`
    <div class=${`set-row${set.isDropSet ? ' drop' : ''}`}>
      <div class="set-weight">${set.weight}${set.microPlate && html`<span class="micro">$</span>`}</div>
      <div class="set-reps">
        ${fmtReps(set)} reps
        ${set.isDropSet && html` <span class="set-drop-tag">DROP — no rest</span>`}
      </div>
      <button class=${`check${hit ? ' on' : ''}`} aria-label="hit top of range"
        onClick=${() => state.toggleHitTop(ex.id, set.id)}>✓</button>
    </div>`;
}

function History({ ex }) {
  const completions = state.completionsFor(ex.id);
  if (completions.length === 0) return html`<div class="hint">No completions yet.</div>`;
  return html`
    ${completions.map((c, i) => {
      const v = state.versionById(ex, c.versionId);
      const older = completions[i + 1];
      const changed = older && older.versionId !== c.versionId;
      return html`
        <div class="hist-row" key=${c.id}>
          <div class="hist-date">${fmtDate(c.completedAt)}</div>
          <div class="hist-rx">
            ${v ? setsSummary(v) : '(version missing)'}
            ${v && v.name !== state.exName(ex) && html` <span class="hint">as “${v.name}”</span>`}
          </div>
          ${changed && html`<span class="hist-change">changed</span>`}
        </div>`;
    })}`;
}

export function ExerciseView({ exId }) {
  const ex = state.getExercise(exId);
  if (!ex) return html`<div class="empty">Exercise not found.</div>`;
  const cur = state.currentVersion(ex);
  const alts = state.altSiblings(ex);
  const doneToday = state.completedToday(ex.id);
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
        ${cur.sets.map((s) => html`<${SetRow} key=${s.id} ex=${ex} set=${s} />`)}
      </div>
      <div class="hint">
        Tap ✓ when a set hits the top of its rep range.
        ${allHit && html`<b> All sets hit — time to raise the weight.</b>`}
      </div>

      ${doneToday
        ? html`
          <button class="btn-solid done" onClick=${() => state.undoCompletion(doneToday.id)}>
            ✓ Completed at ${fmtTime(doneToday.completedAt)} — tap to undo
          </button>`
        : html`
          <button class="btn-solid" onClick=${() => state.logCompletion(ex.id)}>Completed</button>`}

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

      <div class="section">History</div>
      <${History} ex=${ex} />
    </div>`;
}
