// Filet de sécurité de l'agent : certaines phrases sont des ORDRES sans ambiguïté (« retiens que… », « mon objectif est… »).
// Le code les reconnaît et appelle l'outil lui-même, AVANT le modèle : l'enregistrement ne dépend plus du bon vouloir de l'IA.
// Raison : l'IA avait répondu « j'ai noté ton objectif » sans appeler aucun outil (table vide ensuite). Tout reste annulable (bouton « Annuler »).
// Seuls les cas clairs sont traités ; le reste (« je veux… », phrases floues) est laissé au modèle, guidé par ses consignes.
import { fold } from "./text";

export type Intent =
  | { tool: "remember"; args: { content: string; category: "objectif" | "preference" | "habitude" | "info" } }
  | { tool: "set_goal"; args: { label: string; target: number; saved?: number } };

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const EFFORT_WORDS = /\b(km|min|minutes?|course|courir|running|pas|steps?|kg|kilos?|seances?)\b/i; // un « 5k » dans une phrase de sport n'est pas de l'argent
const NOT_MONEY_AFTER = /^\s*(pas|steps?|km|kilos?|kg|min|minutes?|h\b|heures?|seances?|reps?|pompes)/i; // « 10k pas », « 5k » (course) : pas de l'argent

/** Tous les montants en euros d'un texte, dans l'ordre : « 3k », « 3 000 € », « 3.000 euros », « 1 500,50 € ». Sans unité € / euros / k : ignoré. */
export function amounts(text: string): { value: number; index: number }[] {
  const out: { value: number; index: number }[] = [];
  const re = /(\d{1,3}(?:[   .]\d{3})+|\d+)(?:[.,](\d{1,2}))?\s*(k\b|€|eur(?:os?)?\b)/gi;
  for (let m; (m = re.exec(text)); ) {
    if (m[3].toLowerCase() === "k" && (NOT_MONEY_AFTER.test(text.slice(m.index + m[0].length)) || EFFORT_WORDS.test(text))) continue;
    const whole = Number(m[1].replace(/[   .]/g, ""));
    const value = (whole + (m[2] ? Number(`0.${m[2]}`) : 0)) * (m[3].toLowerCase() === "k" ? 1000 : 1);
    if (Number.isFinite(value) && value > 0) out.push({ value: Math.round(value * 100) / 100, index: m.index });
  }
  return out;
}

