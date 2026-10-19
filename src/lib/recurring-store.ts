// Lecture / matérialisation des tâches récurrentes (migration 0012). Sans la table : on ne fait rien, sans erreur.
import { dueAtFor, dueToday, type StoredRule } from "./recurrence";
import { isMissingTable, supabaseAdmin } from "./supabase";
import { parisDay } from "./task-groups";

type Db = ReturnType<typeof supabaseAdmin>;

export async function listRules(db: Db): Promise<StoredRule[] | null> {
  // Colonnes de la migration 0014 (jours multiples, fin, habitude) : si elle n'est pas appliquée, on retombe sur les anciennes colonnes.
  let r: { data: unknown[] | null; error: { code?: string; message: string } | null } = await db.from("recurring_tasks").select("id,created_at,title,kind,weekday,month_day,at_time,last_generated,days,end_time,habit").order("id");
  if (r.error && isMissingTable(r.error)) r = await db.from("recurring_tasks").select("id,created_at,title,kind,weekday,month_day,at_time,last_generated").order("id");
  if (r.error) {
    if (!isMissingTable(r.error)) console.error("recurring_tasks :", r.error.message);
    return null; // table absente ou illisible : pas de récurrence
  }
  return (r.data ?? []) as StoredRule[];
}

/**
 * Crée les tâches du jour pour les règles qui tombent aujourd'hui. Chaque règle est « réclamée » par une mise à jour conditionnelle
 * (last_generated < aujourd'hui) avant de créer la tâche : deux chargements simultanés ne créent donc qu'une seule tâche.
 */
export async function materializeToday(db: Db, now = new Date()) {
  const rules = await listRules(db);
  if (!rules?.length) return 0;
  const today = parisDay(now);
  let created = 0;
  for (const rule of dueToday(rules, today)) {
    const claim = await db.from("recurring_tasks").update({ last_generated: today }).eq("id", rule.id).or(`last_generated.is.null,last_generated.lt.${today}`).select("id");
    if (claim.error || !claim.data?.length) continue; // déjà pris par un autre chargement
    const ins = await db.from("tasks").insert({ title: rule.title, due_at: dueAtFor(rule.at_time, today), priority: 2 });
    if (ins.error) console.error("tâche récurrente non créée :", ins.error.message);
    else created++;
  }
  return created;
}
