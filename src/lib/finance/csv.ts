// Import d'un relevé bancaire CSV (export des banques françaises).
// Gère : séparateur « ; » ou « , », champs entre guillemets, virgule décimale (« -1 234,56 »),
// dates JJ/MM/AAAA, montant sur une colonne ou en deux colonnes Débit / Crédit.

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
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
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

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

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

export type CsvResult = { transactions: RawTransaction[]; skipped: number; error?: string };

export function parseBankCsv(text: string): CsvResult {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim() !== "");
  // Certaines banques mettent quelques lignes d'infos avant l'en-tête : on cherche la 1re ligne qui contient « date ».
  const headerAt = lines.findIndex((l) => /date/i.test(l));
  if (headerAt === -1) return { transactions: [], skipped: 0, error: "En-tête introuvable (aucune colonne « Date »)." };
  const headerLine = lines[headerAt];
  const sep = (headerLine.match(/;/g)?.length ?? 0) >= (headerLine.match(/,/g)?.length ?? 0) ? ";" : ",";
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
  return { transactions, skipped };
}
