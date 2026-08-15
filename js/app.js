import { html, render, useState, useEffect, parseRoute } from './ui.js';
import * as state from './state.js';
import { needsBackupPrompt, exportNow } from './backup.js';
import { DaysList } from './views/DaysList.js';
import { DayView, DayAddPicker } from './views/DayView.js';
import { ExerciseView } from './views/ExerciseView.js';
import { ExerciseEdit, LinkAltPicker } from './views/ExerciseEdit.js';
import { Library } from './views/Library.js';
import { Settings } from './views/Settings.js';

function BackupBanner({ onDismiss }) {
  const [busy, setBusy] = useState(false);
  return html`
    <div class="banner">
      <div class="grow">Backup is stale — save your data to Files.</div>
      <button class="btn-quiet" disabled=${busy} onClick=${async () => {
        setBusy(true);
        try { const r = await exportNow(); if (r !== 'cancelled') onDismiss(); }
        finally { setBusy(false); }
      }}>Back up</button>
      <button class="icon-btn" onClick=${onDismiss}>✕</button>
    </div>`;
}

function App() {
  const [, bump] = useState(0);
  const [ready, setReady] = useState(false);
  const [route, setRoute] = useState(parseRoute());
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    const onHash = () => setRoute(parseRoute());
    window.addEventListener('hashchange', onHash);
    const unsub = state.subscribe(() => bump((n) => n + 1));
    state.init().then(() => setReady(true));
    return () => { window.removeEventListener('hashchange', onHash); unsub(); };
  }, []);

  if (!ready) return html`<div class="empty">Loading…</div>`;

  let screen;
  switch (route.name) {
    case 'day': screen = html`<${DayView} dayId=${route.dayId} />`; break;
    case 'day-add': screen = html`<${DayAddPicker} dayId=${route.dayId} />`; break;
    case 'ex': screen = html`<${ExerciseView} exId=${route.exId} />`; break;
    case 'ex-edit': screen = html`<${ExerciseEdit} exId=${route.exId} />`; break;
    case 'ex-linkalt': screen = html`<${LinkAltPicker} exId=${route.exId} />`; break;
    case 'library': screen = html`<${Library} />`; break;
    case 'settings': screen = html`<${Settings} />`; break;
    default: screen = html`<${DaysList} />`;
  }

  const showBanner = !bannerDismissed && needsBackupPrompt();
  return html`
    ${showBanner && html`<${BackupBanner} onDismiss=${() => setBannerDismissed(true)} />`}
    ${screen}`;
}

render(html`<${App} />`, document.getElementById('app'));

// PWA plumbing
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW registration failed', e));
}
// Ask for durable storage once, on the first real interaction.
window.addEventListener('pointerdown', function once() {
  window.removeEventListener('pointerdown', once);
  navigator.storage?.persist?.().then((granted) => console.log('storage.persist:', granted));
}, { once: true });
