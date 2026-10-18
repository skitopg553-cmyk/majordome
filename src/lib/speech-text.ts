// Texte → texte à LIRE à voix haute. La synthèse (voix du téléphone ou voix cloud) lit ce qu'on lui donne : « 7:30 » deviendrait « sept deux-points trente »,
// un astérisque de markdown serait prononcé, un emoji aussi. Ici on nettoie en code (rien n'est confié à l'IA) :
// balise d'humeur, markdown, emojis, puis heures, dates, euros, pourcentages, unités et nombres dits en français naturel.
import { frenchDecimal, frenchNumber } from "./french-number";
import { hourWords } from "./alarm-speech";

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const num = (s: string) => Number(s.replace(/[\s .]/g, ""));
const words = (n: number) => frenchNumber(n);

const UNITS: Record<string, [string, string]> = {
  km: ["kilomètre", "kilomètres"], kg: ["kilo", "kilos"], g: ["gramme", "grammes"], kcal: ["kilocalorie", "kilocalories"], min: ["minute", "minutes"],
  ml: ["millilitre", "millilitres"], cl: ["centilitre", "centilitres"], l: ["litre", "litres"], m: ["mètre", "mètres"],
};

/** Texte d'une réponse de Majordome → phrase(s) prêtes à être prononcées. */
export function toSpokenText(raw: string): string {
  let t = raw;

  // 1. Balises et séparateurs internes du flux
  t = t.replace(/\u001f[^\u001f]*\u001f/g, "").replace(/[\u001c-\u001e]/g, "");
  t = t.replace(/^[ \t]*@mood:[^\n]*\n?/gim, "");

  // 2. Markdown
  t = t.replace(/```[\s\S]*?```/g, " ");
  t = t.replace(/`([^`]*)`/g, "$1");
  t = t.replace(/!\[[^\]]*\]\([^)]*\)/g, " ");
  t = t.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  t = t.replace(/https?:\/\/\S+/g, "le lien");
  t = t.replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, "");
  t = t.replace(/^[ \t]*>[ \t]?/gm, "");
  t = t.replace(/^[ \t]*([-*+•]|\d+[.)])[ \t]+/gm, ""); // puces : le retour à la ligne devient une pause (plus bas)
  t = t.replace(/(\*\*|__)(.*?)\1/g, "$2").replace(/(\*|_)(?=\S)(.*?)(?<=\S)\1/g, "$2");
  t = t.replace(/^[ \t]*([-*_]){3,}[ \t]*$/gm, "");

  // 3. Emojis et pictogrammes
  t = t.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{20E3}\u{1F1E6}-\u{1F1FF}]/gu, "");

  // 4. Dates « 16/10 », « 16/10/2026 » → « seize octobre »
  t = t.replace(/\b(0?[1-9]|[12]\d|3[01])\/(0?[1-9]|1[0-2])(?:\/(\d{4}))?\b/g, (_, d, m, y) => `${Number(d) === 1 ? "premier" : words(Number(d))} ${MONTHS[Number(m) - 1]}${y ? ` ${words(Number(y))}` : ""}`);
  t = t.replace(/\b1er\b/g, "premier");

  // 5. Heures « 7:30 », « 07h30 », « 7 h », « 16h51 » → « sept heures trente »
  t = t.replace(/\b([01]?\d|2[0-3])\s*(?:h|:)\s*([0-5]\d)\b/g, (_, h, m) => hourWords(Number(h), Number(m)));
  t = t.replace(/\b([01]?\d|2[0-3])\s*h\b(?!\s*[a-zà-ÿ])/gi, (_, h) => hourWords(Number(h), 0));

  // 6. Euros « 12,50 € » → « douze euros cinquante »
  t = t.replace(/(\d{1,3}(?:[\s .]\d{3})+|\d+)(?:[.,](\d{1,2}))?\s*(?:€|euros?\b)/gi, (_, whole, cents) => {
    const n = num(whole);
    const c = cents ? Number(cents.length === 1 ? `${cents}0` : cents) : 0;
    return `${words(n)} euro${n > 1 ? "s" : ""}${c ? ` ${words(c)}` : ""}`;
  });

  // 7. Pourcentages « 20 % » → « vingt pour cent »
  t = t.replace(/(\d+)(?:[.,](\d+))?\s*%/g, (_, a, b) => `${b ? frenchDecimal(Number(a), b) : words(Number(a))} pour cent`);

  // 8. Nombres avec unité « 5 km », « 20 min », « 150 g », « 2000 kcal »
  t = t.replace(/(\d{1,3}(?:[\s .]\d{3})+|\d+)(?:[.,](\d+))?\s*(km|kg|kcal|min|ml|cl|g|l|m)\b(?!\w)/gi, (_, whole, dec, unit) => {
    const n = num(whole);
    const [one, many] = UNITS[unit.toLowerCase()];
    return dec ? `${frenchDecimal(n, dec)} ${many}` : `${words(n)} ${n === 1 ? one : many}`;
  });

  // 9. Décimaux « 2,5 » puis entiers « 3 », « 2 000 », « 2026 »
  t = t.replace(/\b(\d+)[.,](\d+)\b/g, (_, a, b) => frenchDecimal(Number(a), b));
  t = t.replace(/\b\d{1,3}(?:[\s .]\d{3})+\b|\b\d+\b/g, (m) => words(num(m)));

  // 10. Symboles et ponctuation
  t = t.replace(/\s*&\s*/g, " et ").replace(/\s*[→➜➔]\s*/g, ", ").replace(/#/g, "").replace(/…/g, "...");

  // 11. Retours à la ligne = pauses ; espaces propres ; point final
  t = t.replace(/\s*\n+\s*/g, ". ").replace(/\.{2,}\s*\./g, ".").replace(/([.!?:;])\s*\.\s/g, "$1 ").replace(/\s+/g, " ").trim();
  t = t.replace(/^[.,;:!?\s]+/, "");
  if (t && !/[.!?…]$/.test(t)) t += ".";
  return t;
}

/** Découpe en phrases pour lire la 1re avant que la réponse soit finie. Une phrase trop longue est coupée aux virgules ; un fragment minuscule est collé à la suivante. */
export function splitSentences(text: string, maxLen = 240): string[] {
  const raw = text.split(/(?<=[.!?…])\s+/).map((s) => s.trim()).filter(Boolean);
  const out: string[] = [];
  for (const s of raw) {
    if (s.length <= maxLen) {
      out.push(s);
      continue;
    }
    let cur = "";
    for (const part of s.split(/(?<=[,;:])\s+/)) {
      if (cur && (cur + " " + part).length > maxLen) {
        out.push(cur);
        cur = part;
      } else cur = cur ? `${cur} ${part}` : part;
    }
    if (cur) out.push(cur);
  }
  const merged: string[] = [];
  for (const s of out) {
    if (merged.length && merged[merged.length - 1].replace(/[.!?…]/g, "").length < 4) merged[merged.length - 1] += ` ${s}`;
    else merged.push(s);
  }
  return merged;
}
