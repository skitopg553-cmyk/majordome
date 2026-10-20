import { describe, expect, it, vi } from "vitest";
import { audioSeconds, decideSpeak, DEFAULT_MAX_CHARS_PER_DAY, elevenCostUsd, isElModel, maxCharsPerDay, speakWithFallback, ttsCostUsd, unit01 } from "./voice-budget";

describe("plafond du jour (VOICE_MAX_CHARS_PER_DAY)", () => {
  it("valeur par défaut raisonnable, valeur valide acceptée, valeur absurde ignorée", () => {
    expect(DEFAULT_MAX_CHARS_PER_DAY).toBe(8000);
    expect(maxCharsPerDay(undefined)).toBe(8000);
    expect(maxCharsPerDay("")).toBe(8000);
    expect(maxCharsPerDay("abc")).toBe(8000);
    expect(maxCharsPerDay("-5")).toBe(8000);
    expect(maxCharsPerDay("20000")).toBe(20000);
    expect(maxCharsPerDay("0")).toBe(0); // 0 = voix cloud coupée
  });
});

describe("coût estimé", () => {
  it("proportionnel au texte ; une phrase courte coûte une fraction de centime", () => {
    expect(audioSeconds(150)).toBe(10);
    expect(ttsCostUsd(0)).toBe(0);
    expect(ttsCostUsd(150)).toBeCloseTo(0.0025, 3); // ~10 s d'audio
    expect(ttsCostUsd(8000)).toBeCloseTo(0.1348, 3); // le plafond du jour par défaut
    expect(ttsCostUsd(300)).toBeCloseTo(2 * ttsCostUsd(150), 8);
  });
});

describe("ElevenLabs : modèles, coût, réglages", () => {
  it("Flash coûte moitié moins que Multilingual v2 et v3 (crédits par caractère)", () => {
    expect(elevenCostUsd(1000, "flash", 0.2)).toBeCloseTo(0.1, 8);
    expect(elevenCostUsd(1000, "v2", 0.2)).toBeCloseTo(0.2, 8);
    expect(elevenCostUsd(1000, "v3", 0.2)).toBeCloseTo(0.2, 8);
    expect(elevenCostUsd(0, "v3", 0.2)).toBe(0);
  });
  it("modèle inconnu refusé, réglages bornés entre 0 et 1", () => {
    expect(isElModel("flash")).toBe(true);
    expect(isElModel("toString")).toBe(false);
    expect(isElModel(undefined)).toBe(false);
    expect(unit01(0.3, 0.5)).toBe(0.3);
    expect(unit01(7, 0.5)).toBe(1);
    expect(unit01(-2, 0.5)).toBe(0);
    expect(unit01("x", 0.5)).toBe(0.5);
    expect(unit01(NaN, 0.5)).toBe(0.5);
  });
});

describe("decideSpeak : cloud ou téléphone", () => {
  const base = { enabled: true, usedToday: 0, chars: 100, maxPerDay: 8000 };
  it("cloud tant que le plafond n'est pas atteint", () => {
    expect(decideSpeak(base)).toEqual({ mode: "cloud", reason: "ok" });
    expect(decideSpeak({ ...base, usedToday: 7900 })).toEqual({ mode: "cloud", reason: "ok" }); // 7 900 + 100 = pile le plafond
  });
  it("téléphone : plafond dépassé par cette phrase, réglage coupé, texte vide, plafond à 0", () => {
    expect(decideSpeak({ ...base, usedToday: 7901 })).toEqual({ mode: "phone", reason: "cap" });
    expect(decideSpeak({ ...base, enabled: false })).toEqual({ mode: "phone", reason: "disabled" });
    expect(decideSpeak({ ...base, chars: 0 })).toEqual({ mode: "phone", reason: "empty" });
    expect(decideSpeak({ ...base, maxPerDay: 0 })).toEqual({ mode: "phone", reason: "cap" });
  });
});

describe("speakWithFallback : la voix ne devient jamais un point de panne", () => {
  it("cloud qui marche → le téléphone ne parle pas", async () => {
    const phone = vi.fn();
    expect(await speakWithFallback(async () => {}, phone)).toBe("cloud");
    expect(phone).not.toHaveBeenCalled();
  });
  it("réseau ou service en erreur → le téléphone lit, sans exception", async () => {
    const phone = vi.fn();
    expect(await speakWithFallback(async () => { throw new Error("réseau"); }, phone)).toBe("phone");
    expect(phone).toHaveBeenCalledTimes(1);
  });
  it("service trop lent → repli après le délai", async () => {
    vi.useFakeTimers();
    const phone = vi.fn();
    const p = speakWithFallback(() => new Promise(() => {}), phone, 5000);
    await vi.advanceTimersByTimeAsync(5001);
    expect(await p).toBe("phone");
    expect(phone).toHaveBeenCalled();
    vi.useRealTimers();
  });
  it("même si la voix du téléphone échoue : silence, pas d'exception", async () => {
    await expect(speakWithFallback(async () => { throw new Error("x"); }, () => { throw new Error("pas de synthèse"); })).resolves.toBe("phone");
  });
});
