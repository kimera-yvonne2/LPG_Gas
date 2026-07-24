/* eslint-disable no-undef */
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Lumora", body: event.data?.text() || "New notification" };
  }
  event.waitUntil(self.registration.showNotification(payload.title || "Lumora", {
    body: payload.body || "You have a new notification.",
    data: { url: payload.url || "/alerts", notificationId: payload.notification_id },
    tag: payload.tag || `lpg-${payload.notification_id || Date.now()}`,
    renotify: payload.severity === "critical",
    requireInteraction: payload.severity === "critical",
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/alerts", self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if ("focus" in client) {
        await client.navigate(target);
        return client.focus();
      }
    }
    return self.clients.openWindow(target);
  })());
});
