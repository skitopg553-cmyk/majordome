// Nombres en toutes lettres (sortie : « sept heures trente », « vingt et une heures ») et nombres écrits en lettres lus dans une phrase (entrée : « sept heures »).
// Pur et testé : sert à la confirmation vocale des réveils et au nettoyage du texte avant lecture à voix haute.
import { fold } from "./text";

const UNITS = ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"];
const TENS = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante"];

/** 0 à 99 (règles françaises : « vingt et un », « soixante et onze », « quatre-vingts », « quatre-vingt-dix-sept »). */
function below100(n: number): string {
  if (n < 20) return UNITS[n];
  const t = Math.floor(n / 10);
  const u = n % 10;
  if (t === 7 || t === 9) {
    const base = t === 7 ? "soixante" : "quatre-vingt";
    const rest = n - (t - 1) * 10; // 10 à 19
    return t === 7 && rest === 11 ? "soixante et onze" : `${base}-${UNITS[rest]}`;
  }
  if (t === 8) return u === 0 ? "quatre-vingts" : `quatre-vingt-${UNITS[u]}`;
  if (u === 0) return TENS[t];
  return u === 1 ? `${TENS[t]} et un` : `${TENS[t]}-${UNITS[u]}`;
}

function below1000(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  if (h === 0) return below100(r);
  const head = h === 1 ? "cent" : `${UNITS[h]} cent`;
  if (r === 0) return h === 1 ? head : `${head}s`;
  return `${head} ${below100(r)}`;
}

/** Entier de 0 à 999 999 999 en toutes lettres. Au-delà ou non entier : les chiffres tels quels. */
export function frenchNumber(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 999_999_999) return String(n);
  if (n < 1000) return below1000(n);
  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;
  const parts: string[] = [];
  if (millions) parts.push(millions === 1 ? "un million" : `${below1000(millions)} millions`);
  if (thousands) parts.push(thousands === 1 ? "mille" : `${below1000(thousands)} mille`);
  if (rest) parts.push(below1000(rest));
  return parts.join(" ");
}

/** Nombre décimal à la française : 2,5 → « deux virgule cinq ». */
export function frenchDecimal(whole: number, fraction: string): string {
  return `${frenchNumber(whole)} virgule ${fraction.split("").map((d) => UNITS[Number(d)]).join(" ")}`;
}

// ---------- Lecture : « sept », « vingt-cinq », « trente et un » → nombre (0 à 99) ----------

const WORD_VALUES = new Map<string, number>([
  ...UNITS.map((w, i) => [fold(w).replace(/-/g, " "), i] as [string, number]),
  ["vingt", 20], ["trente", 30], ["quarante", 40], ["cinquante", 50], ["soixante", 60],
]);

/** « sept » → 7, « vingt-cinq » / « vingt cinq » → 25, « trente et un » → 31, « soixante-dix » → 70, « quatre-vingt-dix » → 90. Sinon null. */
export function parseNumberWords(text: string): number | null {
  const t = fold(text).replace(/-/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return null;
  if (/^\d+$/.test(t)) return Number(t);
  if (WORD_VALUES.has(t)) return WORD_VALUES.get(t)!;
  const mAnd = t.match(/^(vingt|trente|quarante|cinquante|soixante) et (un|onze)$/);
  if (mAnd) return WORD_VALUES.get(mAnd[1])! + (mAnd[2] === "un" ? 1 : 11);
  const m = t.match(/^(vingt|trente|quarante|cinquante|soixante|quatre vingts|quatre vingt) ?(.*)$/);
  if (m) {
    const base = m[1].startsWith("quatre") ? 80 : WORD_VALUES.get(m[1])!;
    if (!m[2]) return base;
    const rest = WORD_VALUES.get(m[2]);
    if (rest === undefined) return null;
    if (base === 60 && rest >= 10 && rest <= 19) return 60 + rest; // soixante-dix… soixante-dix-neuf
    if (base === 80 && rest >= 10 && rest <= 19) return 80 + rest; // quatre-vingt-dix…
    return rest < 10 ? base + rest : null;
  }
  return null;
}
