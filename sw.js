/* Continual Improvement Academy — service worker.
   The installed app opens from the device: every page and tool already opened is served from the cache at once
   and refreshed from the network in the background, so the next launch shows the latest copy.
   Offline, everything opened before keeps working. User data never passes through here (it stays in localStorage). */
const VERSION = "1.0.0-2026-10-22-bb636c66";
const CACHE = "cia-" + VERSION;
const FONTS = "cia-fonts";
const PREV = "cia-prev";   /* pages kept from the previous release: used only when the network is unavailable */
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/icon-512-maskable.png",
  "./assets/apple-touch-icon.png",
  "./assets/favicon-32.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: "reload" })))));
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    /* a new release moves the pages already opened to PREV (offline fallback only), so online users get the new copies */
    const old = keys.filter(k => k.startsWith("cia-") && ![CACHE, FONTS, PREV].includes(k));
    const prev = await caches.open(PREV);
    for (const k of old) {
      const c = await caches.open(k);
      for (const req of await c.keys()) { const res = await c.match(req); if (res) await prev.put(req, res); }
      await caches.delete(k);
    }
    if (self.registration.navigationPreload) { try { await self.registration.navigationPreload.enable(); } catch (e) {} }
    await self.clients.claim();
  })());
});

self.addEventListener("message", event => {
  if (event.data === "skipWaiting") self.skipWaiting();
});

/* shown inside the tool frame when a tool that was never opened on this device is asked for without a connection */
const OFFLINE_HTML = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>CIA — دون اتصال</title><style>
:root{--ink:#1B2A4A;--muted:#5E6880;--gold:#B8901E;--bg:#F4F6FA;--card:#fff}
@media (prefers-color-scheme:dark){:root{--ink:#E9EDF6;--muted:#9AA4B8;--gold:#D6B04A;--bg:#0C1322;--card:#131C30}}
body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--ink);font-family:"IBM Plex Sans Arabic","Segoe UI",Tahoma,sans-serif;padding:24px;box-sizing:border-box}
main{max-width:460px;background:var(--card);border-radius:20px;padding:28px;border-top:5px solid var(--gold);box-shadow:0 20px 50px rgba(10,18,34,.12);display:grid;gap:12px}
h1{margin:0;font-size:20px}p{margin:0;line-height:1.8;color:var(--muted)}p[lang=en]{direction:ltr;text-align:left;font-size:14px}
button{justify-self:start;border:0;border-radius:999px;background:var(--ink);color:var(--card);font:inherit;font-weight:700;padding:10px 20px;cursor:pointer}
</style></head><body><main>
<h1>هذه الأداة تحتاج إلى الإنترنت أول مرة</h1>
<p>لم تُفتح هذه الأداة على هذا الجهاز من قبل. اتصل بالإنترنت وافتحها مرة واحدة، وبعدها تعمل دون إنترنت. بياناتك محفوظة كما هي.</p>
<p lang="en">This tool has not been opened on this device yet. Connect once to open it; after that it works offline. Your data is kept as it is.</p>
<button type="button" onclick="location.reload()">حاول مرة أخرى · Try again</button>
</main></body></html>`;
const offlinePage = () => new Response(OFFLINE_HTML, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });

const sameOrigin = url => url.origin === self.location.origin;
const isFont = url => url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";

/* the page is the same whatever the query (?lang=, ?source=pwa): one cache entry per path */
function keyFor(request) {
  const url = new URL(request.url);
  url.search = ""; url.hash = "";
  if (url.pathname.endsWith("/")) url.pathname += "index.html";
  return url.href;
}

async function staleWhileRevalidate(event) {
  const { request } = event;
  const cache = await caches.open(CACHE);
  const key = keyFor(request);
  const cached = await cache.match(key);
  const network = (async () => {
    const pre = event.preloadResponse ? await event.preloadResponse : null;
    const res = pre || await fetch(request);
    if (res && res.ok && res.type === "basic") await cache.put(key, res.clone());
    return res;
  })();
  if (cached) { event.waitUntil(network.catch(() => {})); return cached; }
  try {
    const res = await network;
    event.waitUntil(caches.open(PREV).then(p => p.delete(key)));
    return res;
  } catch (e) {
    const old = await (await caches.open(PREV)).match(key);
    if (old) return old;
    if (request.mode === "navigate") {
      /* the app itself falls back to the cached home page; a tool frame gets the short offline note instead */
      if (request.destination !== "iframe") { const home = await cache.match(keyFor(new Request(self.registration.scope))); if (home) return home; }
      return offlinePage();
    }
    throw e;
  }
}

async function fontCacheFirst(request) {
  const cache = await caches.open(FONTS);
  const cached = await cache.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res && (res.ok || res.type === "opaque")) await cache.put(request, res.clone());
  return res;
}

self.addEventListener("fetch", event => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (sameOrigin(url)) { event.respondWith(staleWhileRevalidate(event)); return; }
  if (isFont(url)) event.respondWith(fontCacheFirst(request));
});
