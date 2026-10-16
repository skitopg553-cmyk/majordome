import type { MetadataRoute } from "next";

// Android construit l'écran de démarrage avec name + background_color + l'icône 512.
export default function manifest(): MetadataRoute.Manifest {
  // Raccourcis et cible de partage, regroupés ici.
  const extra = {
    // Appui long sur l'icône : 3 raccourcis (voir src/lib/shortcuts.ts).
    shortcuts: [
      { name: "Parler", url: "/?action=parler", icons: [{ src: "/icon/192", sizes: "192x192", type: "image/png" }] },
      { name: "Ajouter une tâche", url: "/?action=tache", icons: [{ src: "/icon/192", sizes: "192x192", type: "image/png" }] },
      { name: "Ajouter une dépense", url: "/?action=depense", icons: [{ src: "/icon/192", sizes: "192x192", type: "image/png" }] },
    ],
    // Partager un relevé CSV / Excel depuis une autre appli (Revolut…) vers majordome. : le service worker (public/sw.js) garde le fichier puis ouvre l'import.
    share_target: {
      action: "/partage",
      method: "POST" as const,
      enctype: "multipart/form-data" as const,
      params: { files: [{ name: "releve", accept: [".csv", ".xlsx", "text/csv", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"] }] },
    },
  };
  return {
    ...extra,
    name: "majordome.",
    short_name: "majordome.",
    description: "Assistant personnel IA",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#050506",
    theme_color: "#050506",
    lang: "fr",
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon/192", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
