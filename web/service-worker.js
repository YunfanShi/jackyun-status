// Retire the previous status page worker so returning visitors receive live files.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  await Promise.all((await caches.keys()).map(key=>caches.delete(key)));
  await self.clients.claim();
  await self.registration.unregister();
})()));
