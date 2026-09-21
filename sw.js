/* Do It! — service worker
   Only job: keep the app shell available offline.
   Task data lives in IndexedDB and is never touched here.

   Update strategy
   ---------------
   Navigations are network-first: when you are online you always get the
   newest index.html, and the fresh copy replaces the cached one. Offline,
   the last good copy is served. That means updating index.html on the
   server is enough — nothing here needs editing for an update to land.
   Bump CACHE_VERSION only if you want to force-clear the old cache.
*/
var CACHE_VERSION = 'v2';
var CACHE = 'doit-shell-' + CACHE_VERSION;
var SHELL = ['./', './index.html', './icon.png'];

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(CACHE)
      .then(function(c){ return c.addAll(SHELL); })
      ['catch'](function(){ /* a missing file must not block install */ })
      .then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){
        if(k !== CACHE) return caches.delete(k);
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e){
  var req = e.request;
  if(req.method !== 'GET') return;

  var url;
  try{ url = new URL(req.url); }catch(err){ return; }
  if(url.origin !== self.location.origin) return;   /* never touch other origins */

  /* Navigations: network first, cache as the offline fallback */
  if(req.mode === 'navigate'){
    e.respondWith(
      fetch(req).then(function(res){
        var copy = res.clone();
        caches.open(CACHE).then(function(c){ c.put('./index.html', copy); });
        return res;
      })['catch'](function(){
        return caches.match('./index.html').then(function(hit){
          return hit || caches.match('./');
        });
      })
    );
    return;
  }

  /* Everything else: cache first, then network */
  e.respondWith(
    caches.match(req).then(function(hit){
      if(hit) return hit;
      return fetch(req).then(function(res){
        if(res && res.status === 200 && res.type === 'basic'){
          var copy = res.clone();
          caches.open(CACHE).then(function(c){ c.put(req, copy); });
        }
        return res;
      })['catch'](function(){ return hit; });
    })
  );
});
