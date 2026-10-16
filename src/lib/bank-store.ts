// Accès à la table bank_connections (migration 0009, appliquée par Ruben). Tant qu'elle n'existe pas : { ready: false }, jamais d'erreur.
import type { BankAccount } from "./finance/bank";
import { isMissingTable, supabaseAdmin } from "./supabase";

type Db = ReturnType<typeof supabaseAdmin>;
export type Connection = { id: number; bank_name: string; session_id: string; accounts: BankAccount[]; valid_until: string | null; last_synced_at: string | null };
export type Latest = { ready: false } | { ready: true; connection: Connection | null };

export async function latestConnection(db: Db): Promise<Latest> {
  const r = await db.from("bank_connections").select("id,bank_name,session_id,accounts,valid_until,last_synced_at").order("created_at", { ascending: false }).limit(1);
  if (isMissingTable(r.error) || r.error) return { ready: false }; // une autre erreur (base injoignable…) : on se comporte comme « pas prêt », l'écran reste utilisable
  return { ready: true, connection: (r.data?.[0] as Connection | undefined) ?? null };
}

export async function saveConnection(db: Db, c: { bankName: string; sessionId: string; accounts: BankAccount[]; validUntil: string | null }) {
  const r = await db.from("bank_connections").insert({ bank_name: c.bankName, session_id: c.sessionId, accounts: c.accounts, valid_until: c.validUntil });
  return { error: r.error, missingTable: isMissingTable(r.error) };
}

export async function saveSync(db: Db, id: number, accounts: BankAccount[], syncedAt: Date) {
  return db.from("bank_connections").update({ accounts, last_synced_at: syncedAt.toISOString() }).eq("id", id);
}

/** Ce que l'écran a le droit de voir : jamais l'identifiant de session. */
export function publicBank(l: Latest, totalBalance: (a: BankAccount[]) => number | null) {
  if (!l.ready) return { ready: false as const };
  const c = l.connection;
  return {
    ready: true as const,
    connection: c ? { bankName: c.bank_name, balance: totalBalance(c.accounts), syncedAt: c.last_synced_at, validUntil: c.valid_until } : null,
  };
}
