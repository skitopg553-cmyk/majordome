// Outils « tout à la voix » : épargne, nutrition, temps d'écran, corrections et suppressions.
// Mêmes règles que life-tools.ts : validation en code, chaque écriture renvoie « undo » (bouton Annuler).
import { alarmCard, resolveAlarm, resolveTimer, timerCard } from "./alarm";
import { matchGoal, type Goal } from "./finance/savings";
import { dayTotals, parseFood, parseNutritionGoals } from "./nutrition/food";
import { out, noTable, restorable, undoFor, upsertWithUndo, type Row } from "./life-tools";
import { parseExpense, parseWorkout } from "./life";
import { clampText, MAX_MEMORY, MAX_TITLE } from "./limits";
import { parseAtTime, parseRecurrence, ruleLabel } from "./recurrence";
import { listRules } from "./recurring-store";
import { isMissingTable, supabaseAdmin } from "./supabase";
import { parisDay } from "./task-groups";
import { fold } from "./text";
import type { ToolDef } from "./tools";
import type { Undo } from "./undo";

const DATE = { type: "string", description: "Jour concerné, AAAA-MM-JJ (heure de Paris). Absent = aujourd'hui. Jamais dans le futur." };
const ID = { type: "integer", description: "Identifiant (#n) visible dans le contexte" };

