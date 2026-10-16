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
