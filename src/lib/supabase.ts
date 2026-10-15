import { createClient } from "@supabase/supabase-js";

// Client "serveur" : utilise la clé service_role, qui contourne les règles d'accès.
// Il ne doit JAMAIS être importé dans un composant client (navigateur).
/** Vrai si l'erreur Supabase signifie « la table n'existe pas encore » (migration pas appliquée). */
export function isMissingTable(error: { code?: string; message?: string } | null) {
  return !!error && (error.code === "42P01" || error.code === "PGRST205" || /does not exist|could not find the table/i.test(error.message ?? ""));
}

export function supabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant");
  return createClient(url, key, { auth: { persistSession: false } });
}
