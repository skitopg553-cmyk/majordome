import type { NextConfig } from "next";

// En-têtes de sécurité envoyés avec TOUTES les pages et routes :
// - nosniff : le navigateur ne « devine » jamais un type de fichier ;
// - X-Frame-Options DENY : l'app ne peut pas être affichée dans le cadre d'un autre site (piège au clic sur l'écran Finances) ;
// - Referrer-Policy : l'adresse complète n'est pas transmise aux sites externes ;
// - Permissions-Policy : le micro reste autorisé pour la voix (self), caméra et position sont coupées.
export const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self)" },
];

const nextConfig: NextConfig = {
  // Le badge « N » de Next (mode dev) recouvrait l'onglet Accueil dans les captures et les tests.
  devIndicators: false,
  headers: async () => [{ source: "/:path*", headers: SECURITY_HEADERS }],
};

export default nextConfig;
