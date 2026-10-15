import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

// next/font télécharge la police au build et la sert depuis le site : pas d'appel à Google côté téléphone.
const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-poppins" });

export const metadata: Metadata = {
  title: "majordome.",
  description: "Assistant personnel IA",
  // manifest et icônes : générés par src/app/manifest.ts, icon.tsx et apple-icon.tsx (liens ajoutés par Next).
  appleWebApp: { capable: true, title: "majordome.", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#050506",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // permet d'utiliser les zones « safe-area » (encoche, barre de gestes)
  interactiveWidget: "resizes-content", // le clavier Android réduit la page au lieu de la recouvrir
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={poppins.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
