// Only same-origin public app assets are cached. Never cache auth, database,
// Edge Function requests or messages. Bump this version for each deployment.
const CACHE = 'dreamsoul-shell-v1'
const SHELL = ['/', '/icons/icon.svg', '/icons/icon-192.png', '/icons/icon-512.png', '/manifest.webmanifest']
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL))) })
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('dreamsoul-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())) })
self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin || request.headers.has('Authorization')) return
  if (url.pathname.startsWith('/auth') || url.pathname.startsWith('/functions') || url.pathname.startsWith('/rest')) return
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => { if (response.ok) { const clone = response.clone(); void caches.open(CACHE).then(cache => cache.put('/', clone)) } return response }).catch(() => caches.match('/').then(response => response || new Response('DreamSoul is offline. Reconnect to continue your story.', { status: 503, headers: { 'Content-Type': 'text/plain' } }))))
    return
  }
  if (/^\/(assets|images|icons)\//.test(url.pathname)) {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => { if (response.ok) { const clone = response.clone(); void caches.open(CACHE).then(cache => cache.put(request, clone)) } return response })))
  }
})
