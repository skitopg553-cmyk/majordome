import type { MetadataRoute } from "next";

// Android construit l'écran de démarrage avec name + background_color + l'icône 512.
export default function manifest(): MetadataRoute.Manifest {
  return {
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
