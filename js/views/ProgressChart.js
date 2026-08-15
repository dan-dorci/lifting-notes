// Progression visuals for an exercise.
//
// ProgressChart: line chart of weight over sessions, one series per set
// position (Set 1, Set 2, …). Markers are dodged a few px horizontally within
// a session so sets at the same weight read as side-by-side dots instead of
// vanishing into one; drop sets render hollow. Tap a session for details.
//
// ProgressLog: completions grouped into "eras" of consecutive sessions on the
// same prescription version, with an amber diff line where it changed.
import { html, useState, fmtDate, fmtWeight, fmtReps } from '../ui.js';
import * as state from '../state.js';

// Dark categorical slots (dataviz reference palette), validated on this app's
// card surface #1c1c21: all checks pass for 6 slots (CVD ΔE 8.4 worst pair).
const SERIES = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300'];
const MAX_SETS = 6;
const MAX_SESSIONS = 30;

const GRID = '#2c2c2a';
const AXIS_INK = '#898781';

const RANGES = [
  { key: '30', label: '30 sess' },
  { key: '3m', label: '3M', days: 91 },
  { key: '1y', label: '1Y', days: 365 },
  { key: 'all', label: 'All' },
];

function yTicks(min, max) {
  const span = max - min || 10;
  const step = [1, 2.5, 5, 10, 25, 50, 100].find((s) => span / s <= 4) || 100;
  const out = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(v);
  return out;
}

function buildSessions(ex) {
  return state.completionsFor(ex.id)
    .slice()                                  // desc → asc
    .reverse()
    .map((c) => ({ c, v: state.versionById(ex, c.versionId) }))
    .filter((s) => s.v);
}

function inRange(all, range) {
  if (range.days) {
    const cutoff = new Date(Date.now() - range.days * 86400000).toISOString();
    return all.filter((s) => s.c.completedAt >= cutoff);
  }
  if (range.key === '30') return all.slice(-MAX_SESSIONS);
  return all;
}

