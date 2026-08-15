// Export/import + the 24h backup prompt. iOS forbids silent file writes from
// web apps, so export always rides a user tap: share sheet on iOS, <a download>
// elsewhere. Backup bookkeeping lives in localStorage, outside the document,
// so the backup file itself is pure data.

import { getDoc, replaceDoc } from './state.js';

const FILENAME = 'lifting-backup.json';
const PROMPT_AFTER_MS = 24 * 60 * 60 * 1000;

export function backupStatus() {
  const at = localStorage.getItem('lastBackupAt');
  const rev = Number(localStorage.getItem('lastBackupRev') ?? -1);
  return { lastBackupAt: at ? new Date(at) : null, lastBackupRev: rev };
}

export function isDirty() {
  return getDoc().rev !== backupStatus().lastBackupRev;
}

export function needsBackupPrompt() {
  const { lastBackupAt } = backupStatus();
  if (!isDirty()) return false;
  if (!lastBackupAt) return true;
  return Date.now() - lastBackupAt.getTime() > PROMPT_AFTER_MS;
}

function markBackedUp() {
  localStorage.setItem('lastBackupAt', new Date().toISOString());
  localStorage.setItem('lastBackupRev', String(getDoc().rev));
}

// Must be called from a user gesture (tap) — iOS user-activation requirement.
export async function exportNow() {
  const json = JSON.stringify(getDoc());
  let file = new File([json], FILENAME, { type: 'application/json' });
  if (navigator.canShare && !navigator.canShare({ files: [file] })) {
    // Some engines reject application/json for sharing; same bytes, same name.
    file = new File([json], FILENAME, { type: 'text/plain' });
  }
  if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
    try {
      await navigator.share({ files: [file] });
      markBackedUp();
      return 'shared';
    } catch (e) {
      if (e.name === 'AbortError') return 'cancelled';
      // fall through to download
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  a.download = FILENAME;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  markBackedUp();
  return 'downloaded';
}

export async function importFile(file) {
  const text = await file.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Not a valid JSON file.');
  }
  if (parsed?.schemaVersion !== 1 ||
      !Array.isArray(parsed.days) ||
      !Array.isArray(parsed.exercises) ||
      !Array.isArray(parsed.completions)) {
    throw new Error('Not a Lifting Notes backup file.');
  }
  replaceDoc(parsed);
  markBackedUp();
}
