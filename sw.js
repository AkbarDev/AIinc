const CACHE_NAME = 'snapfacts-v21';
const ASSETS = [
    './',
    './index.html',
    './js/app.js',
    './js/frontier-ladder.js',
    './js/hf-board.js',
    './js/agent-evals.js',
    './js/agentic-bots.js',
    './css/style.css',
    './css/frontier-ladder.css',
    './css/hf-board.css',
    './css/agent-evals.css',
    './css/agentic-bots.css',
    './data/frontier_models.json',
    './data/hf_config.json',
    './data/hf_models_cache.json',
    './data/agent_evals_config.json',
    './data/agent_evals_cache.json',
    './data/agentic_bots_config.json',
    './data/agentic_bots_cache.json',
    './assets/images/snapfacts-wordmark.svg',
    './assets/images/favicon.svg',
    'https://cdn.plot.ly/plotly-2.32.0.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            );
        })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                fetch(event.request).then((networkResponse) => {
                    if (networkResponse.status === 200) {
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, networkResponse);
                        });
                    }
                }).catch(() => {});
                return cachedResponse;
            }
            return fetch(event.request);
        })
    );
});
