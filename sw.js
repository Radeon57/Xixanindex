// God Killer offline support. Network first, so a new version shows up as soon as you're online;
// the cache is only a fallback for playing offline.
const CACHE = 'god-killer-v2';
// the first visit loads its files before this worker runs, so store the core now: then offline works from the next start on.
// Each file is added on its own, so one missing file never blocks the rest.
const CORE = ['god-killer.html', 'god-killer/data.js', 'god-killer/engine.js', 'god-killer/fx.js', 'god-killer/icons.js', 'god-killer/ui.js',
  'manifest.webmanifest', 'icon-192.png', 'god-killer/img/bg/scene_tall.webp', 'god-killer/img/bg/scene_wide.webp', 'god-killer/img/bg/title.webp', 'god-killer/img/hero/01.webp'];
self.addEventListener('install', e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c=>Promise.all(CORE.map(u=>c.add(new Request(u, { cache:'no-cache' })).catch(()=>{})))));
});
self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k !== CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', e=>{
  const req = e.request;
  if(req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  // no-cache: always revalidate with the server, so the browser's HTTP cache can't serve an old version
  // (built from the URL: a navigation Request can't be re-fetched with options)
  e.respondWith(fetch(req.url, { cache:'no-cache', credentials:'same-origin' }).then(res=>{
    if(res.ok){ const copy = res.clone(); caches.open(CACHE).then(c=>c.put(req, copy)); }
    return res;
  }).catch(()=>caches.match(req, { ignoreSearch:true }).then(r=>r || caches.match('god-killer.html'))));
});
