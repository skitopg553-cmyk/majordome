import { describe, expect, it } from "vitest";
import nextConfig, { SECURITY_HEADERS } from "../../next.config";

describe("en-têtes de sécurité (next.config.ts)", () => {
  const value = (key: string) => SECURITY_HEADERS.find((h) => h.key === key)?.value;

  it("interdit l'affichage dans le cadre d'un autre site et le « devinage » de type de fichier", () => {
    expect(value("X-Frame-Options")).toBe("DENY");
    expect(value("X-Content-Type-Options")).toBe("nosniff");
    expect(value("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });
  it("garde le micro pour la voix, coupe la caméra et la position", () => {
    const p = value("Permissions-Policy")!;
    expect(p).toContain("microphone=(self)");
    expect(p).toContain("camera=()");
    expect(p).toContain("geolocation=()");
  });
  it("s'applique à toutes les routes (pages et /api)", async () => {
    const rules = await nextConfig.headers!();
    expect(rules).toHaveLength(1);
    expect(rules[0].source).toBe("/:path*");
    expect(rules[0].headers).toEqual(SECURITY_HEADERS);
  });
});
