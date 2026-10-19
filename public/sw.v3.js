// BlockAcademy PWA service worker.
// v3 关键变更：
//   1) 页面导航改为「网络优先」——旧版 cache-first 会把旧 index.html 连同旧 bundle
//      永久锁在手机缓存里，部署再多次用户也看不到新代码（曾导致修复“不生效”）。
//   2) 静态资源（带 hash 的 /assets/*）保持缓存优先 + 后台刷新。
//   3) 新 SW 接管页面时由 index.html 监听 controllerchange 自动刷新一次。

const CACHE = 'blockacademy-v3';
const PRECACHE = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;                       // never cache POST (LLM, etc.)
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;        // only handle same-origin
  if (url.pathname.startsWith('/api/')) return;           // never cache API routes

  // 页面导航：网络优先，失败才回落缓存（离线可玩）
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // 静态资源：缓存优先，同时后台拉新替换（stale-while-revalidate）
  event.respondWith(
    caches.match(req).then((hit) => {
      const network = fetch(req)
        .then((res) => {
          if (res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit ?? caches.match('/index.html'));
      return hit ?? network;
    })
  );
});