export const MORE_TOOLS: ToolDef[] = [
  {
    name: "add_to_goal",
    description:
      "Ajouter (ou retirer, montant négatif) de l'argent à un objectif d'épargne existant : « j'ai mis 200 € sur la voiture ». Le nom peut être approximatif ; si plusieurs objectifs correspondent, l'outil le dit : pose alors UNE question à Ruben. Ne sert pas à créer un objectif (→ set_goal).",
    parameters: { type: "object", properties: { goal: { type: "string", description: "Nom (approximatif) de l'objectif" }, amount: { type: "number", description: "Euros ajoutés (négatif = retrait)" } }, required: ["goal", "amount"] },
  },
  {
    name: "log_food",
    description:
      "Noter ce que Ruben a MANGÉ ou bu (« j'ai mangé 50 g de riz », « 2 œufs »). Donne seulement l'aliment, la quantité et l'unité : le CODE calcule kcal et macros. Si l'outil répond que l'aliment est inconnu, rappelle-le avec estimate_per_100g (ton estimation pour 100 g) : ce sera marqué « estimé ». N'invente jamais les calories toi-même dans ta réponse : annonce celles que l'outil renvoie.",
    parameters: {
      type: "object",
      properties: {
        food: { type: "string", description: "Aliment, ex. « riz », « œuf », « yaourt nature »" },
        quantity: { type: "number" },
        unit: { type: "string", enum: ["g", "kg", "ml", "cl", "l", "piece", "cuillere_soupe", "cuillere_cafe"], description: "Absent = grammes. « piece » pour 2 œufs, 1 pomme, 1 tranche, 1 canette." },
        estimate_per_100g: { type: "object", properties: { kcal: { type: "number" }, protein: { type: "number" }, carbs: { type: "number" }, fat: { type: "number" } }, description: "Seulement si l'aliment est inconnu de la table" },
        date: DATE,
      },
      required: ["food", "quantity"],
    },
  },
  {
    name: "set_nutrition_goals",
    description: "Régler l'objectif du jour : calories (kcal) et macros en grammes (protéines, glucides, lipides). Seuls les champs donnés changent.",
    parameters: { type: "object", properties: { kcal: { type: "integer" }, protein: { type: "integer", description: "grammes" }, carbs: { type: "integer", description: "grammes" }, fat: { type: "integer", description: "grammes" } } },
  },
  {
    name: "update_transaction",
    description: "Corriger une opération déjà notée (libellé, montant, catégorie, date). Seuls les champs donnés changent.",
    parameters: { type: "object", properties: { id: ID, label: { type: "string" }, amount: { type: "number" }, category: { type: "string" }, date: DATE }, required: ["id"] },
  },
  {
    name: "update_workout",
    description: "Corriger une séance de sport déjà notée (sport, durée, date). Seuls les champs donnés changent.",
    parameters: { type: "object", properties: { id: ID, kind: { type: "string" }, minutes: { type: "integer" }, date: DATE }, required: ["id"] },
  },
  {
    name: "update_memory",
    description: "Corriger le texte d'un souvenir existant (au lieu de forget + remember).",
    parameters: { type: "object", properties: { id: ID, content: { type: "string" } }, required: ["id", "content"] },
  },
  {
    name: "set_setting",
    description: "Changer un réglage de l'appareil de Ruben. Seul réglage : read_aloud (lire les réponses à voix haute quand il parle). « Arrête de me répondre à voix haute » → value false.",
    parameters: { type: "object", properties: { name: { type: "string", enum: ["read_aloud"] }, value: { type: "boolean" } }, required: ["name", "value"] },
  },
  {
    name: "set_alarm",
    description:
      "Préparer un RÉVEIL Android (« réveille-moi demain à 7 h », « mets un réveil dans 20 minutes »). Tu ne crées rien toi-même : l'app affiche une carte avec un bouton que Ruben touche pour ouvrir l'Horloge déjà remplie. Donne soit hour (+ minutes), avec day « tomorrow » s'il a dit demain, soit in_minutes pour « dans N minutes ». N'écris pas l'heure calculée dans ta réponse : la carte l'affiche.",
    parameters: { type: "object", properties: { hour: { type: "integer", description: "0-23" }, minutes: { type: "integer", description: "0-59" }, day: { type: "string", enum: ["today", "tomorrow"] }, in_minutes: { type: "integer", description: "Réveil dans N minutes" }, label: { type: "string", description: "Libellé, ex. « Salle »" } } },
  },
  {
    name: "set_timer",
    description: "Préparer un MINUTEUR Android (« minuteur 20 minutes pour les pâtes »). Même principe que le réveil : une carte avec un bouton. Donne la durée en hours, minutes et/ou seconds.",
    parameters: { type: "object", properties: { hours: { type: "integer" }, minutes: { type: "integer" }, seconds: { type: "integer" }, label: { type: "string" } } },
  },
  {
    name: "add_recurring_task",
    description:
      "Créer une tâche qui REVIENT : « tous les lundis », « chaque jour », « tous les mois le 5 ». Transmets la phrase de récurrence telle que dite dans every (le code la comprend). Avec une heure précise (time, HH:MM) c'est un rendez-vous d'agenda ; sans heure, une simple tâche. La tâche apparaît le jour même, au premier chargement de l'app.",
    parameters: { type: "object", properties: { title: { type: "string" }, every: { type: "string", description: "ex. « tous les lundis »" }, time: { type: "string", description: "HH:MM, facultatif" } }, required: ["title", "every"] },
  },
  {
    name: "delete_entry",
    description:
      "SUPPRIMER une donnée, UNIQUEMENT si Ruben le demande clairement (« supprime la dépense Netflix », « efface ma nuit d'hier »). Jamais de ta propre initiative. Un bouton Annuler s'affiche juste après. kind : task, goal, budget, transaction, workout, sleep, steps, food, recurring (une tâche récurrente). Par id (#n du contexte) pour task, goal, transaction, workout, food ; par date pour sleep, steps ; par nom pour goal (label) et budget (category).",
    parameters: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["task", "goal", "budget", "transaction", "workout", "sleep", "steps", "food", "recurring"] },
        id: ID,
        date: { type: "string", description: "AAAA-MM-JJ, pour sleep, steps" },
        label: { type: "string", description: "Nom de l'objectif (kind goal), si pas d'id" },
        category: { type: "string", description: "Catégorie du budget (kind budget)" },
      },
      required: ["kind"],
    },
  },
];

