// Catégorisation des opérations : d'abord des règles en code (gratuit, instantané),
// puis Haiku uniquement pour les libellés qu'aucune règle ne reconnaît (architecture : niveau 0 avant niveau 1).
import { fold } from "../text";
import config from "./categories.json";

export type Rule = { category: string; keywords: string[] };

export const RULES: Rule[] = config.rules;
export const CATEGORIES = [...new Set(RULES.map((r) => r.category)), "Autre"];

/** Libellé bancaire normalisé : minuscules, sans accents, espaces simples (avec un espace final pour les mots-clés « bar »). */
const norm = (s: string) => ` ${fold(s).replace(/\s+/g, " ").trim()} `;

/** Catégorie par règles, ou null si le libellé est ambigu (aucune règle). */
export function categorizeByRules(label: string, rules: Rule[] = RULES): string | null {
  const l = norm(label);
  for (const r of rules) if (r.keywords.some((k) => l.includes(k))) return r.category;
  return null;
}

/**
 * Prompt Haiku pour les cas ambigus : une ligne par libellé, réponse JSON stricte.
 * Gardé ici (et pas dans la route) pour être testé.
 */
export function ambiguousPrompt(labels: string[]) {
  return `Classe chaque libellé d'opération bancaire française dans UNE de ces catégories : ${CATEGORIES.join(", ")}.
Réponds UNIQUEMENT par un tableau JSON de chaînes, dans le même ordre, sans texte autour.
Libellés :
${labels.map((l, i) => `${i + 1}. ${l}`).join("\n")}`;
}

/** Lit la réponse de Haiku ; toute catégorie inconnue ou réponse illisible devient « Autre ». */
export function parseAmbiguousReply(reply: string, count: number): string[] {
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(reply.slice(reply.indexOf("["), reply.lastIndexOf("]") + 1));
  } catch {
    /* réponse illisible */
  }
  const arr = Array.isArray(parsed) ? parsed : [];
  return Array.from({ length: count }, (_, i) => (typeof arr[i] === "string" && CATEGORIES.includes(arr[i]) ? arr[i] : "Autre"));
}
