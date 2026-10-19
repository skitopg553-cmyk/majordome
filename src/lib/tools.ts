import { LIFE_TOOLS, executeLifeTool, lifeContext } from "./life-tools";
import { hasTime } from "./planning";
import { agendaText, CALENDAR_TOOLS, executeCalendarTool, type Backend } from "./calendar-tools";
import { applyOps, loadState } from "./calendar-store";
import { addDays, parisDay } from "./task-groups";
import { clampText, MAX_MEMORY, taskFields } from "./limits";
import { executeMoreTool, MORE_TOOLS, moreContext } from "./more-tools";
import { supabaseAdmin } from "./supabase";
import { fold } from "./text";
import type { Undo } from "./undo";

// Outils que l'agent peut appeler. Format neutre (JSON Schema) : ai.ts l'adapte à OpenAI ou à Claude.
export type ToolDef = { name: string; description: string; parameters: Record<string, unknown> };

const DUE_AT = {
  type: "string",
  description: "Jour du pense-bête, à MINUIT avec fuseau (ex. 2026-10-16T00:00:00+02:00). Pas de jour : n'envoie pas ce champ. Jamais d'heure : un pense-bête avec heure est un événement (add_event).",
};
const PRIORITY = { type: "integer", enum: [1, 2, 3], description: "1 = haute, 2 = normale, 3 = basse" };
const WHICH = { type: "string", description: "Titre du pense-bête tel que Ruben le dit (le code le retrouve)" };

const TASK_TOOLS: ToolDef[] = [
  {
    name: "add_task",
    description: "Créer un PENSE-BÊTE : une chose à faire SANS horaire (« ranger ma chambre », « penser à sortir les poubelles »). Il se coche et n'apparaît jamais dans la grille du calendrier. Avec une heure, c'est un événement : add_event.",
    parameters: { type: "object", properties: { title: { type: "string" }, due_at: DUE_AT, priority: PRIORITY, notes: { type: "string" } }, required: ["title"] },
  },
  {
    name: "update_task",
    description: "Modifier un pense-bête retrouvé par son titre : nouveau titre, jour, priorité, notes.",
    parameters: { type: "object", properties: { title: WHICH, new_title: { type: "string" }, due_at: DUE_AT, priority: PRIORITY, notes: { type: "string" } }, required: ["title"] },
  },
  {
    name: "complete_task",
    description: "Cocher un pense-bête (c'est fait), retrouvé par son titre.",
    parameters: { type: "object", properties: { title: WHICH }, required: ["title"] },
  },
  {
    name: "remember",
    description:
      "Mémoriser un fait durable sur Ruben. À APPELER dès qu'il dit « retiens que… », « n'oublie pas… », « souviens-toi… », « mon objectif est… » (sans montant en euros), ou un souhait durable (« je veux perdre 5 kg »). Catégories : objectif, preference, habitude, info. Jamais une tâche, jamais un objectif d'épargne chiffré (→ set_goal). Ne dis jamais que c'est retenu sans avoir appelé cet outil.",
    parameters: {
      type: "object",
      properties: {
        content: { type: "string" },
        category: { type: "string", enum: ["objectif", "preference", "habitude", "info"] },
      },
      required: ["content", "category"],
    },
  },
  {
    name: "forget",
    description: "Supprimer un souvenir devenu faux ou que Ruben veut oublier.",
    parameters: { type: "object", properties: { id: { type: "integer" } }, required: ["id"] },
  },
];

// Tâches + mémoire + vie (Forme, budgets, dépenses) : tout ce que l'agent peut écrire.
export const TOOLS: ToolDef[] = [...TASK_TOOLS, ...CALENDAR_TOOLS, ...LIFE_TOOLS, ...MORE_TOOLS];

/** Le calendrier lit et écrit dans la vraie base. */
const dbBackend = (db: ReturnType<typeof supabaseAdmin>): Backend => ({ load: () => loadState(db), apply: (ops, label) => applyOps(db, ops, label) });

/** Un pense-bête (à faire, sans heure) retrouvé par son titre : jamais par un identifiant que Ruben devrait donner. */
async function findReminder(db: ReturnType<typeof supabaseAdmin>, title: unknown): Promise<{ ok: true; id: number; title: string } | { ok: false; error: string }> {
  if (typeof title !== "string" || !title.trim()) return { ok: false, error: "title requis : le titre du pense-bête" };
  const open = await db.from("tasks").select("id,title,due_at").eq("status", "todo");
  if (open.error) return { ok: false, error: open.error.message };
  const hits = (open.data ?? []).filter((t) => !(t.due_at && hasTime(t.due_at)) && isSimilar(t.title, title));
  if (!hits.length) return { ok: false, error: `aucun pense-bête « ${title} ». Dis-le à Ruben, n'invente rien.` };
  if (hits.length > 1) return { ok: false, error: `plusieurs pense-bêtes possibles : ${hits.map((h) => `« ${h.title} »`).join(", ")}. Pose UNE question à Ruben.` };
  return { ok: true, id: hits[0].id, title: hits[0].title };
}