const DELETE_TABLES: Record<string, { table: string; label: string }> = {
  task: { table: "tasks", label: "Tâche" }, goal: { table: "savings_goals", label: "Objectif" }, budget: { table: "budgets", label: "Budget" },
  transaction: { table: "transactions", label: "Opération" }, workout: { table: "workouts", label: "Séance" }, sleep: { table: "sleep_logs", label: "Nuit" },
  recurring: { table: "recurring_tasks", label: "Récurrence" }, steps: { table: "steps_logs", label: "Pas" }, food: { table: "food_logs", label: "Repas" },
};

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Exécute un outil de ce fichier. Renvoie null si ce n'est pas l'un d'eux. */
export async function executeMoreTool(name: string, args: Record<string, unknown>): Promise<string | null> {
  const now = new Date();
  const db = supabaseAdmin();
  const finish = (error: { code?: string; message: string } | null, what: string, result: Record<string, unknown>, undo?: Undo) =>
    isMissingTable(error) ? noTable(what) : error ? out({ ok: false, error: error.message }) : out({ ok: true, ...result, ...(undo ? { undo } : {}) });

  switch (name) {
    case "add_to_goal": {
      const amount = typeof args.amount === "number" ? r2(args.amount) : NaN;
      if (!Number.isFinite(amount) || amount === 0 || Math.abs(amount) > 10_000_000) return out({ ok: false, error: "amount invalide : montant en euros, différent de 0" });
      const all = await db.from("savings_goals").select("id,label,target,saved,due_label");
      if (all.error) return finish(all.error, "Objectif", {});
      const goals: Goal[] = (all.data ?? []).map((g) => ({ id: g.id as number, label: g.label, target: Number(g.target), saved: Number(g.saved), due_label: g.due_label }));
      const m = matchGoal(goals, String(args.goal ?? ""));
      if (m.kind === "none") return out({ ok: false, error: `aucun objectif ne correspond à « ${String(args.goal)} ». Objectifs : ${goals.map((g) => g.label).join(", ") || "aucun"}. Propose d'en créer un (set_goal) ou demande lequel.` });
      if (m.kind === "ambiguous") return out({ ok: false, error: `plusieurs objectifs possibles : ${m.candidates.map((g) => `« ${g.label} »`).join(", ")}. Demande à Ruben lequel (UNE question), n'en choisis pas un au hasard.` });
      const saved = r2(m.goal.saved + amount);
      if (saved < 0) return out({ ok: false, error: `retrait trop grand : « ${m.goal.label} » ne contient que ${m.goal.saved} €` });
      const r = await db.from("savings_goals").update({ saved }).eq("id", m.goal.id);
      return finish(r.error, "Objectif", { saved: { goal: m.goal.label, ajoute: amount, epargne_total: saved, cible: m.goal.target, reste: Math.max(0, r2(m.goal.target - saved)) } }, undoFor(`${amount > 0 ? "+" : ""}${amount} € sur « ${m.goal.label} »`, "savings_goals", m.goal.id, { saved: m.goal.saved }));
    }
    case "log_food": {
      const p = parseFood(args, now);
      if (!p.ok) return out(p);
      const v = p.value;
      const r = await db.from("food_logs").insert({ date: v.date, label: v.label, grams: v.grams, ...v.macros, estimated: v.estimated }).select("id").single();
      if (r.error) return finish(r.error, "Repas", {});
      const day = await db.from("food_logs").select("kcal,protein,carbs,fat,estimated").eq("date", v.date);
      const t = dayTotals((day.data ?? []).map((x) => ({ kcal: Number(x.kcal), protein: Number(x.protein), carbs: Number(x.carbs), fat: Number(x.fat), estimated: x.estimated as number })));
      return out({ ok: true, saved: { id: r.data.id, aliment: v.label, grammes: v.grams, ...v.macros, estime: !!v.estimated }, total_du_jour: t, undo: undoFor(`${v.label} ${v.grams} g`, "food_logs", r.data.id as number, null) });
    }
    case "set_nutrition_goals": {
      const p = parseNutritionGoals(args);
      if (!p.ok) return out(p);
      const before = await db.from("nutrition_goals").select("*").eq("id", 1).maybeSingle();
      if (isMissingTable(before.error)) return noTable("Objectif nutrition");
      const r = await upsertWithUndo(db, "nutrition_goals", "id", { id: 1, ...p.value }, "Objectif nutrition");
      return finish(r.error, "Objectif nutrition", { saved: p.value }, r.undo);
    }
    case "update_transaction": {
      const id = Number(args.id);
      const cur = await db.from("transactions").select("*").eq("id", id).maybeSingle();
      if (isMissingTable(cur.error)) return noTable("Opération");
      if (!cur.data) return out({ ok: false, error: "id introuvable" });
      const p = parseExpense({ label: args.label ?? cur.data.label, amount: args.amount ?? Number(cur.data.amount), category: args.category ?? cur.data.category, date: args.date }, now);
      if (!p.ok) return out(p);
      const patch = { label: p.value.label, amount: p.value.amount, category: p.value.category, ...(args.date ? { date: p.value.date } : {}) };
      const r = await db.from("transactions").update(patch).eq("id", id);
      return finish(r.error, "Opération", { saved: { id, ...patch } }, undoFor(`Modification de « ${cur.data.label} »`, "transactions", id, cur.data as Row));
    }
    case "update_workout": {
      const id = Number(args.id);
      const cur = await db.from("workouts").select("*").eq("id", id).maybeSingle();
      if (isMissingTable(cur.error)) return noTable("Séance");
      if (!cur.data) return out({ ok: false, error: "id introuvable" });
      const p = parseWorkout({ kind: args.kind ?? cur.data.kind, minutes: args.minutes === undefined ? cur.data.minutes : args.minutes, date: args.date }, now);
      if (!p.ok) return out(p);
      const patch = { kind: p.value.kind, minutes: p.value.minutes, ...(args.date ? { date: p.value.date } : {}) };
      const r = await db.from("workouts").update(patch).eq("id", id);
      return finish(r.error, "Séance", { saved: { id, ...patch } }, undoFor(`Modification de la séance « ${cur.data.kind} »`, "workouts", id, cur.data as Row));
    }
    case "update_memory": {
      const id = Number(args.id);
      const content = clampText(args.content, MAX_MEMORY);
      if (!content) return out({ ok: false, error: "content requis (texte non vide)" });
      const cur = await db.from("memories").select("*").eq("id", id).maybeSingle();
      if (!cur.data) return out({ ok: false, error: "id introuvable" });
      const r = await db.from("memories").update({ content }).eq("id", id);
      return finish(r.error, "Souvenir", { saved: { id, content } }, undoFor("Souvenir modifié", "memories", id, cur.data as Row));
    }
    case "set_setting": {
      if (args.name !== "read_aloud" || typeof args.value !== "boolean") return out({ ok: false, error: "name doit valoir read_aloud et value true ou false" });
      return out({ ok: true, setting: { name: "read_aloud", value: args.value } }); // appliqué par l'écran (réglage propre à cet appareil)
    }
    case "set_alarm": {
      const r = resolveAlarm(args, now);
      if (!r.ok) return out(r);
      return out({ ok: true, prepare: "carte affichée à Ruben : il doit toucher le bouton pour créer le réveil", card: alarmCard(r.value) });
    }
    case "set_timer": {
      const r = resolveTimer(args);
      if (!r.ok) return out(r);
      return out({ ok: true, prepare: "carte affichée à Ruben : il doit toucher le bouton pour lancer le minuteur", card: timerCard(r.value) });
    }
    case "add_recurring_task": {
      const title = clampText(args.title, MAX_TITLE);
      if (!title) return out({ ok: false, error: "title requis (texte non vide)" });
      const rule = parseRecurrence(args.every);
      if (!rule.ok) return out(rule);
      const at = parseAtTime(args.time);
      if (!at.ok) return out(at);
      const r = await db.from("recurring_tasks").insert({ title, ...rule.value, at_time: at.value }).select("id").single();
      return finish(r.error, "Récurrence", { saved: { title, quand: ruleLabel({ ...rule.value, at_time: at.value }) } }, r.data ? undoFor(`Récurrence « ${title} »`, "recurring_tasks", r.data.id as number, null) : undefined);
    }
    case "delete_entry": {
      const kind = String(args.kind ?? "");
      const t = DELETE_TABLES[kind];
      if (!t) return out({ ok: false, error: `kind inconnu. Possibles : ${Object.keys(DELETE_TABLES).join(", ")}` });
      let q = db.from(t.table).select("*");
      if (kind === "sleep" || kind === "steps") {
        if (typeof args.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(args.date)) return out({ ok: false, error: "date requise (AAAA-MM-JJ) pour ce type" });
        q = q.eq("date", args.date);
      } else if (kind === "budget") {
        const cat = typeof args.category === "string" ? fold(args.category) : "";
        const all = await db.from("budgets").select("id,category");
        const hit = (all.data ?? []).find((b) => fold(b.category) === cat);
        if (!hit) return out({ ok: false, error: `aucun budget pour « ${String(args.category)} ». Budgets : ${(all.data ?? []).map((b) => b.category).join(", ") || "aucun"}` });
        q = q.eq("id", hit.id);
      } else if (kind === "goal" && !(typeof args.id === "number")) {
        const all = await db.from("savings_goals").select("id,label,target,saved,due_label");
        const m = matchGoal((all.data ?? []).map((g) => ({ id: g.id as number, label: g.label, target: Number(g.target), saved: Number(g.saved), due_label: g.due_label })), String(args.label ?? ""));
        if (m.kind !== "one") return out({ ok: false, error: m.kind === "ambiguous" ? `plusieurs objectifs possibles : ${m.candidates.map((g) => `« ${g.label} »`).join(", ")}. Demande lequel.` : "objectif introuvable" });
        q = q.eq("id", m.goal.id);
      } else {
        if (typeof args.id !== "number" || !Number.isSafeInteger(args.id) || args.id < 1) return out({ ok: false, error: "id requis (le #n du contexte)" });
        q = q.eq("id", args.id);
      }
      const row = await q.maybeSingle();
      if (isMissingTable(row.error)) return noTable(t.label);
      if (row.error) return out({ ok: false, error: row.error.message });
      if (!row.data) return out({ ok: false, error: "introuvable : rien à supprimer" });
      const del = await db.from(t.table).delete().eq("id", (row.data as Row).id as number);
      const label = String((row.data as Row).title ?? (row.data as Row).label ?? (row.data as Row).category ?? (row.data as Row).kind ?? (row.data as Row).date ?? kind);
      return finish(del.error, t.label, { supprime: { type: kind, nom: label } }, { label: `${t.label} « ${label} » supprimé(e)`, steps: [{ op: "insert", table: t.table, values: restorable(t.table, row.data as Row) }] });
    }
    default:
      return null;
  }
}

