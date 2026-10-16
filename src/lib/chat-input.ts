// Validation de l'historique envoyé par le navigateur à /api/chat. Le navigateur n'est JAMAIS une source fiable : même avec le code d'accès,
// on n'accepte que des messages « user » / « assistant » (jamais « system » ou « tool », qui donneraient des ordres au modèle), de taille raisonnable.

import { FALSE_CLAIM_WARNING } from "./intents";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export const MAX_CONTENT = 8000; // caractères par message (un long texte collé est coupé, pas refusé)
export const MAX_HISTORY = 12; // messages gardés (les plus récents) : borne aussi le coût de chaque appel (20 avant le 16/10 : voir docs/etat.md)
export const KEEP_FULL = 4; // les plus récents sont envoyés en entier ; avant, seules les réponses de Majordome sont raccourcies
export const CLIP_REPLY = 400; // caractères gardés d'une ancienne réponse (le détail ne sert plus au modèle)

/** Renvoie l'historique nettoyé, ou null si la demande est invalide (→ erreur 400). */
export function sanitizeMessages(input: unknown): ChatMessage[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > 200) return null;
  const out: ChatMessage[] = [];
  for (const m of input) {
    if (!m || typeof m !== "object") return null;
    const { role, content } = m as Record<string, unknown>;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") return null;
    out.push({ role, content: content.slice(0, MAX_CONTENT) });
  }
  const recent = trimHistory(out);
  const last = recent[recent.length - 1];
  return last.role === "user" && last.content.trim() ? recent : null; // la dernière ligne est toujours une demande de Ruben, non vide
}

/**
 * Historique envoyé au modèle : les MAX_HISTORY derniers messages ; les anciennes réponses de Majordome (hors KEEP_FULL derniers messages)
 * sont raccourcies à CLIP_REPLY caractères. Les messages de Ruben ne sont jamais coupés ; l'alerte « faux enregistrement » est conservée.
 */
export function trimHistory(messages: ChatMessage[], max = MAX_HISTORY, keepFull = KEEP_FULL, clip = CLIP_REPLY): ChatMessage[] {
  const recent = messages.slice(-max);
  return recent.map((m, i) => {
    if (m.role !== "assistant" || i >= recent.length - keepFull || m.content.length <= clip) return m;
    const warned = m.content.includes(FALSE_CLAIM_WARNING);
    const head = m.content.replace(FALSE_CLAIM_WARNING, "");
    return { ...m, content: (head.length > clip ? head.slice(0, clip).trimEnd() + "…" : head) + (warned ? FALSE_CLAIM_WARNING : "") };
  });
}