export function ProgressChart({ ex }) {
  const [sel, setSel] = useState(null);
  const [rangeKey, setRangeKey] = useState('30');
  const all = buildSessions(ex);
  if (all.length < 2) return null;
  const range = RANGES.find((r) => r.key === rangeKey);
  const sessions = inRange(all, range);
  const pickRange = (key) => { setRangeKey(key); setSel(null); };
  if (sessions.length < 2) {
    return html`
      <div class="chart-card">
        <${RangeRow} all=${all} rangeKey=${rangeKey} onPick=${pickRange} />
        <div class="hint" style="margin:8px 2px">Fewer than 2 sessions in this range.</div>
      </div>`;
  }

  const nSets = Math.min(MAX_SETS, Math.max(...sessions.map((s) => s.v.sets.length)));
  const weights = sessions.flatMap((s) => s.v.sets.slice(0, nSets).map((x) => x.weight));
  const rawMin = Math.min(...weights), rawMax = Math.max(...weights);
  const pad = Math.max(2.5, (rawMax - rawMin) * 0.12);
  const yMin = rawMin - pad, yMax = rawMax + pad;

  const W = 360, H = 190, mL = 36, mR = 34, mT = 10, mB = 22, xPad = 10;
  const plotW = W - mL - mR, plotH = H - mT - mB;
  const x = (i) => (sessions.length === 1
    ? mL + plotW / 2
    : mL + xPad + (i / (sessions.length - 1)) * (plotW - 2 * xPad));
  const y = (w) => mT + plotH - ((w - yMin) / (yMax - yMin)) * plotH;
  const dodge = (k) => (k - (nSets - 1) / 2) * Math.min(4, plotW / sessions.length / nSets);
  // Dense ranges: shrink markers and let the lines carry the trend.
  const dense = sessions.length > 45;
  const markR = dense ? 2.5 : 4;
  const ringW = dense ? 1 : 2;

  // Per-series point lists (a set position can be absent in some versions).
  const series = Array.from({ length: nSets }, (_, k) =>
    sessions.map((s, i) => {
      const st = s.v.sets[k];
      return st ? { i, w: st.weight, drop: st.isDropSet, set: st } : null;
    }));

  const pathFor = (pts, k) => {
    let d = '', pen = false;
    pts.forEach((p, i) => {
      if (!p) { pen = false; return; }
      d += `${pen ? 'L' : 'M'}${(x(i) + dodge(k)).toFixed(1)},${y(p.w).toFixed(1)}`;
      pen = true;
    });
    return d;
  };

  // Direct labels at the newest session — one per distinct weight, not per set.
  const last = sessions.length - 1;
  const lastLabels = [...new Set(series.map((pts) => pts[last]?.w).filter((w) => w != null))]
    .map((w) => ({ w, y: y(w) }))
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < lastLabels.length; i++) {  // nudge collisions apart
    if (lastLabels[i].y - lastLabels[i - 1].y < 11) lastLabels[i].y = lastLabels[i - 1].y + 11;
  }

  const xLabelIdx = [...new Set([0, Math.round(last / 3), Math.round((2 * last) / 3), last])];
  const spanDays = (new Date(sessions[last].c.completedAt) - new Date(sessions[0].c.completedAt)) / 86400000;
  const xLabel = (iso) => new Date(iso).toLocaleDateString(undefined,
    spanDays > 150
      ? { month: 'short', year: spanDays > 330 ? '2-digit' : undefined }
      : { month: 'numeric', day: 'numeric' });

  return html`
    <div class="chart-card">
      <${RangeRow} all=${all} rangeKey=${rangeKey} onPick=${pickRange} />
      <div class="legend-row">
        ${series.map((_, k) => html`
          <span class="chip" key=${k}>
            <span class="chip-dot" style=${`background:${SERIES[k]}`}></span>Set ${k + 1}
          </span>`)}
      </div>
      ${sel != null && html`
        <div class="chart-detail">
          <b>${fmtDate(sessions[sel].c.completedAt)}</b>
          ${sessions[sel].v.sets.map((st, k) => html`
            <span class="chart-detail-set" key=${k}>
              <span class="chip-dot" style=${`background:${SERIES[Math.min(k, MAX_SETS - 1)]}`}></span>
              ${fmtWeight(st)}×${fmtReps(st)}${st.isDropSet ? '↓' : ''}
            </span>`)}
        </div>`}
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;display:block" role="img"
        aria-label="Weight per set over the last ${sessions.length} sessions">
        ${yTicks(yMin, yMax).map((t) => html`
          <line x1=${mL} x2=${W - mR} y1=${y(t)} y2=${y(t)} stroke=${GRID} stroke-width="1" />
          <text x=${mL - 5} y=${y(t) + 3.5} text-anchor="end" font-size="10"
            fill=${AXIS_INK} style="font-variant-numeric:tabular-nums">${t}</text>`)}
        ${xLabelIdx.map((i) => html`
          <text x=${x(i)} y=${H - 6} text-anchor="middle" font-size="10" fill=${AXIS_INK}>
            ${xLabel(sessions[i].c.completedAt)}
          </text>`)}
        ${sel != null && html`
          <line x1=${x(sel)} x2=${x(sel)} y1=${mT} y2=${mT + plotH} stroke=${AXIS_INK}
            stroke-width="1" stroke-dasharray="3 3" />`}
        ${series.map((pts, k) => html`
          <path d=${pathFor(pts, k)} fill="none" stroke=${SERIES[k]} stroke-width="2"
            stroke-linejoin="round" stroke-linecap="round" key=${k} />`)}
        ${series.map((pts, k) => pts.map((p, i) => p && html`
          <circle cx=${x(i) + dodge(k)} cy=${y(p.w)} r=${markR}
            fill=${p.drop ? 'var(--surface)' : SERIES[k]}
            stroke=${p.drop ? SERIES[k] : 'var(--surface)'} stroke-width=${ringW} />`))}
        ${lastLabels.map((l) => html`
          <text x=${W - mR + 8} y=${l.y + 3.5} font-size="10" fill="var(--text)"
            style="font-variant-numeric:tabular-nums">${l.w}</text>`)}
        ${sessions.map((_, i) => html`
          <rect x=${x(i) - plotW / sessions.length / 2} y=${mT}
            width=${plotW / sessions.length} height=${plotH} fill="transparent"
            onClick=${() => setSel(sel === i ? null : i)} />`)}
      </svg>
      <div class="hint" style="margin:6px 2px 0">
        Tap a session for details.
        ${sessions.some((s) => s.v.sets.some((st) => st.isDropSet)) ? ' Hollow dots = drop sets.' : ''}
      </div>
    </div>`;
}

