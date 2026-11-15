/* Eleven×11 Service Worker
   策略：页面走网络优先（保证打开就是最新版），静态资源走缓存优先
   更新代码后如果想让缓存彻底刷新，把下面的版本号 +1 即可
*/
const CACHE = 'eleven11-v4';
const CORE = [
  './',
  './index.html',
  './manifest.json',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png'
];

/* 安装：逐个缓存，任何一个失败都不影响其它 */
self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return Promise.all(
        CORE.map(function (u) {
          return c.add(u).catch(function () { });
        })
      );
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

/* 激活：清掉旧版本缓存，立刻接管 */
self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.map(function (k) {
          return k === CACHE ? null : caches.delete(k);
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

/* 请求拦截 */
self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;

  /* ① 页面导航：网络优先，3 秒拿不到就用缓存 */
  if (req.mode === 'navigate') {
    e.respondWith(
      (function () {
        const cacheFallback = caches.match('./index.html');
        const net = fetch(req, { cache: 'no-cache' }).then(function (r) {
          if (r && r.ok) {
            const cp = r.clone();
            caches.open(CACHE).then(function (c) {
              c.put('./index.html', cp).catch(function () { });
            });
          }
          return r;
        });
        const timeout = new Promise(function (_, reject) {
          setTimeout(reject, 3000);
        });
        return Promise.race([net, timeout]).catch(function () {
          return cacheFallback.then(function (c) {
            return c || net;
          });
        });
      })()
    );
    return;
  }

  /* ② 其它静态资源：缓存优先，后台静默更新 */
  e.respondWith(
    caches.match(req).then(function (cached) {
      const net = fetch(req).then(function (r) {
        const cp = r.clone();
        caches.open(CACHE).then(function (c) {
          c.put(req, cp).catch(function () { });
        });
        return r;
      }).catch(function () {
        return null;
      });
      return cached || net;
    })
  );
});

/* 允许页面主动要求「跳过等待」立即生效 */
self.addEventListener('message', function (e) {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
