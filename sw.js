const CACHE = 'xw-v4';

const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/avatar.png'
];

// 安装时预缓存核心文件
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return cache.addAll(PRECACHE);
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// 激活时清理旧缓存
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE; })
            .map(function(k) { return caches.delete(k); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// 网络优先(同步API不能缓存), 静态文件缓存优先
self.addEventListener('fetch', function(e) {
  var url = new URL(e.request.url);

  // API 请求：网络优先（同步数据必须实时）
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(fetch(e.request).catch(function() {
      return new Response(JSON.stringify({ok: false, error: 'offline'}), {
        headers: {'Content-Type': 'application/json'}
      });
    }));
    return;
  }

  // 静态文件：缓存优先，网络回退
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      var fetched = fetch(e.request).then(function(response) {
        if (response && response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE).then(function(cache) {
            cache.put(e.request, clone);
          });
        }
        return response;
      });
      return cached || fetched;
    })
  );
});
