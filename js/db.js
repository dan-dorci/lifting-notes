// Single-document persistence: IndexedDB primary, localStorage mirror as a hedge
// against iOS Safari IDB flakiness. The whole app state is one JSON doc.

const DB_NAME = 'lifting-notes';
const STORE = 'doc';
const KEY = 'main';
const LS_KEY = 'lifting-notes-doc';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet() {
  const db = await openDB();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

async function idbPut(doc) {
  const db = await openDB();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(doc, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function load() {
  let fromIDB = null;
  try {
    fromIDB = await idbGet();
  } catch (e) {
    console.warn('IDB load failed, falling back to localStorage', e);
  }
  let fromLS = null;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) fromLS = JSON.parse(raw);
  } catch (e) {
    console.warn('localStorage load failed', e);
  }
  // Prefer whichever copy has the higher rev (they can diverge if one write failed).
  if (fromIDB && fromLS) return (fromLS.rev > fromIDB.rev) ? fromLS : fromIDB;
  return fromIDB || fromLS || null;
}

export async function save(doc) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(doc));
  } catch (e) {
    console.warn('localStorage save failed', e);
  }
  try {
    await idbPut(doc);
  } catch (e) {
    console.warn('IDB save failed', e);
  }
}
