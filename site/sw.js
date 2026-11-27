// Minimal service worker: lets Ruko be installed. It caches nothing, so checks always use the latest brain.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
