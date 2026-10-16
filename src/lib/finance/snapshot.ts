// Solde lu dans un relevé importé : quand le garder, comment le lire. Sans la table (migration 0010), tout se passe sans erreur.
import { isMissingTable, supabaseAdmin } from "../supabase";

export type Snapshot = { balance: number; asOf: string }; // asOf = AAAA-MM-JJ

/** On garde un solde seulement s'il est plus récent (ou du même jour mais différent) que celui déjà conservé : un vieux relevé n'écrase jamais un récent. */
export function shouldSaveSnapshot(latest: Snapshot | null, incoming: Snapshot): boolean {
  if (!latest) return true;
  if (incoming.asOf > latest.asOf) return true;
  return incoming.asOf === latest.asOf && Math.abs(incoming.balance - latest.balance) > 0.004; // même jour, même montant (réimport) : rien à faire
}

type Db = ReturnType<typeof supabaseAdmin>;

export async function latestSnapshot(db: Db): Promise<Snapshot | null> {
  const r = await db.from("balance_snapshots").select("balance,as_of").order("as_of", { ascending: false }).order("created_at", { ascending: false }).limit(1);
  const row = r.data?.[0];
  return !r.error && row ? { balance: Number(row.balance), asOf: row.as_of as string } : null; // table absente ou autre erreur : pas de solde conservé
}

/** Enregistre le solde si besoin. `saved` = vrai si une ligne a été ajoutée ; `missingTable` = la migration 0010 n'est pas appliquée. */
export async function saveSnapshot(db: Db, incoming: Snapshot) {
  const probe = await db.from("balance_snapshots").select("id").limit(1);
  if (isMissingTable(probe.error)) return { saved: false, missingTable: true };
  if (!shouldSaveSnapshot(await latestSnapshot(db), incoming)) return { saved: false, missingTable: false };
  const r = await db.from("balance_snapshots").insert({ source: "import", balance: incoming.balance, as_of: incoming.asOf });
  return { saved: !r.error, missingTable: false };
}