// Comparaison sans accents, casse ni ponctuation : "Appeler le médecin !" == "appeler le medecin".
const norm = (s: string) =>
  fold(s).replace(/[^a-z0-9]+/g, " ").trim();

// shortcut: similarité = égalité ou inclusion du titre normalisé, pas de flou (Levenshtein) ; à affiner si des doublons passent encore.
export function isSimilar(a: string, b: string) {
  const x = norm(a), y = norm(b);
  return x !== "" && y !== "" && (x === y || x.includes(y) || y.includes(x));
}

/**
 * Exécute un outil et renvoie un résultat texte court pour le modèle.
 * Pour chaque écriture, le résultat contient aussi « undo » : de quoi la défaire (la route de chat le retire avant de répondre au modèle
 * et le transmet à l'écran, qui affiche un bouton « Annuler »).
 */
export async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  const db = supabaseAdmin();
  const pick = (keys: string[]) =>
    Object.fromEntries(keys.filter((k) => args[k] !== undefined && args[k] !== null).map((k) => [k, args[k]]));

  let res: { data: unknown; error: { message: string } | null };
  let undo: Undo | undefined;
  let recap: string | undefined; // phrase écrite par le CODE, reprise dans le récapitulatif final de la route
  const idOf = (d: unknown) => (d && typeof d === "object" && "id" in d ? Number((d as { id: unknown }).id) : NaN);
  switch (name) {
    case "add_task": {
      const f = taskFields(args, { requireTitle: true }); // titre borné, échéance ISO AVEC fuseau : sinon le modèle reçoit l'erreur et corrige
      if (!f.ok) return JSON.stringify({ ok: false, error: f.error });
      if (f.fields.due_at && hasTime(f.fields.due_at)) return JSON.stringify({ ok: false, error: "un pense-bête n'a pas d'heure : avec une heure, c'est un événement → add_event (avec une heure de fin)." });
      delete f.fields.end_at;
      const open = await db.from("tasks").select("id,title").eq("status", "todo");
      if (open.error) return JSON.stringify({ ok: false, error: open.error.message });
      const dup = (open.data ?? []).find((t) => isSimilar(t.title, f.fields.title!));
      if (dup) {
        return JSON.stringify({
          ok: false,
          error: `pense-bête similaire déjà existant : « ${dup.title} ». Utilise update_task si besoin, sinon n'en crée pas un autre.`,
        });
      }
      res = await db.from("tasks").insert(f.fields).select("id").single();
      if (!res.error) {
        undo = { label: `Tâche « ${f.fields.title} »`, steps: [{ op: "delete", table: "tasks", id: idOf(res.data) }] };
        recap = `Pense-bête : ${f.fields.title}`;
      }
      break;
    }
    case "update_task": {
      const which = await findReminder(db, args.title);
      if (!which.ok) return JSON.stringify(which);
      args = { ...args, id: which.id, title: args.new_title };
      const f = taskFields(args, { requireTitle: false });
      if (f.ok && f.fields.due_at && hasTime(f.fields.due_at)) return JSON.stringify({ ok: false, error: "un pense-bête n'a pas d'heure" });
      if (!f.ok) return JSON.stringify({ ok: false, error: f.error });
      const patch = f.fields;
      const keys = Object.keys(patch);
      const before = keys.length ? await db.from("tasks").select(keys.join(",")).eq("id", Number(args.id)).maybeSingle() : null;
      res = await db.from("tasks").update(patch).eq("id", Number(args.id)).select("id");
      if (!res.error) recap = `Pense-bête modifié : ${f.fields.title ?? which.title}`;
      if (!res.error && before?.data) undo = { label: "Modification de tâche", steps: [{ op: "restore", table: "tasks", id: Number(args.id), values: before.data as unknown as Record<string, string | number | null> }] };
      break;
    }
    case "complete_task": {
      const which = await findReminder(db, args.title);
      if (!which.ok) return JSON.stringify(which);
      args = { ...args, id: which.id };
      recap = `Coché : ${which.title}`;
      const before = await db.from("tasks").select("status,done_at").eq("id", Number(args.id)).maybeSingle();
      res = await db.from("tasks").update({ status: "done", done_at: new Date().toISOString() }).eq("id", Number(args.id)).select("id");
      if (!res.error && before.data) undo = { label: "Tâche terminée", steps: [{ op: "restore", table: "tasks", id: Number(args.id), values: before.data as Record<string, string | null> }] };
      break;
    }
    case "remember": {
      // Pas deux fois le même souvenir (par le modèle ou par un ordre explicite) : même règle que pour les tâches.
      const content = clampText(args.content, MAX_MEMORY);
      if (!content) return JSON.stringify({ ok: false, error: "content requis (texte non vide)" });
      const known = await db.from("memories").select("id,content").limit(300);
      const dup = (known.data ?? []).find((m) => isSimilar(m.content, content));
      if (dup) return JSON.stringify({ ok: false, error: `souvenir similaire déjà noté : #${dup.id} « ${dup.content} ». Ne le note pas deux fois.` });
      res = await db.from("memories").insert({ ...pick(["category"]), content }).select("id").single();
      if (!res.error) undo = { label: "Souvenir", steps: [{ op: "delete", table: "memories", id: idOf(res.data) }] };
      break;
    }
    case "forget": {
      const before = await db.from("memories").select("content,category").eq("id", Number(args.id)).maybeSingle();
      res = await db.from("memories").delete().eq("id", Number(args.id)).select("id");
      if (!res.error && before.data) undo = { label: "Souvenir oublié", steps: [{ op: "insert", table: "memories", values: before.data }] };
      break;
    }
    default: {
      const cal = await executeCalendarTool(name, args, dbBackend(db));
      if (cal) return cal;
      const life = await executeLifeTool(name, args);
      return life ?? (await executeMoreTool(name, args)) ?? JSON.stringify({ ok: false, error: `outil inconnu : ${name}` });
    }
  }
  if (res.error) return JSON.stringify({ ok: false, error: res.error.message });
  if (Array.isArray(res.data) && res.data.length === 0) return JSON.stringify({ ok: false, error: "id introuvable" });
  return JSON.stringify({ ok: true, result: res.data, ...(recap ? { recap } : {}), ...(undo ? { undo } : {}) });
}

