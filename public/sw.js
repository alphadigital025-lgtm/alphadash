const CACHE = 'alphadash-v1'
const STATIC = [
  '/',
  '/index.html',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap'
]

// Install — cache static assets
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return cache.addAll(STATIC)
    })
  )
  self.skipWaiting()
})

// Activate — clean old caches
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE })
            .map(function(k) { return caches.delete(k) })
      )
    })
  )
  self.clients.claim()
})

// Fetch — network first for API, cache first for static
self.addEventListener('fetch', function(e) {
  var url = e.request.url

  // Always network for Netlify functions (API calls)
  if (url.includes('/.netlify/functions/')) {
    e.respondWith(fetch(e.request))
    return
  }

  // Network first, fallback to cache for everything else
  e.respondWith(
    fetch(e.request)
      .then(function(res) {
        var clone = res.clone()
        caches.open(CACHE).then(function(cache) {
          cache.put(e.request, clone)
        })
        return res
      })
      .catch(function() {
        return caches.match(e.request).then(function(cached) {
          return cached || caches.match('/index.html')
        })
      })
  )
})
