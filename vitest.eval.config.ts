import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

// Évaluation de l'IA : `npm run eval:ia`. Appelle le VRAI modèle (clés lues dans .env.local). Séparée de `npm test`, qui ne lance jamais d'appel payant.
export default defineConfig(({ mode }) => ({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { include: ["src/eval/**/*.eval.ts"], env: { TZ: "Europe/Paris", ...loadEnv(mode, process.cwd(), "") }, testTimeout: 900_000 },
}));
