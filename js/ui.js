// Shared UI helpers: re-exports the vendored preact+htm bundle and provides
// small formatting/navigation utilities used across views.

export { html, render, useState, useEffect, useMemo, useRef } from '../vendor/standalone.mjs';
import { html } from '../vendor/standalone.mjs';

export function navigate(hash) { location.hash = hash; }

// Real-history back navigation. We track how deep the user has gone within
// the app so Back returns to the actual previous screen; the fallback only
// fires on a fresh launch straight into a deep screen.
let navDepth = 0;
let popping = false;
let replacing = false;

window.addEventListener('hashchange', () => {
  if (popping) { popping = false; navDepth = Math.max(0, navDepth - 1); }
  else if (replacing) { replacing = false; }
  else navDepth++;
});

export function goBack(fallback = '/') {
  if (navDepth > 0) { popping = true; window.history.back(); }
  else navigate(fallback);
}

// Navigate without creating a history entry (replaces the current screen) —
// for transient screens like pickers that Back should skip over.
export function replaceNav(hash) {
  replacing = true;
  location.replace(`#${hash}`);
}

export function parseRoute() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [a, b, c] = parts;
  if (!a) return { name: 'home' };
  if (a === 'day' && b && c === 'add') return { name: 'day-add', dayId: b };
  if (a === 'day' && b) return { name: 'day', dayId: b };
  if (a === 'ex' && b && c === 'edit') return { name: 'ex-edit', exId: b };
  if (a === 'ex' && b && c === 'linkalt') return { name: 'ex-linkalt', exId: b };
  if (a === 'ex' && b) return { name: 'ex', exId: b };
  if (a === 'library') return { name: 'library' };
  if (a === 'settings') return { name: 'settings' };
  return { name: 'home' };
}

export const fmtWeight = (s) => `${s.weight}${s.microPlate ? '$' : ''}`;
export const fmtReps = (s) => (s.repMin === s.repMax ? `${s.repMin}` : `${s.repMin}–${s.repMax}`);

// Compress consecutive identical sets: 145×8–12 ×3 · 135×8–12
export function setsSummary(version) {
  const out = [];
  for (const s of version.sets) {
    const label = `${fmtWeight(s)}×${fmtReps(s)}${s.isDropSet ? '↓' : ''}`;
    const last = out[out.length - 1];
    if (last && last.label === label) last.count++;
    else out.push({ label, count: 1 });
  }
  return out.map((o) => (o.count > 1 ? `${o.label} ×${o.count}` : o.label)).join(' · ');
}

export function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' });
}

export function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function daysAgo(date) {
  if (!date) return 'never';
  const ms = Date.now() - date.getTime();
  const days = Math.floor(ms / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

export function TopBar({ title, back, right }) {
  return html`
    <div class="topbar">
      <div class="side">
        ${back != null && html`<button onClick=${() => goBack(back)}>‹ Back</button>`}
      </div>
      <h1>${title}</h1>
      <div class="side right">${right}</div>
    </div>`;
}
