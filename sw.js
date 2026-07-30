const CACHE = 'xw-1785395715917';
const IGNORE_CACHE = ['xw-v10', 'xw-v9', 'xw-v8', 'xw-v7', 'xw-v6', 'xw-v5', 'xw-v4', 'xw-v3', 'xw-v2', 'xw-v1'];

const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './avatar.png'
];

// Install: pre-cache core files, then activate immediately
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return cache.addAll(PRECACHE);
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// Activate: clean old caches, notify all clients to refresh
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE && IGNORE_CACHE.indexOf(k) === -1; })
            .map(function(k) { console.log('SW: deleting old cache', k); return caches.delete(k); })
      );
    }).then(function() {
      return self.clients.claim();
    }).then(function() {
      // Notify all open clients that a new version is ready
      return self.clients.matchAll().then(function(clients) {
        clients.forEach(function(client) {
          client.postMessage({ type: 'NEW_VERSION', version: CACHE });
        });
      });
    })
  );
});

// Fetch strategy
self.addEventListener('fetch', function(e) {
  var url = new URL(e.request.url);

  // API: network-only
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(fetch(e.request).catch(function() {
      return new Response(JSON.stringify({ok: false, error: 'offline'}), {
        headers: {'Content-Type': 'application/json'}
      });
    }));
    return;
  }

  // HTML navigation: network-first (always try to get latest version)
  if (e.request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html')) {
    e.respondWith(
      fetch(e.request, { cache: 'no-cache' }).then(function(response) {
        if (response && response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE).then(function(cache) {
            cache.put(e.request, clone);
          });
        }
        return response;
      }).catch(function() {
        return caches.match(e.request);
      })
    );
    return;
  }

  // Static assets (images, CSS-in-HTML, manifest): cache-first, network fallback + background update
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      var fetched = fetch(e.request, { cache: 'no-cache' }).then(function(response) {
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
