// Excel (.xlsx) → texte CSV, pour réutiliser tout le lecteur de relevés (csv.ts) : un seul chemin pour CSV et Excel.
// Le fichier est lu dans le navigateur (jamais envoyé tel quel) ; la bibliothèque n'est chargée qu'à l'import d'un .xlsx.

export type Cell = string | number | boolean | Date | null | undefined;

const pad = (n: number) => String(n).padStart(2, "0");

/** Date Excel → « AAAA-MM-JJ HH:MM:SS ». Excel n'a pas de fuseau : la lecture donne une date en UTC, on la relit en UTC. */
const dateText = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;

function cellText(c: Cell): string {
  if (c === null || c === undefined) return "";
  const t = c instanceof Date ? (Number.isNaN(c.getTime()) ? "" : dateText(c)) : String(c);
  // Un retour à la ligne dans une cellule casserait la lecture ligne par ligne : on le remplace par un espace.
  const flat = t.replace(/[\r\n]+/g, " ");
  return /[",;]/.test(flat) ? `"${flat.replace(/"/g, '""')}"` : flat;
}

/** Lignes de la feuille → CSV à virgules. Les nombres gardent leur point décimal (« -12.5 »), comme dans l'export CSV de Revolut. */
export function rowsToCsv(rows: Cell[][]): string {
  return rows.map((r) => r.map(cellText).join(",")).join("\n");
}

/** Lit la 1re feuille d'un fichier .xlsx (navigateur) et la renvoie en CSV. */
export async function xlsxFileToCsv(file: File): Promise<string> {
  const { readSheet } = await import("read-excel-file/browser");
  return rowsToCsv((await readSheet(file)) as Cell[][]);
}
