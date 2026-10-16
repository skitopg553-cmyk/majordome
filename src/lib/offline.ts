// Hors ligne : reconnaître une panne de réseau, la dire simplement, et garder en file les ajouts de tâches pour les rejouer au retour du réseau.

/** Vrai pour une vraie panne de réseau (fetch jette un TypeError), pas pour une réponse d'erreur du serveur. */
export const isNetworkError = (e: unknown) => e instanceof TypeError || (typeof navigator !== "undefined" && navigator.onLine === false);

/** Message lisible pour Ruben, jamais un texte technique brut. */
export function friendlyError(e: unknown, fallback = "Quelque chose n'a pas marché. Réessaie dans un instant.") {
  if (isNetworkError(e)) return "Pas de réseau. Ton message est gardé et part dès que la connexion revient.";
  const msg = e instanceof Error ? e.message : "";
  if (/\b(429|529|overloaded|rate.?limit)\b/i.test(msg)) return "L'IA est très sollicitée, réessaie dans une minute.";
  if (/\b(500|502|503|504)\b/.test(msg) || /^Erreur serveur/.test(msg)) return "Le serveur ne répond pas bien pour l'instant. Réessaie dans un instant.";
  return msg && !/^(Failed to fetch|NetworkError|Load failed)/i.test(msg) ? msg : fallback;
}

// ---- File d'attente d'ajouts de tâches (localStorage) ----
export type QueuedTask = { title: string; due_at: string | null; priority: number };
export const QUEUE_KEY = "majordome-file-attente";
type Store = Pick<Storage, "getItem" | "setItem">;

export function readQueue(store: Store): QueuedTask[] {
  try {
    const v = JSON.parse(store.getItem(QUEUE_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((t) => t && typeof t.title === "string" && t.title.trim()) : [];
  } catch {
    return [];
  }
}
export function enqueue(store: Store, task: QueuedTask) {
  try {
    store.setItem(QUEUE_KEY, JSON.stringify([...readQueue(store), task].slice(-50))); // 50 au plus : la file ne grossit pas sans fin
  } catch {
    /* stockage plein ou bloqué : tant pis, la tâche reste affichée jusqu'au rechargement */
  }
}

/**
 * Rejoue la file dans l'ordre. `send` renvoie "ok" (envoyée), "retry" (réseau toujours coupé : on s'arrête, on garde le reste) ou "drop"
 * (le serveur refuse cette tâche : on la jette, sinon elle bloquerait la file pour toujours). Renvoie le nombre de tâches envoyées.
 */
export async function drainQueue(store: Store, send: (t: QueuedTask) => Promise<"ok" | "retry" | "drop">) {
  const queue = readQueue(store);
  let sent = 0;
  while (queue.length) {
    const r = await send(queue[0]);
    if (r === "retry") break;
    queue.shift();
    if (r === "ok") sent++;
  }
  try {
    store.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    /* ignoré */
  }
  return sent;
}
