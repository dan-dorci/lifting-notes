import { html, useState, TopBar, setsSummary } from '../ui.js';
import * as state from '../state.js';

export function Library() {
  const [showArchived, setShowArchived] = useState(false);
  const doc = state.getDoc();
  const dayNames = (exId) =>
    doc.days.filter((d) => d.exerciseIds.includes(exId)).map((d) => d.name).join(', ');
  const exs = doc.exercises
    .filter((e) => showArchived || !e.archived)
    .sort((a, b) => state.exName(a).localeCompare(state.exName(b)));
  return html`
    <${TopBar} title="All exercises" back="/"
      right=${html`<button onClick=${() => setShowArchived(!showArchived)}>
        ${showArchived ? 'Hide arch.' : 'Archived'}</button>`} />
    <div class="screen">
      ${exs.map((ex) => html`
        <a class="card" key=${ex.id} href=${`#/ex/${ex.id}`}>
          <div class="row">
            <div class="grow">
              <div class="ex-name">${state.exName(ex)}</div>
              <div class="ex-sub">
                ${setsSummary(state.currentVersion(ex))}
                ${dayNames(ex.id) && html` — ${dayNames(ex.id)}`}
              </div>
            </div>
            ${!ex.isPrimary && html`<span class="badge alt">ALT</span>`}
            ${ex.archived && html`<span class="badge archived">archived</span>`}
          </div>
        </a>`)}
    </div>`;
}
