import { LIFE_TOOLS, executeLifeTool, lifeContext } from "./life-tools";
import { hasTime } from "./planning";
import { oneOffRecap } from "./slots";
import { clampText, MAX_MEMORY, taskFields } from "./limits";
import { executeMoreTool, MORE_TOOLS, moreContext } from "./more-tools";
import { supabaseAdmin } from "./supabase";
import { fold } from "./text";
import type { Undo } from "./undo";

// Outils que l'agent peut appeler. Format neutre (JSON Schema) : ai.ts l'adapte à OpenAI ou à Claude.
export type ToolDef = { name: string; description: string; parameters: Record<string, unknown> };

const DUE_AT = {
  type: "string",
  description:
    "Échéance ISO 8601 avec fuseau. AVEC heure précise (« demain 10h ») : ex. 2026-10-16T10:00:00+02:00 = élément d'AGENDA (Planning). SANS heure (« demain », « vendredi ») : minuit, ex. 2026-10-16T00:00:00+02:00 = TÂCHE (Accueil). Pas de date du tout : n'envoie pas ce champ.",
};
const END_AT = { type: "string", description: "Heure de FIN d'un créneau ponctuel (même format que due_at, même jour, après le début). Seulement si Ruben donne une fin (« de 20h à 22h »). Jamais sans due_at." };
const PRIORITY = { type: "integer", enum: [1, 2, 3], description: "1 = haute, 2 = normale, 3 = basse" };

const TASK_TOOLS: ToolDef[] = [
  {
    name: "add_task",
    description: "Créer UN élément ponctuel (une seule fois) : PENSE-BÊTE = simple tâche sans horaire (« ranger ma chambre ») → sans heure (due_at à minuit, ou aucune date), il se coche et n'apparaît jamais dans le Planning ; CRÉNEAU ponctuel avec heure = élément d'agenda, affiché dans le Planning (« dîner avec Arthur lundi 20h », « de 20h à 22h ») → due_at avec l'heure de début et end_at si une fin est dite. Ce qui REVIENT (travail, salle…) n'est PAS pour cet outil (→ add_slot). N'invente jamais une heure.",
    parameters: {
      type: "object",
      properties: { title: { type: "string" }, due_at: DUE_AT, end_at: END_AT, priority: PRIORITY, notes: { type: "string" } },
      required: ["title"],
    },
  },
  {
    name: "update_task",
    description: "Modifier une tâche existante (titre, échéance, priorité, notes).",
    parameters: {
      type: "object",
      properties: { id: { type: "integer" }, title: { type: "string" }, due_at: DUE_AT, priority: PRIORITY, notes: { type: "string" } },
      required: ["id"],
    },
  },
  {
    name: "complete_task",
    description: "Marquer une tâche comme faite.",
    parameters: { type: "object", properties: { id: { type: "integer" } }, required: ["id"] },
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
export const TOOLS: ToolDef[] = [...TASK_TOOLS, ...LIFE_TOOLS, ...MORE_TOOLS];

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
      const open = await db.from("tasks").select("id,title").eq("status", "todo");
      if (open.error) return JSON.stringify({ ok: false, error: open.error.message });
      const dup = (open.data ?? []).find((t) => isSimilar(t.title, f.fields.title!));
      if (dup) {
        return JSON.stringify({
          ok: false,
          error: `tâche similaire déjà existante : #${dup.id} « ${dup.title} ». Utilise update_task si besoin, sinon n'en crée pas une autre.`,
        });
      }
      res = await db.from("tasks").insert(f.fields).select("id").single();
      if (!res.error) {
        undo = { label: `Tâche « ${f.fields.title} »`, steps: [{ op: "delete", table: "tasks", id: idOf(res.data) }] };
        const due = f.fields.due_at;
        recap = due && hasTime(due) ? oneOffRecap(f.fields.title!, due, f.fields.end_at ?? null) : `Pense-bête : ${f.fields.title}`;
      }
      break;
    }
    case "update_task": {
      const f = taskFields(args, { requireTitle: false });
      if (!f.ok) return JSON.stringify({ ok: false, error: f.error });
      const patch = f.fields;
      const keys = Object.keys(patch);
      const before = keys.length ? await db.from("tasks").select(keys.join(",")).eq("id", Number(args.id)).maybeSingle() : null;
      res = await db.from("tasks").update(patch).eq("id", Number(args.id)).select("id");
      if (!res.error && before?.data) undo = { label: "Modification de tâche", steps: [{ op: "restore", table: "tasks", id: Number(args.id), values: before.data as unknown as Record<string, string | number | null> }] };
      break;
    }
    case "complete_task": {
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
  const [tasks, memories] = await Promise.all([
    db.from("tasks").select("id,title,due_at,priority,notes").eq("status", "todo")
      .order("due_at", { ascending: true, nullsFirst: false }).limit(50),
    db.from("memories").select("id,content,category").order("created_at").limit(200),
  ]);

  const now = new Date();
  const nowText = now.toLocaleString("fr-FR", { timeZone: TZ, dateStyle: "full", timeStyle: "short" });
  const offset = new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "longOffset" })
    .formatToParts(now).find((p) => p.type === "timeZoneName")?.value.replace("GMT", "") || "+02:00";

  const fmt = (iso: string) => new Date(iso).toLocaleString("fr-FR", hasTime(iso) ? { timeZone: TZ, dateStyle: "medium", timeStyle: "short" } : { timeZone: TZ, dateStyle: "medium" });
  const prio = ["", "haute", "normale", "basse"];

  const memLines = (memories.data ?? []).map((m) => `- [#${m.id}] (${m.category}) ${m.content}`);
  const taskLines = (tasks.data ?? []).map(
    (t) => `- [#${t.id}] ${t.title}${t.due_at ? ` — ${hasTime(t.due_at) ? "agenda" : "tâche"} pour le ${fmt(t.due_at)}` : ""} — priorité ${prio[t.priority] ?? t.priority}${t.notes ? ` — ${t.notes}` : ""}`,
  );

  return `Maintenant : ${nowText} (fuseau Europe/Paris, UTC${offset}).

## Ce que tu sais de Ruben
${memLines.join("\n") || "(rien pour l'instant)"}

## Tâches en cours
${taskLines.join("\n") || "(aucune)"}

## Vie de Ruben (déjà noté dans l'app)
${await lifeContext(now)}
${await moreContext(now)}`;
}
