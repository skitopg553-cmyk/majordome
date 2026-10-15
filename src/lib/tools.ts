import { supabaseAdmin } from "./supabase";

// Outils que l'agent peut appeler. Format neutre (JSON Schema) : ai.ts l'adapte à OpenAI ou à Claude.
export type ToolDef = { name: string; description: string; parameters: Record<string, unknown> };

const DUE_AT = {
  type: "string",
  description: "Échéance au format ISO 8601 avec fuseau, ex. 2026-10-16T10:00:00+02:00.",
};
const PRIORITY = { type: "integer", enum: [1, 2, 3], description: "1 = haute, 2 = normale, 3 = basse" };

export const TOOLS: ToolDef[] = [
  {
    name: "add_task",
    description: "Créer une tâche pour Ruben.",
    parameters: {
      type: "object",
      properties: { title: { type: "string" }, due_at: DUE_AT, priority: PRIORITY, notes: { type: "string" } },
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
    description: "Mémoriser un fait durable sur Ruben : objectif, préférence, habitude ou info utile. Jamais une tâche.",
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

// Comparaison sans accents, casse ni ponctuation : "Appeler le médecin !" == "appeler le medecin".
const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// shortcut: similarité = égalité ou inclusion du titre normalisé, pas de flou (Levenshtein) ; à affiner si des doublons passent encore.
export function isSimilar(a: string, b: string) {
  const x = norm(a), y = norm(b);
  return x !== "" && y !== "" && (x === y || x.includes(y) || y.includes(x));
}

/** Exécute un outil et renvoie un résultat texte court pour le modèle. */
export async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  const db = supabaseAdmin();
  const pick = (keys: string[]) =>
    Object.fromEntries(keys.filter((k) => args[k] !== undefined && args[k] !== null).map((k) => [k, args[k]]));

  let res: { data: unknown; error: { message: string } | null };
  switch (name) {
    case "add_task": {
      const open = await db.from("tasks").select("id,title").eq("status", "todo");
      if (open.error) return JSON.stringify({ ok: false, error: open.error.message });
      const dup = (open.data ?? []).find((t) => isSimilar(t.title, String(args.title ?? "")));
      if (dup) {
        return JSON.stringify({
          ok: false,
          error: `tâche similaire déjà existante : #${dup.id} « ${dup.title} ». Utilise update_task si besoin, sinon n'en crée pas une autre.`,
        });
      }
      res = await db.from("tasks").insert(pick(["title", "due_at", "priority", "notes"])).select("id").single();
      break;
    }
    case "update_task":
      res = await db.from("tasks").update(pick(["title", "due_at", "priority", "notes"])).eq("id", Number(args.id)).select("id");
      break;
    case "complete_task":
      res = await db.from("tasks").update({ status: "done", done_at: new Date().toISOString() }).eq("id", Number(args.id)).select("id");
      break;
    case "remember":
      res = await db.from("memories").insert(pick(["content", "category"])).select("id").single();
      break;
    case "forget":
      res = await db.from("memories").delete().eq("id", Number(args.id)).select("id");
      break;
    default:
      return JSON.stringify({ ok: false, error: `outil inconnu : ${name}` });
  }
  if (res.error) return JSON.stringify({ ok: false, error: res.error.message });
  if (Array.isArray(res.data) && res.data.length === 0) return JSON.stringify({ ok: false, error: "id introuvable" });
  return JSON.stringify({ ok: true, result: res.data });
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

  const fmt = (iso: string) => new Date(iso).toLocaleString("fr-FR", { timeZone: TZ, dateStyle: "medium", timeStyle: "short" });
  const prio = ["", "haute", "normale", "basse"];

  const memLines = (memories.data ?? []).map((m) => `- [#${m.id}] (${m.category}) ${m.content}`);
  const taskLines = (tasks.data ?? []).map(
    (t) => `- [#${t.id}] ${t.title}${t.due_at ? ` — pour le ${fmt(t.due_at)}` : ""} — priorité ${prio[t.priority] ?? t.priority}${t.notes ? ` — ${t.notes}` : ""}`,
  );

  return `Maintenant : ${nowText} (fuseau Europe/Paris, UTC${offset}).

## Ce que tu sais de Ruben
${memLines.join("\n") || "(rien pour l'instant)"}

## Tâches en cours
${taskLines.join("\n") || "(aucune)"}`;
}
