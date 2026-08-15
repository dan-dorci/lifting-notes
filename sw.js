// Precache-all, cache-first service worker. Bump CACHE on every deploy —
// that's the entire update mechanism (new SW installs, old cache is dropped,
// change is live on the next launch).
const CACHE = 'lifting-notes-v2';

const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './vendor/standalone.mjs',
  './data/seed.json',
  './js/app.js',
  './js/ui.js',
  './js/state.js',
  './js/db.js',
  './js/dnd.js',
  './js/backup.js',
  './js/views/DaysList.js',
  './js/views/DayView.js',
  './js/views/ExerciseView.js',
  './js/views/ExerciseEdit.js',
  './js/views/Library.js',
  './js/views/Settings.js',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true })
      .then((hit) => hit || fetch(e.request))
  );
});
