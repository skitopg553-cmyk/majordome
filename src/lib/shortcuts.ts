// Raccourcis Android (manifest « shortcuts ») : /?action=parler | tache | depense. Les valeurs inconnues sont ignorées.
export type Shortcut = { chat: true; prefill: string };

const ACTIONS: Record<string, string> = { parler: "", tache: "Ajoutez une tâche : ", depense: "J'ai dépensé " };

export function shortcutFromSearch(search: string): Shortcut | null {
  const a = new URLSearchParams(search).get("action");
  return a && Object.hasOwn(ACTIONS, a) ? { chat: true, prefill: ACTIONS[a] } : null;
}

/** Fichier partagé depuis une autre appli (cible de partage) : seulement un relevé CSV ou Excel. */
export const isStatement = (name: string, type: string) => /\.(csv|xlsx)$/i.test(name) || /^(text\/csv|application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet)$/.test(type);
