// Import d'un relevé bancaire CSV (export des banques françaises).
// Gère : séparateur « ; » ou « , », champs entre guillemets, virgule décimale (« -1 234,56 »),
// dates JJ/MM/AAAA, montant sur une colonne ou en deux colonnes Débit / Crédit.

import { fold } from "../text";

export type RawTransaction = { date: string; label: string; amount: number }; // date AAAA-MM-JJ, amount < 0 = dépense

/** Découpe une ligne CSV en respectant les guillemets ("a;b" reste un seul champ, "" = guillemet). */
export function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/** « -1 234,56 € » → -1234.56 ; « 12.50 » → 12.5. Renvoie null si illisible. */
export function parseFrenchAmount(s: string): number | null {
  let t = s.replace(/[\s  €]/g, "").replace(/^\+/, "");
  if (!t) return null;
  // Virgule décimale française ; un point éventuel est alors un séparateur de milliers.
  // Si les deux signes sont présents, le DERNIER est la décimale : « 1.234,56 » (fr) comme « 1,234.56 » (en). Virgule seule : décimale.
  const comma = t.lastIndexOf(",");
  const dot = t.lastIndexOf(".");
  if (comma !== -1 && dot !== -1) t = dot > comma ? t.replace(/,/g, "") : t.replace(/\./g, "").replace(",", ".");
  else if (comma !== -1) t = t.replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

/** « 05/10/2026 » ou « 5/10/26 » → « 2026-10-05 ». Renvoie null si ce n'est pas une date valide. */
export function parseFrenchDate(s: string): string | null {
  const m = s.trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  const year = y.length === 2 ? 2000 + Number(y) : Number(y);
  const iso = `${year}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  const check = new Date(`${iso}T12:00:00Z`);
  return check.getUTCMonth() + 1 === Number(mo) && check.getUTCDate() === Number(d) ? iso : null;
}

/** « 2026-10-05 12:30:00 » ou « 2026-10-05 » → « 2026-10-05 ». Renvoie null si ce n'est pas un vrai jour. */
export function parseIsoDate(s: string): string | null {
  const m = s.trim().match(/^(\d{4}-\d{2}-\d{2})(?:[ T]\d{2}:\d{2}(?::\d{2})?)?/);
  return m && new Date(`${m[1]}T12:00:00Z`).toISOString().slice(0, 10) === m[1] ? m[1] : null;
}

const norm = (s: string) => fold(s).trim();

/** Repère les colonnes utiles d'après l'en-tête (noms usuels des banques françaises). */
function findColumns(header: string[]) {
  const h = header.map(norm);
  const idx = (re: RegExp) => h.findIndex((x) => re.test(x));
  return {
    date: idx(/^date( (operation|op|comptable))?$|^date/),
    label: idx(/libelle|description|intitule|detail|label/),
    amount: idx(/^montant|^amount|^valeur$/),
    debit: idx(/^debit/),
    credit: idx(/^credit/),
  };
}

/**
 * Clé anti-doublon pour la réimport d'un même relevé : date|libellé|montant|n° d'occurrence dans le fichier.
 * Deux opérations identiques le même jour gardent deux clés différentes (#1, #2).
 */
export function importKeys(txs: RawTransaction[]): string[] {
  const seen = new Map<string, number>();
  return txs.map((t) => {
    const base = `${t.date}|${t.label.toLowerCase()}|${t.amount.toFixed(2)}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return `${base}|${n}`;
  });
}

export type CsvResult = { transactions: RawTransaction[]; skipped: number; error?: string; format?: "standard" | "revolut" };

/**
 * Relevé Revolut (CSV ou Excel converti) : Type, Product, Started Date, Completed Date, Description, Amount, Fee, Currency, State, Balance.
 * Date = Completed Date ; montant = Amount − Fee ; on ignore ce qui n'est pas COMPLETED (en attente, annulé, refusé)
 * et ce qui n'est pas en euros (on ne convertit rien : aucun taux inventé).
 */
function parseRevolut(rows: string[][], col: Record<"completed" | "description" | "amount" | "fee" | "currency" | "state", number>): CsvResult {
  const transactions: RawTransaction[] = [];
  let skipped = 0;
  for (const f of rows) {
    const done = (f[col.state] ?? "").trim().toUpperCase() === "COMPLETED";
    const currency = (f[col.currency] ?? "").trim().toUpperCase();
    const date = parseIsoDate(f[col.completed] ?? "");
    const label = (f[col.description] ?? "").replace(/\s+/g, " ").trim();
    const amount = parseFrenchAmount(f[col.amount] ?? "");
    const fee = col.fee === -1 ? 0 : (parseFrenchAmount(f[col.fee] ?? "") ?? 0);
    if (!done || (currency && currency !== "EUR") || !date || !label || amount === null) {
      skipped++;
      continue;
    }
    const net = Math.round((amount - fee) * 100) / 100;
    if (net === 0) {
      skipped++;
      continue;
    }
    transactions.push({ date, label, amount: net });
  }
  return { transactions, skipped, format: "revolut" };
}

export function parseBankCsv(text: string): CsvResult {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim() !== "");
  // Certaines banques mettent quelques lignes d'infos avant l'en-tête : on cherche la 1re ligne qui contient « date ».
  const headerAt = lines.findIndex((l) => /date/i.test(l));
  if (headerAt === -1) return { transactions: [], skipped: 0, error: "En-tête introuvable (aucune colonne « Date »)." };
  const headerLine = lines[headerAt];
  const sep = (headerLine.match(/;/g)?.length ?? 0) >= (headerLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const names = splitCsvLine(headerLine, sep).map(norm);
  const rv = { completed: names.indexOf("completed date"), description: names.indexOf("description"), amount: names.indexOf("amount"), fee: names.indexOf("fee"), currency: names.indexOf("currency"), state: names.indexOf("state") };
  if (rv.completed !== -1 && rv.description !== -1 && rv.amount !== -1 && rv.state !== -1) {
    return parseRevolut(lines.slice(headerAt + 1).map((l) => splitCsvLine(l, sep)), rv);
  }
  const col = findColumns(splitCsvLine(headerLine, sep));
  if (col.date === -1 || col.label === -1 || (col.amount === -1 && col.debit === -1 && col.credit === -1)) {
    return { transactions: [], skipped: 0, error: "Colonnes Date, Libellé et Montant (ou Débit/Crédit) introuvables." };
  }

  const transactions: RawTransaction[] = [];
  let skipped = 0;
  for (const line of lines.slice(headerAt + 1)) {
    const f = splitCsvLine(line, sep);
    const date = parseFrenchDate(f[col.date] ?? "");
    const label = (f[col.label] ?? "").replace(/\s+/g, " ").trim();
    let amount: number | null;
    if (col.amount !== -1) amount = parseFrenchAmount(f[col.amount] ?? "");
    else {
      // Débit souvent écrit en positif : une dépense est toujours négative chez nous.
      const debit = parseFrenchAmount(f[col.debit] ?? "");
      const credit = parseFrenchAmount(f[col.credit] ?? "");
      amount = debit ? -Math.abs(debit) : credit ? Math.abs(credit) : null;
    }
    if (!date || !label || amount === null) {
      skipped++;
      continue;
    }
    transactions.push({ date, label, amount });
  }
  return { transactions, skipped, format: "standard" };
}
