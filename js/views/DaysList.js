import { html, TopBar } from '../ui.js';
import * as state from '../state.js';

export function DaysList() {
  const doc = state.getDoc();
  const days = [...doc.days].sort((a, b) => a.order - b.order);
  return html`
    <${TopBar} title="Lifting Notes" />
    <div class="screen">
      ${days.map((day) => {
        const exs = day.exerciseIds.map(state.getExercise).filter((e) => e && !e.archived);
        const done = exs.filter((e) => state.groupCompletedToday(e)).length;
        return html`
          <a class="card day-card" key=${day.id} href=${`#/day/${day.id}`}>
            <div class="row">
              <div class="grow">${day.name}</div>
              ${done > 0 && html`<span class="badge done">${done}/${exs.length} today</span>`}
            </div>
            <div class="meta">${exs.length} exercises</div>
          </a>`;
      })}
      <div class="footer-links">
        <a href="#/library">All exercises</a>
        <a href="#/settings">Settings</a>
      </div>
    </div>`;
}
