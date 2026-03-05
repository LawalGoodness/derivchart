// ═══════════════════════════════════════════════════════════════
//  DERIV CHART — SERVICE WORKER
//  Handles: background push notifications, offline cache
// ═══════════════════════════════════════════════════════════════

const CACHE_NAME = "derivchart-v1";
const CACHE_FILES = [
  "./",
  "./index.html",
  "./manifest.json",
  "https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js",
];

// ── Install: cache core assets ────────────────────────────────
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CACHE_FILES))
  );
  self.skipWaiting();
});

// ── Activate: clean old caches ────────────────────────────────
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: serve from cache, fallback to network ──────────────
self.addEventListener("fetch", e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

// ── Push notifications (background alerts) ───────────────────
self.addEventListener("push", e => {
  let data = { title: "Deriv Alert", body: "Zone triggered", zone: "green", tag: "zone" };
  try { data = e.data.json(); } catch(_) {}

  const icons = { green: "🟢", orange: "🟠", red: "🔴" };
  const colors = { green: "#00e676", orange: "#ff9500", red: "#ff3d5a" };

  const options = {
    body:    data.body,
    icon:    "./icon-192.png",
    badge:   "./icon-96.png",
    tag:     data.tag || "zone-alert",
    renotify: true,
    requireInteraction: data.zone === "red",   // red stays until dismissed
    vibrate: data.zone === "red"
      ? [300, 100, 300, 100, 300, 100, 300, 100, 300, 100, 300]  // 3s buzz pattern
      : data.zone === "orange"
      ? [200, 100, 200, 100, 200, 100, 200, 100, 200]             // 2s buzz pattern
      : [150, 100, 150],                                           // short ding
    data:    data,
    actions: [
      { action: "open",    title: "Open Chart" },
      { action: "dismiss", title: "Dismiss" },
    ],
  };

  e.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// ── Notification click ────────────────────────────────────────
self.addEventListener("notificationclick", e => {
  e.notification.close();
  if (e.action === "dismiss") return;
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes("index.html") || client.url.endsWith("/")) {
          return client.focus();
        }
      }
      return clients.openWindow("./index.html");
    })
  );
});

// ── Message from main app → trigger notification ──────────────
// (used when app is backgrounded/screen off but SW is alive)
self.addEventListener("message", e => {
  if (e.data && e.data.type === "ZONE_ALERT") {
    const d = e.data;
    const vibPat = d.zone === "red"
      ? [300,100,300,100,300,100,300,100,300,100,300]
      : d.zone === "orange"
      ? [200,100,200,100,200,100,200,100,200]
      : [150,100,150];

    self.registration.showNotification(d.title, {
      body:    d.body,
      icon:    "./icon-192.png",
      badge:   "./icon-96.png",
      tag:     "zone-" + d.zone,
      renotify: true,
      requireInteraction: d.zone === "red",
      vibrate: vibPat,
      data:    d,
    });
  }
});
