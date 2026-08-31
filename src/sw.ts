/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
clientsClaim();

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
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
