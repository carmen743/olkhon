// 오프라인에서도 앱이 열리도록 기본 파일을 저장해 두는 서비스 워커
const CACHE='olkhon-v1';
const FILES=['/','/index.html','/app.js','/store.js','/manifest.webmanifest','/icons/logo.webp','/icons/icon-192.png','/icons/icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
// 네트워크 우선, 안 되면 저장본 사용 → 업데이트가 바로 반영돼요
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET'||new URL(e.request.url).origin!==location.origin)return;
  e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(CACHE).then(x=>x.put(e.request,c));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('/'))));
});
