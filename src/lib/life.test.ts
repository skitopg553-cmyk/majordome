import { describe, expect, it } from "vitest";
import { canonicalCategory, parseBudget, parseExpense, parseSleep, parseSteps, parseWorkout, resolveDate } from "./life";

const now = new Date("2026-10-16T20:00:00+02:00");

describe("resolveDate", () => {
  it("absent = aujourd'hui à Paris (même passé minuit UTC)", () => {
    expect(resolveDate(undefined, now)).toEqual({ ok: true, value: "2026-10-16" });
    expect(resolveDate(undefined, new Date("2026-10-17T00:30:00+02:00"))).toEqual({ ok: true, value: "2026-10-17" });
  });
  it("accepte hier, refuse le futur, l'ancien et le mal formé", () => {
    expect(resolveDate("2026-10-15", now).ok).toBe(true);
    expect(resolveDate("2026-10-17", now)).toMatchObject({ ok: false });
    expect(resolveDate("2025-01-01", now)).toMatchObject({ ok: false });
    expect(resolveDate("hier", now)).toMatchObject({ ok: false });
    expect(resolveDate("2026-02-31", now)).toMatchObject({ ok: false });
  });
});

describe("parseWorkout", () => {
  it("nettoie le type et garde la durée", () => {
    expect(parseWorkout({ kind: "  Muscu   jambes ", minutes: 60 }, now)).toEqual({ ok: true, value: { date: "2026-10-16", kind: "Muscu jambes", minutes: 60 } });
    expect(parseWorkout({ kind: "Salle" }, now)).toMatchObject({ ok: true, value: { minutes: null } });
  });
  it("refuse un type vide ou une durée absurde", () => {
    expect(parseWorkout({ kind: "  " }, now)).toMatchObject({ ok: false });
    expect(parseWorkout({ kind: "Salle", minutes: 0 }, now)).toMatchObject({ ok: false });
    expect(parseWorkout({ kind: "Salle", minutes: 9999 }, now)).toMatchObject({ ok: false });
    expect(parseWorkout({ kind: "Salle", minutes: "une heure" }, now)).toMatchObject({ ok: false });
  });
});

describe("parseSleep", () => {
  it("accepte 7,5 h et arrondit au centième", () => {
    expect(parseSleep({ hours: 7.5 }, now)).toEqual({ ok: true, value: { date: "2026-10-16", hours: 7.5 } });
    expect(parseSleep({ hours: 6.666666 }, now)).toMatchObject({ value: { hours: 6.67 } });
  });
  it("refuse 0 h, 20 h, texte", () => {
    for (const h of [0, 20, "7h30", NaN]) expect(parseSleep({ hours: h }, now)).toMatchObject({ ok: false });
  });
});

describe("parseSteps", () => {
  it("ajoute par défaut, remplace si on le demande", () => {
    expect(parseSteps({ steps: 2000 }, now)).toMatchObject({ ok: true, value: { steps: 2000, mode: "add" } });
    expect(parseSteps({ steps: 8000, mode: "set" }, now)).toMatchObject({ value: { mode: "set" } });
    expect(parseSteps({ steps: 8000, mode: "n'importe quoi" }, now)).toMatchObject({ value: { mode: "add" } });
  });
  it("refuse 0, négatif, énorme", () => {
    for (const s of [0, -5, 500000, "beaucoup"]) expect(parseSteps({ steps: s }, now)).toMatchObject({ ok: false });
  });
});

describe("canonicalCategory / parseBudget", () => {
  it("retrouve la catégorie exacte malgré accents et casse", () => {
    expect(canonicalCategory("sport & sante")).toBe("Sport & santé");
    expect(canonicalCategory("RESTAURANTS")).toBe("Restaurants");
    expect(canonicalCategory("Licornes")).toBeNull();
  });
  it("budget : catégorie connue, montant > 0, pas de budget sur Revenu / Épargne", () => {
    expect(parseBudget({ category: "restaurants", monthly_limit: 150 })).toEqual({ ok: true, value: { category: "Restaurants", monthly_limit: 150 } });
    expect(parseBudget({ category: "Revenu", monthly_limit: 100 })).toMatchObject({ ok: false });
    expect(parseBudget({ category: "Courses", monthly_limit: 0 })).toMatchObject({ ok: false });
    expect(parseBudget({ category: "Inconnue", monthly_limit: 50 })).toMatchObject({ ok: false });
  });
});

describe("parseExpense", () => {
  it("catégorise par les règles quand la catégorie manque", () => {
    expect(parseExpense({ label: "Carrefour City", amount: -23.4 }, now)).toEqual({ ok: true, value: { date: "2026-10-16", label: "Carrefour City", amount: -23.4, category: "Courses" } });
    expect(parseExpense({ label: "Truc bizarre", amount: -5 }, now)).toMatchObject({ value: { category: "Autre" } });
  });
  it("respecte la catégorie donnée, et refuse montant nul ou catégorie inconnue", () => {
    expect(parseExpense({ label: "Cadeau", amount: -30, category: "loisirs" }, now)).toMatchObject({ value: { category: "Loisirs" } });
    expect(parseExpense({ label: "x", amount: 0 }, now)).toMatchObject({ ok: false });
    expect(parseExpense({ label: "x", amount: -5, category: "Licornes" }, now)).toMatchObject({ ok: false });
    expect(parseExpense({ label: " ", amount: -5 }, now)).toMatchObject({ ok: false });
  });
});
