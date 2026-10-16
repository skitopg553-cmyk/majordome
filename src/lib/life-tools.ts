// Outils « vie » de l'agent : noter une séance, une nuit, des pas, un budget, une dépense.
// La validation est en code (life.ts). Tout est ajout ou remplacement ; rien n'est supprimé (la suppression reste à Ruben, dans l'app).
import { goalProgress, monthTotals, spendingByCategory, type Tx } from "./finance/stats";
import { hoursLabel, weekStats } from "./forme";
import { parseBudget, parseExpense, parseSleep, parseSteps, parseWorkout } from "./life";
import { isMissingTable, supabaseAdmin } from "./supabase";
import { parisDay } from "./task-groups";
import { fold } from "./text";
import type { ToolDef } from "./tools";

const DATE = { type: "string", description: "Jour concerné, AAAA-MM-JJ (heure de Paris). Absent = aujourd'hui. Jamais dans le futur." };

export const LIFE_TOOLS: ToolDef[] = [
  {
    name: "log_workout",
    description: "Noter une séance de sport DÉJÀ FAITE dans l'onglet Forme (pas une tâche). Refuse un doublon (même jour, même sport).",
    parameters: { type: "object", properties: { kind: { type: "string", description: "Sport, ex. « Musculation », « Course à pied »" }, minutes: { type: "integer", description: "Durée en minutes, si connue" }, date: DATE }, required: ["kind"] },
  },
  {
    name: "log_sleep",
    description: "Noter la durée de la nuit dans l'onglet Forme. Remplace la valeur si la nuit est déjà notée.",
    parameters: { type: "object", properties: { hours: { type: "number", description: "Heures de sommeil, ex. 7.5 pour 7 h 30" }, date: { type: "string", description: "Jour du RÉVEIL, AAAA-MM-JJ. Absent = aujourd'hui." } }, required: ["hours"] },
  },
  {
    name: "log_steps",
    description: "Noter des pas dans l'onglet Forme. mode « add » (défaut) = en plus de ce qui est déjà noté ; « set » = remplace le total du jour.",
    parameters: { type: "object", properties: { steps: { type: "integer" }, mode: { type: "string", enum: ["add", "set"] }, date: DATE }, required: ["steps"] },
  },
  {
    name: "set_budget",
    description: "Définir ou changer le budget mensuel d'une catégorie (onglet Finances).",
    parameters: { type: "object", properties: { category: { type: "string", description: "Courses, Restaurants, Transport, Abonnements, Loisirs, Shopping, Logement, Sport & santé, Retraits…" }, monthly_limit: { type: "number", description: "Euros par mois" } }, required: ["category", "monthly_limit"] },
  },
  {
    name: "add_transaction",
    description: "Noter une dépense (montant négatif) ou une entrée d'argent (positif) que Ruben cite, dans l'onglet Finances. Sans catégorie, elle est devinée.",
    parameters: { type: "object", properties: { label: { type: "string" }, amount: { type: "number", description: "Euros, négatif = dépense" }, category: { type: "string" }, date: DATE }, required: ["label", "amount"] },
  },
];

const out = (o: unknown) => JSON.stringify(o);
const noTable = (what: string) => out({ ok: false, error: `${what} : la base n'est pas prête pour cela (migration manquante). Dis-le simplement à Ruben.` });

