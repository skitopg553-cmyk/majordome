// Données Enable Banking → le même format que l'import CSV (date, libellé, montant ; montant négatif = dépense).
// Logique pure et testée : aucune requête ici.
import type { BalanceResource, EbTransaction, Session } from "../enable-banking";
import { parseIsoDate } from "./csv";

export type IngestItem = { date: string; label: string; amount: number; key: string };
export type BankAccount = { uid: string; name: string | null; currency: string | null; balance?: number | null; balance_at?: string | null };

const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

/**
 * Une opération de la banque → une ligne prête à enregistrer, ou null si on ne peut pas l'enregistrer SANS rien deviner :
 * autre devise (jamais convertie), sens inconnu, montant nul ou illisible, date absente.
 * Le montant de l'API est toujours positif : c'est credit_debit_indicator qui donne le signe (DBIT = dépense).
 */
export function mapTransaction(t: EbTransaction): { date: string; label: string; amount: number; id: string | null } | null {
  if (t.status && t.status.toUpperCase() !== "BOOK") return null; // en attente : pas encore définitif
  const cur = (t.transaction_amount?.currency ?? "").toUpperCase();
  const abs = Math.abs(Number(t.transaction_amount?.amount));
  if (cur !== "EUR" || !Number.isFinite(abs) || abs === 0) return null;
  const sign = t.credit_debit_indicator === "DBIT" ? -1 : t.credit_debit_indicator === "CRDT" ? 1 : 0;
  if (!sign) return null;
  const date = [t.booking_date, t.value_date, t.transaction_date].map((d) => parseIsoDate(d ?? "")).find(Boolean) ?? null;
  if (!date) return null;
  // Libellé = l'autre partie (celui qu'on a payé, ou celui qui nous a payés), sinon le texte de l'opération.
  const counterparty = sign < 0 ? t.creditor?.name : t.debtor?.name;
  const label = clean(counterparty) || clean(t.remittance_information?.join(" ")) || clean(t.note) || "Opération bancaire";
  return { date, label, amount: Math.round(sign * abs * 100) / 100, id: clean(t.entry_reference) || clean(t.transaction_id) || null };
}

/**
 * Lignes à enregistrer + clés anti-doublon. La clé vient de l'identifiant de la banque quand il existe (stable d'une synchro à l'autre) ;
 * sinon du contenu (date, libellé, montant). Une même clé vue deux fois dans le lot reçoit un numéro (#2, #3…) : deux cafés identiques restent deux opérations.
 * Les clés commencent par « eb| » : elles ne peuvent jamais entrer en collision avec celles d'un import CSV.
 */
export function mapTransactions(txs: EbTransaction[], uid: string): { items: IngestItem[]; skipped: number } {
  const seen = new Map<string, number>();
  const items: IngestItem[] = [];
  let skipped = 0;
  for (const t of txs) {
    const m = mapTransaction(t);
    if (!m) {
      skipped++;
      continue;
    }
    const base = m.id ? `eb|${uid}|${m.id}` : `eb|${uid}|${m.date}|${m.label.toLowerCase()}|${m.amount.toFixed(2)}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    items.push({ date: m.date, label: m.label, amount: m.amount, key: n > 1 ? `${base}#${n}` : base });
  }
  return { items, skipped };
}

// Solde « comptabilisé » d'abord (cohérent avec les opérations BOOK que l'on importe), puis le disponible.
const BALANCE_ORDER = ["CLBD", "ITBD", "ITAV", "CLAV", "XPCD", "OPBD"];

/** Le solde en euros d'un compte, ou null s'il n'y en a pas (ou pas en euros : on ne convertit rien). */
export function pickBalance(balances: BalanceResource[] | undefined): number | null {
  const eur = (balances ?? []).filter((b) => (b.balance_amount?.currency ?? "").toUpperCase() === "EUR" && Number.isFinite(Number(b.balance_amount?.amount)));
  for (const type of BALANCE_ORDER) {
    const b = eur.find((x) => x.balance_type === type);
    if (b) return Math.round(Number(b.balance_amount!.amount) * 100) / 100;
  }
  return eur[0] ? Math.round(Number(eur[0].balance_amount!.amount) * 100) / 100 : null;
}

/** Comptes d'une session (l'API peut donner des objets, ou de simples identifiants) ; ceux sans identifiant sont ignorés. */
export function accountsFromSession(s: Session): BankAccount[] {
  return (s.accounts ?? [])
    .map((a): BankAccount | null => (typeof a === "string" ? (a ? { uid: a, name: null, currency: null } : null) : a.uid ? { uid: a.uid, name: a.name ?? null, currency: a.currency ?? null } : null))
    .filter((a): a is BankAccount => a !== null);
}

/** Solde total en euros : somme des comptes qui ont un solde en euros ; null si aucun. */
export function totalBalance(accounts: BankAccount[]): number | null {
  const known = accounts.filter((a) => typeof a.balance === "number");
  return known.length ? Math.round(known.reduce((s, a) => s + (a.balance as number), 0) * 100) / 100 : null;
}

/** Jours restants avant la fin du consentement (négatif = expiré), ou null si on ne connaît pas la date. */
export function daysLeft(validUntil: string | null | undefined, now: Date): number | null {
  if (!validUntil) return null;
  const t = Date.parse(validUntil);
  return Number.isNaN(t) ? null : Math.ceil((t - now.getTime()) / 86_400_000);
}
