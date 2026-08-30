// UI walkthrough in jsdom: boots the real app (blank seed, fetch stubbed to
// disk — no server needed), imports the fixture, and exercises every screen.
// Run: node tests/test-render.mjs
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { makeFixtureDoc } from './fixture.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'http://localhost/';
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="app"></div></body></html>', { url: BASE });

global.window = dom.window;
global.document = dom.window.document;
global.location = dom.window.location;
global.localStorage = dom.window.localStorage;
global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
global.cancelAnimationFrame = clearTimeout;
global.confirm = () => true;
// Serve ./data/seed.json (and anything else) straight from disk.
global.fetch = async (u) => new Response(readFileSync(join(root, String(u).replace(BASE, ''))));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const assert = (cond, msg) => { if (cond) pass++; else { fail++; console.error('FAIL:', msg); } };
const text = () => document.getElementById('app').textContent;
const nav = (h) => { location.hash = h; }; // jsdom fires hashchange natively

await import('../js/app.js');
await sleep(300);

// Blank seed boots; personal data arrives via import (replaceDoc = import path).
assert(text().includes('Pull'), 'home shows Pull day');
assert(text().includes('0 exercises'), 'blank seed: day cards show 0 exercises');

const state = await import('../js/state.js');
state.replaceDoc(makeFixtureDoc());
await sleep(100);
assert(text().includes('2 exercises'), 'after import: pull shows 2 exercises');

// Day view
nav('#/day/pull');
await sleep(120);
assert(text().includes('Seated row'), 'pull day lists seated row');
assert(text().includes('1 ALT'), 'ALT badge rendered');

// Exercise view
const ex = state.getExercise('ex_row');
nav(`#/ex/${ex.id}`);
await sleep(120);
assert(text().includes('Completed'), 'exercise view has Completed button');
assert(text().includes('Plate row'), 'alternatives listed');
assert(text().includes('No completions yet'), 'empty history hint');

// Log a completion via the button
[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Completed').click();
await sleep(100);
assert(text().includes('tap to undo'), 'completion logged via UI');
assert(state.completionsFor(ex.id).length === 1, 'completion in state');

// ✅ toggle via UI (set 1 is seeded ✅ on — clicking flips it off, then back)
const onBefore = document.querySelectorAll('.check.on').length;
assert(onBefore === 1, 'seeded ✅ renders');
document.querySelector('.check').click();
await sleep(80);
assert(document.querySelectorAll('.check.on').length === 0, '✅ toggle flips off');
document.querySelector('.check').click();
await sleep(80);
assert(document.querySelectorAll('.check.on').length === 1, '✅ toggle flips back on');

// Progression: edit set 2 (+5) → new version; 2 more sessions → chart + eras
const cur = state.currentVersion(ex);
state.updatePrescription(ex.id, cur.name,
  cur.sets.map((s, i) => (i === 1 ? { ...s, weight: s.weight + 5, id: null } : { ...s })));
state.logCompletion(ex.id);
state.logCompletion(ex.id);
nav('#/'); await sleep(80);
nav(`#/ex/${ex.id}`); await sleep(120);
assert(document.querySelector('svg path') != null, 'progress chart renders series paths');
assert(document.querySelectorAll('.chip').length === 3, 'legend chip per set position');
assert(document.querySelectorAll('.era').length === 2, 'era log groups versions');
assert(text().includes('▲'), 'era diff line rendered');
assert(text().includes('→'), 'diff shows weight transition');
const hitRects = [...document.querySelectorAll('svg rect')];
hitRects[hitRects.length - 1].dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
await sleep(80);
assert(document.querySelector('.chart-detail') != null, 'tapping a session shows detail card');

// Range picker: 40 weekly sessions on hamstring curls
for (let i = 0; i < 40; i++) state.logCompletion('ex_ham');
const hc = state.getDoc().completions.filter((c) => c.exerciseId === 'ex_ham');
hc.forEach((c, i) => { c.completedAt = new Date(Date.now() - (40 - i) * 7 * 86400000).toISOString(); });
nav('#/'); await sleep(80);
nav('#/ex/ex_ham'); await sleep(120);
assert(document.querySelectorAll('.seg').length === 4, 'range picker appears for >30 sessions');
assert(document.querySelectorAll('svg rect').length === 30, 'default range caps at 30 sessions');
[...document.querySelectorAll('.seg')].find((b) => b.textContent === 'All').click();
await sleep(100);
assert(document.querySelectorAll('svg rect').length === 40, 'All range shows every session');
[...document.querySelectorAll('.seg')].find((b) => b.textContent === '3M').click();
await sleep(100);
const rects3m = document.querySelectorAll('svg rect').length;
assert(rects3m > 2 && rects3m < 20, `3M range filters by date (${rects3m} sessions)`);

// Edit view
nav(`#/ex/${ex.id}/edit`);
await sleep(120);
assert(document.querySelector('input') != null, 'edit view has inputs');
assert(text().includes('Add set'), 'edit view has Add set');

// Library + Settings
nav('#/library'); await sleep(120);
assert(text().includes('ALT'), 'library shows alt badges');
nav('#/settings'); await sleep(120);
assert(text().includes('Export now'), 'settings has export');
assert(text().includes('Completions logged'), 'settings shows data stats');

// Back button follows real history: day → exercise → ALT → back → back
nav('#/day/pull'); await sleep(120);
nav(`#/ex/${ex.id}`); await sleep(120);
nav('#/ex/ex_plate'); await sleep(120);
const clickBack = () => [...document.querySelectorAll('.topbar button')]
  .find((b) => b.textContent.includes('Back')).click();
clickBack(); await sleep(200);
assert(location.hash === `#/ex/${ex.id}`, `back from ALT returns to previous exercise (${location.hash})`);
clickBack(); await sleep(200);
assert(location.hash === '#/day/pull', `back again returns to day (${location.hash})`);

// Persistence: everything reloads from the localStorage mirror
const db = await import('../js/db.js');
await sleep(400); // let the debounced save flush
const reloaded = await db.load();
assert(reloaded.completions.length === state.getDoc().completions.length,
  `every completion persisted to mirror (${reloaded?.completions.length}/${state.getDoc().completions.length})`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
