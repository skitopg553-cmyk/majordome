// Outils de l'IA pour le calendrier : créer, modifier, supprimer (une fois, la série, une période, tout), lister.
// L'IA désigne un événement par son TITRE et son JOUR, jamais par un identifiant. Les phrases de confirmation viennent du CODE (champ « recap »).
import { dayText, eventsOn, rangeText, remindersFor } from "./calendar";
import { bulkQuestion, parseBulk, planBulk, planCreate, planDelete, planUpdate, type Op, type State } from "./calendar-plan";
import { resolveDay } from "./calendar";
import { addDays, parisDay } from "./task-groups";
import type { ToolDef } from "./tools";
import type { Undo } from "./undo";

/** Où lire et écrire : la vraie base (calendar-store.ts) ou une base en mémoire (évaluation). */
export type Backend = { load: () => Promise<State | null>; apply: (ops: Op[], label: string) => Promise<{ ok: boolean; error?: string; undo: Undo | null }> };

const DAY = { type: "string", description: "Jour tel que dit : « aujourd'hui », « demain », « jeudi », « 22 octobre ». Le CODE calcule la date ; n'écris jamais de date toi-même." };
const DAYS = { type: "array", items: { type: "string" }, description: "Jours où ça REVIENT chaque semaine : [\"lundi\",\"mercredi\"], [\"lundi-vendredi\"], [\"tous les jours\"]. Absent = une seule fois." };
const HOUR = (what: string) => ({ type: "string", description: `${what}, HH:MM (ex. 09:00, 18:30)` });
const FIND = {
  title: { type: "string", description: "Titre tel que Ruben le dit (« la boxe », « le cours »)" },
  day: { type: "string", description: "Jour de l'occurrence visée (« mardi », « demain ») : pour une seule fois, ou pour lever un doute" },
  at: { type: "string", description: "Pour lever un doute : heure de début (« 14:00 ») ou « matin », « après-midi », « soir »" },
};

export const CALENDAR_TOOLS: ToolDef[] = [
  {
    name: "add_event",
    description:
      "Créer un ÉVÉNEMENT avec horaire (cours, travail, rendez-vous, sport). Toujours un début ET une fin. Récurrent : days (UN appel par pavé, avec tous ses jours) ; ponctuel : day. « Cours 9h-12h puis 14h-18h » = DEUX appels « Cours ». « Fin de cours à 18h » = la fin (end) du pavé précédent, pas un événement. Une pause n'est pas un événement. Titre court, sans jour ni moment (« Cours », pas « Cours le lundi après-midi »). habit = true pour une habitude à confirmer (salle, sport, méditation). Si la fin n'est pas dite : demande « Jusqu'à quelle heure ? » ; s'il ne sait pas, assume_one_hour: true. Si ça existe déjà, le code met à jour au lieu de doubler.",
    parameters: { type: "object", properties: { title: { type: "string" }, day: DAY, days: DAYS, start: HOUR("Début"), end: HOUR("Fin"), assume_one_hour: { type: "boolean" }, habit: { type: "boolean" } }, required: ["title", "start"] },
  },
  {
    name: "update_event",
    description: "Modifier un événement retrouvé par son titre (et son jour s'il le faut). scope « series » = toutes les semaines (défaut sans day), « once » = seulement ce jour-là (défaut avec day). Changer seulement l'heure de début garde la durée.",
    parameters: { type: "object", properties: { ...FIND, scope: { type: "string", enum: ["once", "series"] }, new_title: { type: "string" }, new_day: DAY, new_start: HOUR("Nouveau début"), new_end: HOUR("Nouvelle fin"), new_days: DAYS, habit: { type: "boolean" } }, required: ["title"] },
  },
  {
    name: "delete_event",
    description: "Supprimer UN événement (ou un pense-bête) retrouvé par son titre. scope « once » (seulement ce jour-là, avec day) ou « series » (toutes les semaines). Seulement si Ruben le demande.",
    parameters: { type: "object", properties: { ...FIND, scope: { type: "string", enum: ["once", "series"] } }, required: ["title"] },
  },
  {
    name: "delete_many",
    description:
      "Suppression EN MASSE : « supprime tout » (scope all), « vide ma semaine » / « annule tout demain » (scope period, from et to en mots : « lundi », « dimanche », « demain »). Ne supprime RIEN tout de suite : l'app affiche une carte avec le nombre exact et Ruben confirme. Après l'appel, réponds seulement « OK ».",
    parameters: { type: "object", properties: { scope: { type: "string", enum: ["all", "period"] }, from: DAY, to: DAY, include_reminders: { type: "boolean", description: "Inclure les pense-bêtes (défaut : oui)" } }, required: ["scope"] },
  },
  {
    name: "list_events",
    description: "Lire l'agenda (événements et pense-bêtes) d'une période, pour répondre à « qu'est-ce que j'ai mardi ? » ou vérifier avant de modifier. Par défaut : les 7 prochains jours.",
    parameters: { type: "object", properties: { from: DAY, to: DAY } },
  },
];