const TZ = "Europe/Paris";

/** Contexte injecté à chaque message : date, mémoires, tâches en cours. Calculé en code. */
export async function buildContext(): Promise<string> {
  const db = supabaseAdmin();
  const [tasks, memories, cal] = await Promise.all([
    db.from("tasks").select("title,due_at,priority,notes").eq("status", "todo")
      .order("due_at", { ascending: true, nullsFirst: false }).limit(50),
    db.from("memories").select("id,content,category").order("created_at").limit(200),
    loadState(db),
  ]);

  const now = new Date();
  const nowText = now.toLocaleString("fr-FR", { timeZone: TZ, dateStyle: "full", timeStyle: "short" });
  const offset = new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "longOffset" })
    .formatToParts(now).find((p) => p.type === "timeZoneName")?.value.replace("GMT", "") || "+02:00";

  const fmt = (iso: string) => new Date(iso).toLocaleString("fr-FR", hasTime(iso) ? { timeZone: TZ, dateStyle: "medium", timeStyle: "short" } : { timeZone: TZ, dateStyle: "medium" });
  const prio = ["", "haute", "normale", "basse"];

  const memLines = (memories.data ?? []).map((m) => `- [#${m.id}] (${m.category}) ${m.content}`);
  // Sans identifiant : l'IA désigne les choses par leur titre (et ne peut donc pas en afficher).
  const taskLines = (tasks.data ?? []).filter((t) => !(t.due_at && hasTime(t.due_at))).map(
    (t) => `- ${t.title}${t.due_at ? ` — pour le ${fmt(t.due_at)}` : ""} — priorité ${prio[t.priority] ?? t.priority}${t.notes ? ` — ${t.notes}` : ""}`,
  );
  const today = parisDay(now);

  return `Maintenant : ${nowText} (fuseau Europe/Paris, UTC${offset}).

## Ce que tu sais de Ruben
${memLines.join("\n") || "(rien pour l'instant)"}

## Pense-bêtes à faire (sans heure)
${taskLines.join("\n") || "(aucun)"}

## Calendrier des 7 prochains jours (déjà enregistré : ne le recrée pas)
${cal ? agendaText(cal, today, addDays(today, 6), today) : "(indisponible)"}

## Vie de Ruben (déjà noté dans l'app)
${await lifeContext(now)}
${await moreContext(now)}`;
}
