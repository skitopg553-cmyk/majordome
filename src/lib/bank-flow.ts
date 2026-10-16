// Les trois temps de la connexion bancaire, séparés de Next.js pour être testés avec de faux appels :
// 1) connectBank : demande l'adresse où Ruben donne son accord (lecture seule) ; 2) finishConnection : au retour, échange le code ;
// 3) syncAccounts : lit soldes et opérations. Rien ici n'écrit en base et rien ne peut déplacer d'argent.
import { BANK_COUNTRY, CONSENT_DAYS, FIRST_SYNC_DAYS, RESYNC_OVERLAP_DAYS } from "./bank-config";
import type * as EB from "./enable-banking";
import { findRevolut } from "./enable-banking";
import { accountsFromSession, mapTransactions, pickBalance, totalBalance, type BankAccount, type IngestItem } from "./finance/bank";
import { signState, verifyState } from "./signed-state";

export type Eb = Pick<typeof EB, "listAspsps" | "startAuth" | "createSession" | "getBalances" | "getTransactions">;
const PURPOSE = "bank";
const DAY = 86_400_000;

/** Erreur « attendue » (message déjà lisible en français) : la route l'affiche telle quelle. */
export class BankFlowError extends Error {}

export async function connectBank(p: { eb: Eb; secret: string; redirectUrl: string; now?: number }): Promise<{ url: string }> {
  const now = p.now ?? Date.now();
  const { aspsps } = await p.eb.listAspsps(BANK_COUNTRY);
  const revolut = findRevolut(aspsps ?? []);
  if (!revolut) throw new BankFlowError(`Revolut n'apparaît pas dans la liste d'Enable Banking pour « ${BANK_COUNTRY} ». Banques proposées : ${(aspsps ?? []).map((a) => a.name).slice(0, 15).join(", ") || "aucune"}.`);
  const r = await p.eb.startAuth({ aspsp: revolut, state: signState(p.secret, PURPOSE, now), redirectUrl: p.redirectUrl, validUntil: new Date(now + CONSENT_DAYS * DAY) });
  if (!r.url) throw new BankFlowError("Enable Banking n'a pas renvoyé d'adresse de connexion.");
  return { url: r.url };
}

export async function finishConnection(p: { eb: Eb; secret: string; state: string | null; code: string | null; now?: number }) {
  if (!verifyState(p.state, p.secret, PURPOSE, p.now)) throw new BankFlowError("Lien de connexion expiré ou invalide : relance « Connecter ma banque ».");
  if (!p.code) throw new BankFlowError("La banque n'a pas renvoyé de code d'autorisation.");
  const session = await p.eb.createSession(p.code);
  const accounts = accountsFromSession(session);
  if (!session.session_id || !accounts.length) throw new BankFlowError("Enable Banking a accepté le code mais n'a renvoyé aucun compte.");
  return { sessionId: session.session_id, bankName: session.aspsp?.name ?? "Revolut", accounts, validUntil: session.access?.valid_until ?? null };
}

/** Depuis quand relire : 90 jours la 1re fois ; ensuite 7 jours avant la dernière synchro (AAAA-MM-JJ). */
export function syncSince(lastSyncedAt: string | null | undefined, now: Date): string {
  const last = lastSyncedAt ? Date.parse(lastSyncedAt) : NaN;
  const from = Number.isNaN(last) ? now.getTime() - FIRST_SYNC_DAYS * DAY : last - RESYNC_OVERLAP_DAYS * DAY;
  return new Date(from).toISOString().slice(0, 10);
}

export async function syncAccounts(p: { eb: Eb; accounts: BankAccount[]; since: string; now: Date }) {
  const items: IngestItem[] = [];
  let skipped = 0;
  const accounts: BankAccount[] = [];
  for (const a of p.accounts) {
    const [balances, txs] = await Promise.all([p.eb.getBalances(a.uid), p.eb.getTransactions(a.uid, p.since)]);
    const mapped = mapTransactions(txs, a.uid);
    items.push(...mapped.items);
    skipped += mapped.skipped;
    accounts.push({ ...a, balance: pickBalance(balances.balances), balance_at: p.now.toISOString() });
  }
  return { items, skipped, accounts, balance: totalBalance(accounts) };
}
