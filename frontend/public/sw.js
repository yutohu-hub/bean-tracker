// BEAN TRACKER Service Worker — オフライン対応（stale-while-revalidate）
const CACHE = "bean-tracker-v2";

self.addEventListener("install", () => { self.skipWaiting(); });

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 同一オリジンのみキャッシュ
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req);
    const network = fetch(req).then((res) => {
      if (res && res.status === 200 && res.type === "basic") cache.put(req, res.clone());
      return res;
    }).catch(() => cached);
    return cached || network;
  })());
});

/* ---- プッシュ通知 ----
   ホーム画面に追加した iOS（16.4以降）でも、ここに届く。
   本文はサーバ（Supabase Edge Function）が JSON で送る。 */
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data ? e.data.text() : "" }; }
  const title = d.title || "BEAN TRACKER";
  e.waitUntil(self.registration.showNotification(title, {
    body: d.body || "",
    icon: d.icon || "./icon-192.png",
    badge: d.badge || "./icon-192.png",
    // 同じ豆の通知が何通も溜まらないよう、目印が同じものは1つにまとめる
    tag: d.tag || "bean-tracker",
    renotify: !!d.tag,
    data: { url: d.url || "./" },
  }));
});

/* 通知を押したら、その豆のページを開く。
   既に開いているタブがあれば、そこを使う（同じアプリが二重に立ち上がらないように）。 */
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const target = new URL((e.notification.data && e.notification.data.url) || "./", self.location.href).href;
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) {
      if (c.url.startsWith(self.registration.scope)) {
        await c.focus();
        if ("navigate" in c) await c.navigate(target).catch(() => {});
        return;
      }
    }
    await self.clients.openWindow(target);
  })());
});