/** Exécute un outil « vie ». Renvoie null si ce n'est pas l'un d'eux. */
export async function executeLifeTool(name: string, args: Record<string, unknown>): Promise<string | null> {
  const now = new Date();
  const db = supabaseAdmin();
  const done = (error: { code?: string; message: string } | null, what: string, result: Record<string, unknown> = {}) =>
    isMissingTable(error) ? noTable(what) : error ? out({ ok: false, error: error.message }) : out({ ok: true, ...result });

  switch (name) {
    case "log_workout": {
      const p = parseWorkout(args, now);
      if (!p.ok) return out(p);
      const same = await db.from("workouts").select("id,kind,minutes").eq("date", p.value.date);
      if (isMissingTable(same.error)) return noTable("Séance");
      const dup = (same.data ?? []).find((w) => fold(w.kind) === fold(p.value.kind));
      if (dup) return out({ ok: false, error: `déjà noté ce jour-là : séance #${dup.id} « ${dup.kind} »${dup.minutes ? ` (${dup.minutes} min)` : ""}. Ne la note pas deux fois.` });
      const r = await db.from("workouts").insert({ ...p.value, source: "manuel" }).select("id").single();
      return done(r.error, "Séance", { saved: { ...p.value, id: r.data?.id } });
    }
    case "log_sleep": {
      const p = parseSleep(args, now);
      if (!p.ok) return out(p);
      const r = await db.from("sleep_logs").upsert(p.value, { onConflict: "date" });
      return done(r.error, "Sommeil", { saved: p.value });
    }
    case "log_steps": {
      const p = parseSteps(args, now);
      if (!p.ok) return out(p);
      let total = p.value.steps;
      if (p.value.mode === "add") {
        const cur = await db.from("steps_logs").select("steps").eq("date", p.value.date).maybeSingle();
        if (isMissingTable(cur.error)) return noTable("Pas");
        total += cur.data?.steps ?? 0;
      }
      if (total > 100000) return out({ ok: false, error: "total de pas du jour supérieur à 100000 : vérifie avec Ruben" });
      const r = await db.from("steps_logs").upsert({ date: p.value.date, steps: total }, { onConflict: "date" });
      return done(r.error, "Pas", { saved: { date: p.value.date, total_du_jour: total } });
    }
    case "set_budget": {
      const p = parseBudget(args);
      if (!p.ok) return out(p);
      const r = await db.from("budgets").upsert(p.value, { onConflict: "category" });
      return done(r.error, "Budget", { saved: p.value });
    }
    case "add_transaction": {
      const p = parseExpense(args, now);
      if (!p.ok) return out(p);
      // Clé unique propre à la saisie manuelle (ne peut pas entrer en collision avec un import CSV).
      const r = await db.from("transactions").insert({ ...p.value, import_key: `manuel|${now.getTime()}|${p.value.label.toLowerCase()}` }).select("id").single();
      return done(r.error, "Dépense", { saved: { ...p.value, id: r.data?.id } });
    }
    default:
      return null;
  }
}

/** Ce que l'IA voit de la vie de Ruben à chaque message : ce qui est DÉJÀ noté (pour ne rien noter deux fois ni rater ce qui manque). */
export async function lifeContext(now: Date): Promise<string> {
  const db = supabaseAdmin();
  const today = parisDay(now);
  const month = today.slice(0, 7);
  const since = new Date(now.getTime() - 14 * 86_400_000).toISOString().slice(0, 10);
  const [workouts, sleeps, steps, txs, budgets, goals] = await Promise.all([
    db.from("workouts").select("id,date,kind,minutes").gte("date", since).order("date"),
    db.from("sleep_logs").select("date,hours").gte("date", since).order("date"),
    db.from("steps_logs").select("date,steps").eq("date", today).maybeSingle(),
    db.from("transactions").select("date,label,amount,category").gte("date", `${month}-01`),
    db.from("budgets").select("category,monthly_limit"),
    db.from("savings_goals").select("label,target,saved"),
  ]);

  const lines: string[] = [];
  if (workouts.error || sleeps.error) lines.push("Forme : pas encore disponible (tables non créées).");
  else {
    const w = workouts.data ?? [];
    const s = sleeps.data ?? [];
    const week = weekStats(w.map((x) => ({ date: x.date, kind: x.kind, minutes: x.minutes })), s.map((x) => ({ date: x.date, hours: Number(x.hours) })), now);
    const todayW = w.filter((x) => x.date === today);
    lines.push(
      `Séances d'aujourd'hui : ${todayW.map((x) => `#${x.id} ${x.kind}${x.minutes ? ` ${x.minutes} min` : ""}`).join(", ") || "aucune notée"}.`,
      `Séances cette semaine : ${week.sessions} sur ${week.activeDays} jour(s).`,
      `Nuit de cette nuit (réveil aujourd'hui) : ${s.find((x) => x.date === today) ? hoursLabel(Number(s.find((x) => x.date === today)!.hours)) : "pas notée"}.`,
      `Pas aujourd'hui : ${steps.error ? "indisponible" : steps.data ? steps.data.steps : "pas notés"}.`,
    );
  }
  if (txs.error || budgets.error) lines.push("Finances : pas encore disponibles (tables non créées).");
  else {
    const tx: Tx[] = (txs.data ?? []).map((t) => ({ date: t.date, label: t.label, amount: Number(t.amount), category: t.category }));
    const { spent, income } = monthTotals(tx, month);
    const rows = spendingByCategory(tx, month, (budgets.data ?? []).map((b) => ({ category: b.category, limit: Number(b.monthly_limit) })));
    lines.push(
      `Ce mois-ci : ${spent} € dépensés, ${income} € reçus.`,
      `Budgets : ${rows.filter((r) => r.limit !== null).map((r) => `${r.category} ${r.spent}/${r.limit} €`).join(" ; ") || "aucun défini"}.`,
    );
  }
  if (!goals.error && goals.data?.length) lines.push(`Objectifs d'épargne : ${goals.data.map((g) => `${g.label} ${goalProgress(Number(g.saved), Number(g.target))} %`).join(" ; ")}.`);
  return lines.map((l) => `- ${l}`).join("\n");
}