/** Nom de l'objectif : ce qui suit « pour » (« pour une voiture » → « Voiture »), sinon « Épargne ». */
function goalLabel(text: string): string {
  const m = text.match(/\bpour\s+(?:(?:une|un|le|la|mon|ma|mes|des|du)\s+|l['’]\s*)?([^.!?\n]+)/i);
  const raw = m?.[1]?.split(/\s+(?:et|mais)\s+|,\s*|\s+j['’]ai\b/i)[0]?.trim().replace(/['’]\s*$/, "");
  return raw ? cap(raw.slice(0, 80)) : "Épargne";
}

const MEMORY_CMD = /^(?:stp\s+|s['’]il te pla[iî]t\s+)?(?:retiens|m[ée]morise|souviens[- ]toi|n['’]oublie pas|note bien|garde en m[ée]moire)\s*(?:bien\s+)?(?:que\s+|qu['’]\s*|de\s+|d['’]\s*)?(.+)$/is;
const GOAL_NO_MONEY = /(?:\b(?:mon|un|notre)\s+objectif\s+(?:est|c['’]est|serait)\s*:?\s*|^objectif\s*:\s*)(?:de\s+|d['’]\s*)?(.+)$/is;

function memoryCategory(content: string): "objectif" | "preference" | "habitude" | "info" {
  const f = fold(content);
  if (/\b(objectif|je veux|je voudrais)\b/.test(f)) return "objectif";
  if (/\b(j'aime|jaime|je prefere|je deteste|je n'aime pas|prefere)\b/.test(f)) return "preference";
  if (/\b(toujours|chaque|tous les|d'habitude|le matin|le soir)\b/.test(f)) return "habitude";
  return "info";
}

/** Les ordres explicites d'un message (au plus un). Tableau vide = rien de sûr : on laisse le modèle décider. */
export function detectIntents(text: string): Intent[] {
  const t = text.trim();
  if (!t || t.length > 600) return [];
  const f = fold(t);
  const money = amounts(t);

  // 1) Objectif d'épargne chiffré : le mot « objectif » (ou « je veux économiser / épargner ») + un montant en euros.
  const wantsToSave = /\b(je veux|je voudrais|je souhaite|j'aimerais|je vais|je compte)\b.{0,30}\b(economis\w*|epargn\w*|mettre de cote)/.test(f);
  if (money.length && (/\bobjectif\b/.test(f) || wantsToSave) && !/\bbudget\b/.test(f)) {
    const savedAt = money.find((a) => /d[ée]j[àa]/i.test(t.slice(Math.max(0, a.index - 25), a.index)));
    const target = money.find((a) => a !== savedAt);
    if (target) return [{ tool: "set_goal", args: { label: goalLabel(t), target: target.value, ...(savedAt ? { saved: savedAt.value } : {}) } }];
  }

  // 2) Ordre de mémoriser : « retiens que… », « n'oublie pas que… ».
  const cmd = t.match(MEMORY_CMD)?.[1]?.trim();
  if (cmd && cmd.length >= 3 && cmd.length <= 300 && !/^(que|qu['’]|de|d['’])$/i.test(cmd)) return [{ tool: "remember", args: { content: cap(cmd), category: memoryCategory(cmd) } }];

  // 3) Objectif sans montant : « mon objectif est de courir un semi-marathon » → souvenir de catégorie « objectif ».
  const goal = t.match(GOAL_NO_MONEY)?.[1]?.trim();
  if (goal && goal.length >= 3 && goal.length <= 300 && !money.length) return [{ tool: "remember", args: { content: cap(goal), category: "objectif" } }];

  return [];
}

/** Exécute les ordres explicites (via `exec`, l'exécuteur d'outils habituel) et renvoie des lignes à glisser dans le contexte du modèle. */
export async function applyIntents(text: string, exec: (name: string, args: Record<string, unknown>) => Promise<string>): Promise<string[]> {
  const notes: string[] = [];
  for (const it of detectIntents(text)) {
    let res: { ok?: boolean; error?: string; saved?: { label?: string; target?: number; saved?: number | null }; action?: string } = {};
    try {
      res = JSON.parse(await exec(it.tool, it.args));
    } catch {
      /* résultat illisible : traité comme un échec ci-dessous */
    }
    if (!res.ok) notes.push(`Échec de « ${it.tool} » : ${res.error ?? "résultat illisible"}. Dis-le honnêtement à Ruben.`);
    else if (it.tool === "set_goal") notes.push(`Objectif « ${it.args.label} » ${res.action ?? "enregistré"} : ${it.args.target} €${it.args.saved !== undefined ? `, déjà ${it.args.saved} € de côté` : ""}.`);
    else notes.push(`Souvenir noté (${(it.args as { category: string }).category}) : « ${(it.args as { content: string }).content} ».`);
  }
  return notes;
}

/**
 * Vrai si la réponse prétend avoir enregistré quelque chose alors qu'AUCUN outil n'a été appelé dans ce message.
 * (Constaté en vrai : « J'ai noté ton objectif » sans rien d'enregistré.) Les phrases de constat (« c'est déjà noté ») ne comptent pas :
 * elles peuvent être vraies grâce au contexte.
 */
export function claimsActionWithoutTool(reply: string, toolCalls: number): boolean {
  if (toolCalls > 0) return false;
  return /\b(?:j'ai|c'est|je viens d(?:e\s+|'))\s*(?:bien\s+|maintenant\s+)?(?:note|ajout\w*|cree|enregistr\w*|memoris\w*|mis a jour|marque|programme|retenu|supprim\w*|modifi\w*|deplac\w*|efface)\b|\btout est (?:maintenant\s+)?(?:supprim|efface|vide|note|en place|fait)/.test(fold(reply).replace(/[’]/g, "'"));
}

export const FALSE_CLAIM_WARNING = "\n\n⚠️ Pardonnez-moi, Monsieur : je n'ai en fait rien enregistré cette fois. Veuillez me le redire pour que je le note vraiment.";
