import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Le badge « N » de Next (mode dev) recouvrait l'onglet Accueil dans les captures et les tests.
  devIndicators: false,
};

export default nextConfig;
