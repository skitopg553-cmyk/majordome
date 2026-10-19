import { describe, expect, it } from "vitest";
import { eventsOn } from "./calendar";
import { applyMemory, bulkQuestion, findTargets, parseBulk, planBulk, planCreate, planDelete, planUpdate, type State } from "./calendar-plan";

const NOW = new Date("2026-10-19T08:00:00Z"); // lundi 19 octobre 2026, 10 h à Paris
const empty = (): State => ({ tasks: [], rules: [], exceptions: [] });
/** Crée une suite d'événements comme le ferait l'IA, et renvoie l'état final + les phrases du code. */
function run(state: State, inputs: Record<string, unknown>[]) {
  const done: string[] = [];
  for (const i of inputs) {
    const p = planCreate(state, i, NOW);
    if (!p.ok) throw new Error(p.error);
    state = applyMemory(state, p.ops);
    done.push(...p.done);
  }
  return { state, done };
}
const grid = (s: State, day: string) => eventsOn(day, s.tasks, s.rules, s.exceptions).map((e) => `${e.title} ${e.start}-${e.end}`);

// La vraie semaine de Ruben (description du 19/10), telle que l'IA doit l'envoyer : un appel par pavé, avec tous ses jours.
const WEEK = [
  { title: "Cours", days: ["lundi"], start: "09:00", end: "12:00" },
  { title: "Cours", days: ["lundi"], start: "14:00", end: "18:00" },
  { title: "Cours", days: ["mardi"], start: "09:00", end: "12:00" },
  { title: "Cours", days: ["mardi"], start: "12:30", end: "17:30" },
  { title: "Boxe anglaise", days: ["mardi"], start: "18:30", end: "20:00", habit: true },
  { title: "Cours", days: ["mercredi", "jeudi"], start: "09:00", end: "12:00" },
  { title: "Muscu", days: ["mercredi", "jeudi"], start: "12:00", end: "13:30", habit: true },
  { title: "Cours", days: ["mercredi", "jeudi"], start: "13:30", end: "17:00" },
  { title: "Cours", days: ["vendredi"], start: "09:00", end: "12:00" },
  { title: "Muscu", days: ["vendredi"], start: "12:00", end: "13:00", habit: true },
  { title: "Cours", days: ["vendredi"], start: "13:00", end: "16:00" },
  { title: "Travail O'Tacos", days: ["vendredi", "dimanche"], start: "18:30", end: "23:00" },
];

