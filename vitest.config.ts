import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Tests unitaires de la logique pure (dates, calculs, parsing) : `npm test`.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { include: ["src/**/*.test.ts"], env: { TZ: "Europe/Paris" } },
});
