import { describe, expect, it } from "vitest";
import { briefing } from "./briefing";

const now = new Date("2026-10-16T10:00:00+02:00");
const t = (title: string, due_at: string | null, status: "todo" | "done" = "todo") => ({ title, due_at, status });
const base = { now, free: 180, overBudget: null };

describe("briefing du jour", () => {
  it("3 lignes : prochain agenda, tâches, Libre", () => {
    const tasks = [t("Dentiste", "2026-10-16T14:30:00+02:00"), t("Appel passé", "2026-10-16T08:00:00+02:00"), t("Acheter du pain", "2026-10-16T00:00:00+02:00"), t("Payer", "2026-10-14T00:00:00+02:00"), t("Trier", null)];
    expect(briefing({ ...base, tasks })).toEqual(["Prochain : Dentiste, 14:30", "1 tâche aujourd'hui, 1 en retard", "Libre ce mois : 180 €"]);
  });
  it("agenda d'un autre jour : date réelle, jamais « demain »", () => {
    expect(briefing({ ...base, tasks: [t("Point projet", "2026-10-17T10:00:00+02:00")] })[0]).toBe("Prochain : Point projet, sam. 17 oct. 10:00");
  });
  it("vide : phrases calmes ; une tâche faite ou sans heure ne compte pas comme agenda", () => {
    expect(briefing({ ...base, tasks: [t("Fait", "2026-10-16T15:00:00+02:00", "done"), t("Sans heure", "2026-10-17T00:00:00+02:00")], free: null })).toEqual(["Rien à l'agenda pour le moment.", "Aucune tâche urgente."]);
  });
  it("le soir (après 18 h), la 1re ligne annonce demain", () => {
    const evening = new Date("2026-10-16T21:30:00+02:00");
    const tasks = [t("Dentiste", "2026-10-17T14:30:00+02:00"), t("Point", "2026-10-17T09:00:00+02:00"), t("Autre jour", "2026-10-18T09:00:00+02:00")];
    expect(briefing({ ...base, now: evening, tasks })[0]).toBe("Demain : 2 rendez-vous, le premier à 09:00");
    expect(briefing({ ...base, now: evening, tasks: [] })[0]).toBe("Demain : rien à l'agenda");
    expect(briefing({ ...base, now, tasks })[0]).toMatch(/^Prochain|^Rien/); // en journée : comportement d'avant
  });
  it("un budget dépassé passe avant le Libre, sans dramatiser", () => {
    expect(briefing({ ...base, tasks: [], overBudget: { category: "Restaurants", over: 12.4 } })[2]).toBe("Budget Restaurants dépassé de 12 €");
  });
});

describe("briefing avec Google (agenda + mails)", () => {
  const ev = (title: string, start: string, allDay = false) => ({ title, start, allDay });
  it("fusionne les événements Google et les tâches à heure ; compte les autres RDV du jour", () => {
    const lines = briefing({ ...base, tasks: [t("Appel client", "2026-10-16T17:00:00+02:00")], events: [ev("Dentiste", "2026-10-16T14:30:00+02:00"), ev("Réunion", "2026-10-16T16:00:00+02:00")], mails: null });
    expect(lines[0]).toBe("Prochain : Dentiste, 14:30 · 2 autres aujourd'hui");
  });
  it("un événement « toute la journée » n'est pas un rendez-vous ; un événement passé non plus", () => {
    expect(briefing({ ...base, tasks: [], events: [ev("Férié", "2026-10-16T00:00:00+02:00", true), ev("Ce matin", "2026-10-16T08:00:00+02:00")] })[0]).toBe("Rien à l'agenda pour le moment.");
  });
  it("le soir, demain compte aussi les événements Google", () => {
    const evening = new Date("2026-10-16T21:00:00+02:00");
    expect(briefing({ ...base, now: evening, tasks: [], events: [ev("Salle", "2026-10-17T08:00:00+02:00")] })[0]).toBe("Demain : 1 rendez-vous, le premier à 08:00");
  });
  it("mails importants : le nombre puis 3 objets au plus, coupés ; rien s'il n'y en a pas", () => {
    const lines = briefing({ ...base, tasks: [], mails: { count: 5, subjects: ["Facture EDF d'octobre à régler avant le 25", "Convocation", "Re: devis", "Quatrième objet"] } });
    expect(lines[2]).toBe("5 mails importants : Facture EDF d'octobre à rég… · Convocation · Re: devis");
    expect(briefing({ ...base, tasks: [], mails: { count: 0, subjects: [] } })).toHaveLength(3);
    expect(briefing({ ...base, tasks: [], mails: { count: 1, subjects: [] } })[2]).toBe("1 mail important");
  });
  it("quatre lignes au plus : agenda, tâches, mails, argent", () => {
    expect(briefing({ ...base, tasks: [], mails: { count: 2, subjects: ["A"] } })).toHaveLength(4);
  });
});