describe("créer : la semaine réelle", () => {
  it("chaque jour a ses pavés, avec leur durée", () => {
    const { state } = run(empty(), WEEK);
    expect(grid(state, "2026-10-26")).toEqual(["Cours 09:00-12:00", "Cours 14:00-18:00"]); // lundi suivant : visible tout de suite
    expect(grid(state, "2026-10-20")).toEqual(["Cours 09:00-12:00", "Cours 12:30-17:30", "Boxe anglaise 18:30-20:00"]);
    expect(grid(state, "2026-10-22")).toEqual(["Cours 09:00-12:00", "Muscu 12:00-13:30", "Cours 13:30-17:00"]);
    expect(grid(state, "2026-10-23")).toEqual(["Cours 09:00-12:00", "Muscu 12:00-13:00", "Cours 13:00-16:00", "Travail O'Tacos 18:30-23:00"]);
    expect(grid(state, "2026-10-24")).toEqual([]);
    expect(grid(state, "2026-10-25")).toEqual(["Travail O'Tacos 18:30-23:00"]);
  });
  it("la même description envoyée deux fois : aucun doublon", () => {
    const first = run(empty(), WEEK);
    const second = run(first.state, WEEK);
    expect(second.state.rules).toHaveLength(first.state.rules.length);
    expect(second.done.every((d) => d.startsWith("Mis à jour (déjà présent)"))).toBe(true);
  });
  it("titres différents pour la même chose (« Cours le lundi » puis « Cours lundi ») : un seul pavé", () => {
    const { state } = run(empty(), [{ title: "Cours le lundi", days: ["lundi"], start: "09:00", end: "12:00" }, { title: "Cours lundi", days: ["lundi"], start: "09:00", end: "12:00" }]);
    expect(state.rules).toHaveLength(1);
    expect(state.rules[0].title).toBe("Cours");
  });
  it("récapitulatif écrit par le code", () => {
    const { done } = run(empty(), [WEEK[0], WEEK[4], WEEK[11]]);
    expect(done).toEqual(["Cours lundi 9 h-12 h", "Boxe anglaise mardi 18 h 30-20 h (habitude à confirmer)", "Travail O'Tacos vendredi, dimanche 18 h 30-23 h"]);
  });
  it("ponctuel : le jour est calculé par le code ; doublon ponctuel = mise à jour ; déjà couvert par une règle = rien de créé", () => {
    const a = run(empty(), [{ title: "Rendez-vous dentiste", day: "jeudi", start: "15:00", end: "16:00" }]);
    expect(a.done).toEqual(["Rendez-vous dentiste jeudi 22 octobre 15 h-16 h, une seule fois"]);
    expect(grid(a.state, "2026-10-22")).toEqual(["Rendez-vous dentiste 15:00-16:00"]);
    const b = run(a.state, [{ title: "dentiste", day: "jeudi", start: "15:30", end: "16:30" }]);
    expect(b.state.tasks).toHaveLength(1);
    expect(grid(b.state, "2026-10-22")).toEqual(["Dentiste 15:30-16:30"]);
    const c = run(run(empty(), [WEEK[0]]).state, [{ title: "Cours", day: "lundi", start: "09:00", end: "12:00" }]);
    expect(c.state.tasks).toHaveLength(0);
    expect(c.done[0]).toMatch(/^Déjà prévu/);
  });
  it("fin manquante : refusé avec la question à poser ; 1 h par défaut seulement si demandé, et c'est dit", () => {
    const p = planCreate(empty(), { title: "Boxe", days: ["mardi"], start: "18:30" }, NOW);
    expect(p.ok).toBe(false);
    expect((p as { error: string }).error).toMatch(/Jusqu'à quelle heure/);
    const q = planCreate(empty(), { title: "Boxe", days: ["mardi"], start: "18:30", assume_one_hour: true }, NOW);
    expect(q.ok && q.done[0]).toBe("Boxe mardi 18 h 30-19 h 30 (1 h par défaut : dis-moi l'heure de fin pour corriger)");
  });
  it("« Fin de cours », « Pause », « Reprise » ne sont jamais créés ; fin avant début refusée", () => {
    for (const title of ["Fin de cours le lundi", "Pause", "Reprise le jeudi"]) expect(planCreate(empty(), { title, days: ["lundi"], start: "18:00", end: "18:30" }, NOW).ok).toBe(false);
    expect(planCreate(empty(), { title: "Cours", days: ["lundi"], start: "12:00", end: "09:00" }, NOW).ok).toBe(false);
  });
});

describe("retrouver par titre et jour (jamais par identifiant)", () => {
  const { state } = run(empty(), WEEK);
  it("« la boxe » : une seule règle", () => {
    const r = findTargets(state, { title: "la boxe" }, NOW);
    expect(r.ok && r.value.map((t) => t.kind)).toEqual(["rule"]);
  });
  it("« cours de mardi après-midi » : un seul pavé grâce au moment", () => {
    const r = findTargets(state, { title: "cours", day: "mardi", at: "après-midi" }, NOW);
    expect(r.ok && r.value).toHaveLength(1);
  });
  it("ambigu : la liste lisible, sans identifiant", () => {
    const p = planDelete(state, { title: "cours", day: "mardi" }, NOW);
    expect(p.ok).toBe(false);
    expect((p as { error: string }).error).toMatch(/plusieurs correspondent/);
    expect((p as { error: string }).error).not.toMatch(/#\d/);
  });
});

describe("modifier", () => {
  const { state } = run(empty(), WEEK);
  it("« décale la boxe à 19 h » : toute la série, durée gardée", () => {
    const p = planUpdate(state, { title: "boxe", new_start: "19:00" }, NOW);
    expect(p.ok && p.done).toEqual(["Modifié (toutes les semaines) : Boxe anglaise mardi 19 h-20 h 30 (habitude à confirmer)"]);
    const s = applyMemory(state, p.ok ? p.ops : []);
    expect(grid(s, "2026-10-27")).toContain("Boxe anglaise 19:00-20:30");
  });
  it("cette fois seulement : seule la date choisie bouge", () => {
    const p = planUpdate(state, { title: "boxe", day: "mardi", new_start: "20:00", new_end: "21:00", scope: "once" }, NOW);
    const s = applyMemory(state, p.ok ? p.ops : []);
    expect(grid(s, "2026-10-20")).toContain("Boxe anglaise 20:00-21:00");
    expect(grid(s, "2026-10-27")).toContain("Boxe anglaise 18:30-20:00");
  });
  it("autre titre pour une seule fois : l'occurrence est remplacée par un ponctuel", () => {
    const p = planUpdate(state, { title: "boxe", day: "mardi", new_title: "Boxe (sparring)", scope: "once" }, NOW);
    const s = applyMemory(state, p.ok ? p.ops : []);
    expect(grid(s, "2026-10-20")).toContain("Boxe (sparring) 18:30-20:00");
    expect(grid(s, "2026-10-20")).not.toContain("Boxe anglaise 18:30-20:00");
  });
});

describe("supprimer", () => {
  const { state } = run(empty(), WEEK);
  it("« supprime le cours de mardi après-midi juste cette semaine »", () => {
    const p = planDelete(state, { title: "cours", day: "mardi", at: "après-midi", scope: "once" }, NOW);
    expect(p.ok && p.done).toEqual(["Supprimé (mardi 20 octobre seulement) : Cours 12 h 30-17 h 30"]);
    const s = applyMemory(state, p.ok ? p.ops : []);
    expect(grid(s, "2026-10-20")).toEqual(["Cours 09:00-12:00", "Boxe anglaise 18:30-20:00"]);
    expect(grid(s, "2026-10-27")).toContain("Cours 12:30-17:30");
  });
  it("toute la série", () => {
    const p = planDelete(state, { title: "O'Tacos", scope: "series" }, NOW);
    const s = applyMemory(state, p.ok ? p.ops : []);
    expect(grid(s, "2026-10-25")).toEqual([]);
  });
  it("un pense-bête se supprime aussi par son titre", () => {
    const s0: State = { ...empty(), tasks: [{ id: 1, title: "Sortir les poubelles", due_at: null, status: "todo" }] };
    const p = planDelete(s0, { title: "poubelles" }, NOW);
    expect(p.ok && p.done).toEqual(["Supprimé : pense-bête « Sortir les poubelles »"]);
  });
});

describe("supprimer tout / une période : compteur exact", () => {
  const base = run(empty(), WEEK).state;
  const withTasks: State = {
    ...base,
    tasks: [
      { id: 900, title: "Dentiste", due_at: "2026-10-22T13:00:00Z", end_at: "2026-10-22T14:00:00Z", status: "todo" },
      { id: 901, title: "Poubelles", due_at: null, status: "todo" },
      { id: 902, title: "Pain", due_at: "2026-10-19T22:00:00Z", status: "todo" },
      { id: 903, title: "Déjà fait", due_at: null, status: "done" },
    ],
  };
  it("« supprime tout » : toutes les règles, les événements ponctuels et les pense-bêtes à faire", () => {
    const p = planBulk(withTasks, { scope: "all", include_reminders: true });
    expect([p.events, p.reminders]).toEqual([13, 2]);
    expect(p.done).toBe("J'ai supprimé 13 événements et 2 pense-bêtes.");
    expect(bulkQuestion(p, { scope: "all" })).toBe("Supprimer 13 événements et 2 pense-bêtes ?");
    const s = applyMemory(withTasks, p.ops);
    expect(s.rules).toHaveLength(0);
    expect(s.tasks.map((t) => t.title)).toEqual(["Déjà fait"]);
  });
  it("« vide ma semaine » : les occurrences sont retirées pour cette semaine seulement", () => {
    const b = parseBulk({ scope: "period", from: "lundi", to: "dimanche" }, NOW);
    expect(b).toEqual({ ok: true, value: { scope: "period", from: "2026-10-19", to: "2026-10-25", include_reminders: true } });
    const p = planBulk(withTasks, (b as { value: never }).value);
    const s = applyMemory(withTasks, p.ops);
    expect(grid(s, "2026-10-20")).toEqual([]);
    expect(grid(s, "2026-10-27")).toHaveLength(3); // la semaine suivante est intacte
    expect(p.events).toBe(17); // 2+3+3+3+4+0+1 occurrences + le dentiste
    expect(p.reminders).toBe(1); // le pain (daté de mardi) ; les pense-bêtes sans date restent
  });
});
