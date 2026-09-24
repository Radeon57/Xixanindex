// God Killer offline support. Network first, so a new version shows up as soon as you're online;
// the cache is only a fallback for playing offline.
const CACHE = 'god-killer-v2';
self.addEventListener('install', e=>{ self.skipWaiting(); });
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
