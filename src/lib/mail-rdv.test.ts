import { describe, expect, it } from "vitest";
import { alreadyInAgenda, extractionPrompt, parseExtraction, selectCandidates } from "./mail-rdv";

const today = "2026-10-16";
const head = (id: string, subject: string, from = "x@exemple.fr", snippet = "") => ({ id, from, subject, snippet });

describe("selectCandidates (avant toute IA)", () => {
  const heads = [head("1", "Rendez-vous confirmé mardi 14h"), head("2", "Promo -30 % sur tout"), head("3", "Rappel RDV dentiste demain"), head("4", "Bonjour", "doctolib@x.fr"), head("5", "Facture octobre")];
  it("garde seulement les mails de RDV, pas déjà traités", () => {
    expect(selectCandidates(heads, new Set(["3"]), 20).map((h) => h.id)).toEqual(["1", "4"]);
  });
  it("respecte le quota restant du jour", () => {
    expect(selectCandidates(heads, new Set(), 1).map((h) => h.id)).toEqual(["1"]);
    expect(selectCandidates(heads, new Set(), 0)).toEqual([]);
    expect(selectCandidates(heads, new Set(), -3)).toEqual([]);
  });
});

describe("parseExtraction : la date est vérifiée et calculée en code", () => {
  const ok = '{"found":true,"title":"Dentiste Dr Martin","date":"2026-10-20","time":"14:30","place":"12 rue X"}';
  it("rendez-vous valide → heure de Paris calculée", () => {
    expect(parseExtraction(ok, today)).toEqual({ ok: true, value: { title: "Dentiste Dr Martin", start: "2026-10-20T12:30:00.000Z", place: "12 rue X" } });
  });
  it("tolère du texte autour du JSON et un lieu absent", () => {
    expect(parseExtraction('Voici : {"found":true,"title":"RDV","date":"2026-10-17","time":"9:05","place":null} merci', today)).toMatchObject({ ok: true, value: { place: null, start: "2026-10-17T07:05:00.000Z" } });
  });
  it("refuse : pas de RDV, date fausse / passée / trop lointaine, heure absente, JSON cassé", () => {
    for (const bad of [
      '{"found":false}',
      '{"found":true,"title":"x","date":"2026-02-31","time":"10:00"}',
      '{"found":true,"title":"x","date":"2026-10-10","time":"10:00"}',
      '{"found":true,"title":"x","date":"2029-01-01","time":"10:00"}',
      '{"found":true,"title":"x","date":"2026-10-20"}',
      '{"found":true,"title":"x","date":"2026-10-20","time":"25:00"}',
      '{"found":true,"title":" ","date":"2026-10-20","time":"10:00"}',
      '{"found":true,',
      "rien",
    ]) expect(parseExtraction(bad, today).ok).toBe(false);
  });
});

describe("déjà dans l'agenda ?", () => {
  const ev = (start: string, allDay = false) => ({ id: start, title: "x", start, end: start, allDay, place: null });
  it("même moment (±45 min) → rien à proposer ; plus loin ou toute la journée → on propose", () => {
    expect(alreadyInAgenda("2026-10-20T12:30:00.000Z", [ev("2026-10-20T12:00:00.000Z")])).toBe(true);
    expect(alreadyInAgenda("2026-10-20T12:30:00.000Z", [ev("2026-10-20T14:00:00.000Z")])).toBe(false);
    expect(alreadyInAgenda("2026-10-20T12:30:00.000Z", [ev("2026-10-20T12:30:00.000Z", true)])).toBe(false);
    expect(alreadyInAgenda("2026-10-20T12:30:00.000Z", [])).toBe(false);
  });
});

describe("consigne envoyée à Haiku", () => {
  it("donne la date du jour et ne contient que le mail utile", () => {
    const p = extractionPrompt({ from: "a@b.fr", subject: "RDV", body: "mardi 14h" }, today);
    expect(p.system).toContain("2026-10-16");
    expect(p.system).toContain("UNIQUEMENT");
    expect(p.user).toContain("mardi 14h");
  });
});
