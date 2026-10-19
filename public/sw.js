/* Service worker de Lǐcái — volontairement minimal :
 *  - fichiers statiques (build Next, icônes, polices) : « stale-while-revalidate », l'app démarre vite et fonctionne en cours de route sans réseau ;
 *  - navigation : toujours le réseau ; hors ligne, page /offline.html ;
 *  - JAMAIS de cache pour /api/* ni pour les pages : les données financières ne sont jamais stockées par le navigateur. */
const VERSION = "licai-v1"
const STATIC = `${VERSION}-static`
const OFFLINE_URL = "/offline.html"
const PRECACHE = [OFFLINE_URL, "/manifest.json", "/icons/icon-192.svg", "/icons/icon-512.svg"]

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()))
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith("licai-") && k !== STATIC).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  )
})

const isStatic = (url) => url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || /\.(?:woff2?|ttf|svg|png|ico)$/.test(url.pathname)

self.addEventListener("fetch", (event) => {
  const req = event.request
  if (req.method !== "GET") return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return

  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)))
    return
  }
  if (isStatic(url)) {
    event.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const cached = await cache.match(req)
        const network = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res }).catch(() => cached)
        return cached ?? network
      }),
    )
  }
})