const out = (o: unknown) => JSON.stringify(o);

/** Agenda lisible, sans identifiant (pour l'IA et le contexte). */
export function agendaText(state: State, from: string, to: string, today: string) {
  const lines: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const ev = eventsOn(d, state.tasks, state.rules, state.exceptions).map((e) => `${e.title} ${rangeText(e.start, e.end)}${e.recurring ? " (chaque semaine)" : ""}`);
    const rem = remindersFor(d, state.tasks, today).map((t) => `pense-bête : ${t.title}`);
    if (ev.length || rem.length) lines.push(`${dayText(d)} : ${[...ev, ...rem].join(" ; ")}`);
  }
  return lines.join("\n") || "(rien)";
}

/** Exécute un outil du calendrier. Null si ce n'est pas l'un d'eux. */
export async function executeCalendarTool(name: string, args: Record<string, unknown>, backend: Backend, now = new Date()): Promise<string | null> {
  if (!CALENDAR_TOOLS.some((t) => t.name === name)) return null;
  const state = await backend.load();
  if (!state) return out({ ok: false, error: "Le calendrier n'est pas lisible pour le moment (base indisponible). Dis-le simplement à Ruben." });
  const today = parisDay(now);

  if (name === "list_events") {
    const f = resolveDay(args.from ?? "aujourd'hui", now);
    const t = resolveDay(args.to ?? undefined, now);
    const from = f.ok ? f.value : today;
    const to = args.to && t.ok ? t.value : addDays(from, 6);
    return out({ ok: true, agenda: agendaText(state, from, to > addDays(from, 31) ? addDays(from, 31) : to, today) });
  }

  if (name === "delete_many") {
    const b = parseBulk(args, now);
    if (!b.ok) return out(b);
    const p = planBulk(state, b.value);
    if (!p.ops.length) return out({ ok: true, recap: "Il n'y a rien à supprimer." });
    const question = bulkQuestion(p, b.value);
    return out({ ok: true, notice: question, card: { kind: "confirm", title: "Supprimer", detail: question, url: "", bulk: b.value } });
  }

  const plan = name === "add_event" ? planCreate(state, args, now) : name === "update_event" ? planUpdate(state, args, now) : planDelete(state, args, now);
  if (!plan.ok) return out(plan);
  if (!plan.ops.length) return out({ ok: true, recap: plan.done });
  const label = name === "add_event" ? "Ajout au calendrier" : name === "update_event" ? "Modification" : "Suppression";
  const w = await backend.apply(plan.ops, label);
  if (!w.ok) return out({ ok: false, error: `Échec de l'écriture : ${w.error}. Dis à Ruben exactement ce qui n'a pas marché.`, ...(w.undo ? { undo: w.undo } : {}) });
  return out({ ok: true, recap: plan.done, ...(w.undo ? { undo: w.undo } : {}) });
}
