import { describe, expect, it } from "vitest";
import { authUrl, GOOGLE_SCOPES, signState, verifyState } from "./google";

describe("state OAuth signé", () => {
  const secret = "phrase-de-test";
  const t0 = 1_800_000_000_000;
  it("accepte un state valide et récent", () => {
    expect(verifyState(signState(secret, t0), secret, t0 + 60_000)).toBe(true);
  });
  it("refuse un state expiré, falsifié, d'un autre secret ou absent", () => {
    const s = signState(secret, t0);
    expect(verifyState(s, secret, t0 + 11 * 60_000)).toBe(false);
    expect(verifyState(s.replace(/.$/, s.endsWith("A") ? "B" : "A"), secret, t0)).toBe(false);
    expect(verifyState(s, "autre-secret", t0)).toBe(false);
    expect(verifyState(`${t0 + 5}.${s.split(".")[1]}`, secret, t0 + 10)).toBe(false);
    expect(verifyState(null, secret, t0)).toBe(false);
    expect(verifyState("n'importe quoi", secret, t0)).toBe(false);
  });
});

describe("authUrl", () => {
  it("ne demande que la lecture seule", () => {
    const url = new URL(authUrl("client-123", "https://app.test/api/google/callback", "st"));
    const scopes = url.searchParams.get("scope")!.split(" ");
    expect(scopes).toEqual(GOOGLE_SCOPES);
    expect(scopes.filter((s) => s.includes("googleapis.com")).every((s) => s.endsWith(".readonly"))).toBe(true);
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("state")).toBe("st");
  });
});
