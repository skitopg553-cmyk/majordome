// Validation de l'historique envoyé par le navigateur à /api/chat. Le navigateur n'est JAMAIS une source fiable : même avec le code d'accès,
// on n'accepte que des messages « user » / « assistant » (jamais « system » ou « tool », qui donneraient des ordres au modèle), de taille raisonnable.

export type ChatMessage = { role: "user" | "assistant"; content: string };

export const MAX_CONTENT = 8000; // caractères par message (un long texte collé est coupé, pas refusé)
export const MAX_HISTORY = 20; // messages gardés (les plus récents) : borne aussi le coût de chaque appel

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
  const recent = out.slice(-MAX_HISTORY);
  const last = recent[recent.length - 1];
  return last.role === "user" && last.content.trim() ? recent : null; // la dernière ligne est toujours une demande de Ruben, non vide
}
