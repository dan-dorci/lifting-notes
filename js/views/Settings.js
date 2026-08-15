import { html, useState, useRef, TopBar, daysAgo } from '../ui.js';
import * as state from '../state.js';
import { exportNow, importFile, backupStatus, isDirty } from './../backup.js';

export function Settings() {
  const [msg, setMsg] = useState('');
  const fileRef = useRef(null);
  const { lastBackupAt } = backupStatus();
  const doc = state.getDoc();

  const doExport = async () => {
    try {
      const r = await exportNow();
      setMsg(r === 'cancelled' ? 'Export cancelled.' : 'Backed up ✓');
    } catch (e) {
      setMsg(`Export failed: ${e.message}`);
    }
  };

  const doImport = async (file) => {
    if (!file) return;
    if (!confirm('Importing replaces ALL current data with the backup file. Continue?')) return;
    try {
      await importFile(file);
      setMsg('Import complete ✓');
    } catch (e) {
      setMsg(`Import failed: ${e.message}`);
    }
  };

  return html`
    <${TopBar} title="Settings" back="/" />
    <div class="screen">
      <div class="section">Backup</div>
      <div class="kv"><span class="k">Last backup</span><span>${daysAgo(lastBackupAt)}</span></div>
      <div class="kv"><span class="k">Unsaved changes</span><span>${isDirty() ? 'yes' : 'no'}</span></div>
      <div style="margin-top:12px">
        <button class="btn-solid" onClick=${doExport}>Export now</button>
      </div>
      <div class="hint" style="margin-top:8px">
        Saves everything to a single <b>lifting-backup.json</b> via the share sheet →
        “Save to Files”. Keep it in iCloud Drive so it survives losing the phone.
      </div>

      <div class="section">Restore</div>
      <input type="file" accept=".json,application/json,text/plain" style="display:none"
        ref=${fileRef} onChange=${(e) => { doImport(e.target.files[0]); e.target.value = ''; }} />
      <button class="btn-quiet" onClick=${() => fileRef.current.click()}>Import backup file…</button>
      <div class="hint" style="margin-top:8px">Replaces all data with the chosen backup.</div>

      ${msg && html`<div class="banner">${msg}</div>`}

      <div class="section">Data</div>
      <div class="kv"><span class="k">Exercises</span><span>${doc.exercises.length}</span></div>
      <div class="kv"><span class="k">Completions logged</span><span>${doc.completions.length}</span></div>
      <div class="kv"><span class="k">Revision</span><span>${doc.rev}</span></div>
    </div>`;
}
