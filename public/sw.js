/* Raffila web-push service worker — receives payloads from the /api/notify-tick worker. */
self.addEventListener("push", (event) => {
  let payload = { title: "Raffila", body: "", url: "/" };
  try {
    if (event.data) payload = Object.assign(payload, event.data.json());
  } catch (err) {
    // keep defaults
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || "Raffila", {
      body: payload.body || "",
      icon: "/Raffila-logo.png",
      badge: "/Raffila-logo.png",
      tag: payload.tag || "rafilla",
      data: { url: payload.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ("focus" in client) {
          client.focus();
          if ("navigate" in client) {
            try {
              client.navigate(target);
            } catch (err) {
              // navigate unsupported — focus only
            }
          }
          return undefined;
        }
      }
      return clients.openWindow(target);
    }),
  );
});

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