// Range picker row; hidden while every session already fits the default view.
function RangeRow({ all, rangeKey, onPick }) {
  if (all.length <= MAX_SESSIONS) return null;
  return html`
    <div class="seg-row">
      ${RANGES.map((r) => html`
        <button key=${r.key} class=${`seg${rangeKey === r.key ? ' on' : ''}`}
          onClick=${() => onPick(r.key)}>${r.label}</button>`)}
    </div>`;
}

// ---- era log ----

const wLabel = (s) => `${s.weight}${s.microPlate ? '$' : ''}`;

function diffVersions(oldV, newV) {
  const out = [];
  if (oldV.name !== newV.name) out.push(`renamed to “${newV.name}”`);
  const n = Math.max(oldV.sets.length, newV.sets.length);
  for (let i = 0; i < n; i++) {
    const a = oldV.sets[i], b = newV.sets[i];
    if (!a) { out.push(`S${i + 1} added (${wLabel(b)})`); continue; }
    if (!b) { out.push(`S${i + 1} removed`); continue; }
    const parts = [];
    if (a.weight !== b.weight || a.microPlate !== b.microPlate) parts.push(`${wLabel(a)}→${wLabel(b)}`);
    if (a.repMin !== b.repMin || a.repMax !== b.repMax) parts.push(`${a.repMin}–${a.repMax}→${b.repMin}–${b.repMax} reps`);
    if (a.isDropSet !== b.isDropSet) parts.push(b.isDropSet ? 'now a drop set' : 'no longer a drop set');
    if (parts.length) out.push(`S${i + 1}: ${parts.join(', ')}`);
  }
  return out;
}

export function ProgressLog({ ex }) {
  const completions = state.completionsFor(ex.id); // newest first
  if (completions.length === 0) return html`<div class="hint">No completions yet.</div>`;

  const eras = [];
  for (const c of completions) {
    const cur = eras[eras.length - 1];
    if (cur && cur.versionId === c.versionId) { cur.count++; cur.from = c.completedAt; }
    else eras.push({ versionId: c.versionId, count: 1, from: c.completedAt, to: c.completedAt });
  }

  return html`
    ${eras.map((era, i) => {
      const v = state.versionById(ex, era.versionId);
      const older = eras[i + 1] && state.versionById(ex, eras[i + 1].versionId);
      const changes = v && older ? diffVersions(older, v) : [];
      const range = fmtDate(era.from) === fmtDate(era.to)
        ? fmtDate(era.to) : `${fmtDate(era.from)} – ${fmtDate(era.to)}`;
      return html`
        <div class="era" key=${`${era.versionId}-${i}`}>
          <div class="hist-row" style="border-bottom:none">
            <div class="hist-date">${range}</div>
            <div class="hist-rx">
              ${v ? v.sets.map((s) => `${fmtWeight(s)}×${fmtReps(s)}${s.isDropSet ? '↓' : ''}`).join(' · ') : '(version missing)'}
            </div>
            <span class="badge">×${era.count}</span>
          </div>
          ${changes.length > 0 && html`
            <div class="era-diff">▲ ${changes.join(' · ')}</div>`}
        </div>`;
    })}`;
}
