// Cache only the public offline notice and icons. Never cache private pages, API responses, or auth routes.
const CACHE = 'secret-weapon-public-v1';
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(['/offline.html','/icon-192.png','/icon-512.png']))); self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('secret-weapon-public-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())); });
self.addEventListener('fetch', event => { const url=new URL(event.request.url); if (event.request.method!=='GET'||url.origin!==self.location.origin||event.request.mode!=='navigate'||url.pathname!=='/') return; event.respondWith(fetch(event.request).catch(()=>caches.match('/offline.html'))); });
