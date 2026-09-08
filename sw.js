/* BLOOM — офлайн. При КАЖДОМ изменении файлов поднимай VERSION,
   иначе телефон будет держать старую версию из кэша. */
const VERSION = "bloom-v3.0.0";

/* Оболочка: без неё приложение не откроется вообще.
   Шрифты и арт персонажа берутся по требованию и оседают в том же кэше:
   перечислять сорок картинок тут значит ломать установку из-за одной опечатки. */
const SHELL = [
  "./",
  "./index.html",
  "./app.js",
  "./data.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-180.png",
  "./assets/fonts/inter-400-cyrillic.woff2",
  "./assets/fonts/inter-600-cyrillic.woff2",
  "./assets/fonts/inter-700-cyrillic.woff2",
  "./assets/fonts/inter-400-latin.woff2",
  "./assets/fonts/inter-600-latin.woff2",
  "./assets/fonts/inter-700-latin.woff2",
  "./assets/fonts/unbounded-800-cyrillic.woff2",
  "./assets/fonts/unbounded-800-latin.woff2",
];

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    /* addAll падает целиком, если хоть один файл не отдался. Кладём по одному,
       чтобы установка пережила отсутствующую иконку. */
    await Promise.all(SHELL.map(u => c.add(u).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  /* Картинки и шрифты не меняются в пределах версии: сначала кэш, это мгновенно.
     Всё остальное сначала из сети, чтобы правка кода доезжала без переустановки. */
  const isAsset = /\.(png|jpg|webp|woff2)$/.test(url.pathname);

  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    if (isAsset) {
      const hit = await cache.match(req);
      if (hit) return hit;
      try { const r = await fetch(req); if (r.ok) cache.put(req, r.clone()); return r; }
      catch { return new Response("", { status: 504 }); }
    }
    try {
      const r = await fetch(req);
      if (r.ok) cache.put(req, r.clone());
      return r;
    } catch {
      const hit = await cache.match(req) || await cache.match("./index.html");
      return hit || new Response("Офлайн", { status: 503, headers:{ "Content-Type":"text/plain; charset=utf-8" }});
    }
  })());
});
