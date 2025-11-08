// Minimal service worker for PWA requirements
const CACHE_NAME = 'riddleswap-v2';

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

// Remove fetch handler to eliminate "no-op fetch handler" warning