/** Ce que l'IA voit en plus à chaque message : identifiants à corriger/supprimer, objectifs avec échéance, repas et objectif du jour, écran. */
export async function moreContext(now: Date): Promise<string> {
  const db = supabaseAdmin();
  const today = parisDay(now);
  const since = new Date(now.getTime() - 14 * 86_400_000).toISOString().slice(0, 10);
  const [txs, workouts, goals, food, ng] = await Promise.all([
    db.from("transactions").select("id,date,label,amount").order("date", { ascending: false }).limit(8),
    db.from("workouts").select("id,date,kind,minutes").gte("date", since).order("date", { ascending: false }),
    db.from("savings_goals").select("id,label,target,saved,due_label"),
    db.from("food_logs").select("id,label,grams,kcal,protein,carbs,fat,estimated").eq("date", today),
    db.from("nutrition_goals").select("kcal,protein,carbs,fat").eq("id", 1).maybeSingle(),
  ]);
  const lines: string[] = [];
  const rules = await listRules(db);
  if (rules?.length) lines.push(`Tâches récurrentes : ${rules.map((r) => `#${r.id} « ${r.title} » ${ruleLabel(r)}`).join(" ; ")}.`);
  if (!txs.error && txs.data?.length) lines.push(`Dernières opérations (pour corriger ou supprimer) : ${txs.data.map((t) => `#${t.id} ${t.date} ${t.label} ${Number(t.amount)} €`).join(" ; ")}.`);
  if (!workouts.error && workouts.data?.length) lines.push(`Séances des 14 derniers jours : ${workouts.data.map((w) => `#${w.id} ${w.date} ${w.kind}${w.minutes ? ` ${w.minutes} min` : ""}`).join(" ; ")}.`);
  if (!goals.error && goals.data?.length) lines.push(`Objectifs d'épargne : ${goals.data.map((g) => `#${g.id} ${g.label} ${Number(g.saved)}/${Number(g.target)} €${g.due_label ? ` pour ${g.due_label}` : ""}`).join(" ; ")}.`);
  if (!food.error) {
    const t = dayTotals((food.data ?? []).map((x) => ({ kcal: Number(x.kcal), protein: Number(x.protein), carbs: Number(x.carbs), fat: Number(x.fat), estimated: x.estimated as number })));
    lines.push(`Repas d'aujourd'hui : ${food.data?.length ? `${food.data.map((x) => `#${x.id} ${x.label} ${Number(x.grams)} g`).join(", ")} → ${t.kcal} kcal, ${t.protein} g protéines, ${t.carbs} g glucides, ${t.fat} g lipides` : "rien noté"}.`);
    const g = ng.data;
    lines.push(`Objectif nutrition : ${g ? `${g.kcal ?? "?"} kcal, ${g.protein ?? "?"} g protéines, ${g.carbs ?? "?"} g glucides, ${g.fat ?? "?"} g lipides` : "pas défini"}.`);
  }
  return lines.map((l) => `- ${l}`).join("\n");
}
