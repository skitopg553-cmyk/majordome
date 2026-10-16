// Service worker de majordome. : rappels push, et cible de partage (relevé CSV / Excel envoyé depuis une autre appli).
// Aucune mise en cache de pages : il ne fait que ces deux choses.

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "majordome.", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "majordome.", {
      body: data.body || "",
      tag: data.tag, // même tâche = une seule notification (pas de doublon)
      icon: "/icon/192",
      badge: "/icon/192",
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      const open = wins.find((w) => new URL(w.url).origin === self.location.origin);
      return open ? open.focus() : self.clients.openWindow(url);
    }),
  );
});

// Partage d'un relevé : Android envoie le fichier en POST /partage. Le serveur ne connaît pas le code d'accès (gardé dans le navigateur),
// donc on garde le fichier ici (Cache « partage »), puis on ouvre l'app sur /?partage=1 : c'est elle qui lance l'import avec le code.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "POST" || url.pathname !== "/partage") return;
  event.respondWith(
    (async () => {
      try {
        const file = (await event.request.formData()).get("releve");
        if (file && typeof file !== "string") {
          const cache = await caches.open("partage");
          await cache.put("/partage-fichier", new Response(file, { headers: { "x-nom": encodeURIComponent(file.name || "releve.csv"), "content-type": file.type || "application/octet-stream" } }));
        }
      } catch {
        /* fichier illisible : l'app s'ouvre quand même */
      }
      return Response.redirect("/?partage=1", 303);
    })(),
  );
});
