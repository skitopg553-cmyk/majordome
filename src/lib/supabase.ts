import { createClient } from "@supabase/supabase-js";

// Client "serveur" : utilise la clé service_role, qui contourne les règles d'accès.
// Il ne doit JAMAIS être importé dans un composant client (navigateur).
export function supabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant");
  return createClient(url, key, { auth: { persistSession: false } });
}
