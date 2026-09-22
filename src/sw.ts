/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
clientsClaim();

// SPA offline: navegações caem no index.html precacheado (exceto catálogo estático e APIs).
const navigationHandler = createHandlerBoundToURL('/index.html');
registerRoute(
  new NavigationRoute(navigationHandler, {
    denylist: [/^\/catalogo\//, /^\/api\//, /\/[^/?]+\.[^/]+$/],
  }),
);

// Catálogo: rede primeiro — CacheFirst prendia o celular em app.js antigo sem códigos.
registerRoute(
  ({ url }) => url.origin === self.location.origin && url.pathname.startsWith('/catalogo/'),
  new NetworkFirst({
    cacheName: 'fe-catalogo-assets-v3',
    networkTimeoutSeconds: 5,
  }),
);

// API do catálogo: tenta rede; se offline, usa cache da última resposta.
registerRoute(
  ({ url }) =>
    url.pathname.startsWith('/api/catalog') ||
    url.pathname.includes('/functions/v1/catalogo-catalog'),
  new NetworkFirst({
    cacheName: 'fe-catalogo-api-v2',
    networkTimeoutSeconds: 8,
  }),
);

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter(
            (key) =>
              key === 'fe-catalogo-assets' ||
              key === 'fe-catalogo-assets-v2' ||
              key === 'fe-catalogo-api',
          )
          .map((key) => caches.delete(key)),
      ),
    ),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});

/** Acorda clients para flush do outbox IndexedDB. */
self.addEventListener('sync', (event) => {
  const syncEvent = event as ExtendableEvent & { tag?: string };
  if (syncEvent.tag !== 'fe-outbox-sync') return;
  syncEvent.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        client.postMessage({ type: 'FE_OUTBOX_SYNC' });
      }
    }),
  );
});

type PushPayload = {
  title: string;
  body: string;
  href?: string;
};

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload: PushPayload = {
    title: 'Fé Merchandising',
    body: 'Nova atualização disponível',
  };

  try {
    payload = { ...payload, ...event.data.json() };
  } catch {
    payload.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/pwa-192.png',
      badge: '/pwa-192.png',
      data: { href: payload.href ?? '/' },
      tag: payload.href ?? 'fe-notification',
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const href = (event.notification.data?.href as string | undefined) ?? '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        const url = new URL(client.url);
        if (url.origin === self.location.origin) {
          void client.focus();
          void client.navigate(href);
          return;
        }
      }
      return self.clients.openWindow(href);
    }),
  );
});
