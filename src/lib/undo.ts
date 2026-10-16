// Annuler ce que l'IA vient d'écrire, et supprimer une entrée depuis un écran : mêmes règles strictes pour les deux.
// Seules les tables et colonnes listées ici peuvent être touchées : une demande mal formée est refusée, jamais devinée.

/** Colonnes qu'on a le droit de remettre à leur ancienne valeur, par table. */
export const RESTORABLE: Record<string, string[]> = {
  tasks: ["title", "due_at", "priority", "notes", "status", "done_at"],
  memories: ["content", "category"],
  savings_goals: ["label", "target", "saved", "due_label"],
  workouts: ["date", "kind", "minutes"],
  sleep_logs: ["hours"],
  steps_logs: ["steps"],
  budgets: ["monthly_limit"],
  transactions: [],
};

/** Tables dont une ligne peut être supprimée depuis l'app (toujours après confirmation). */
export const DELETABLE = Object.keys(RESTORABLE);

export type UndoStep =
  | { op: "delete"; table: string; id: number } // l'IA a créé la ligne : on la supprime
  | { op: "restore"; table: string; id: number; values: Record<string, string | number | null> } // l'IA a modifié la ligne : on remet l'ancien contenu
  | { op: "insert"; table: string; values: Record<string, string | number | null> }; // l'IA a supprimé la ligne : on la recrée (souvenirs seulement)
export type Undo = { label: string; steps: UndoStep[] };

const isId = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v > 0;
const isScalar = (v: unknown): v is string | number | null => v === null || typeof v === "string" || (typeof v === "number" && Number.isFinite(v));
const cleanValues = (table: string, v: unknown): Record<string, string | number | null> | null => {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const out: Record<string, string | number | null> = {};
  for (const [k, val] of Object.entries(v)) {
    if (!RESTORABLE[table]?.includes(k) || !isScalar(val)) return null; // colonne non autorisée ou valeur bizarre : tout est refusé
    out[k] = val;
  }
  return Object.keys(out).length ? out : null;
};

/** Valide une liste d'étapes venant du navigateur. Renvoie null au moindre doute. */
export function parseUndoSteps(input: unknown): UndoStep[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > 20) return null;
  const steps: UndoStep[] = [];
  for (const s of input) {
    if (!s || typeof s !== "object") return null;
    const { op, table, id, values } = s as Record<string, unknown>;
    if (typeof table !== "string" || !(table in RESTORABLE)) return null;
    if (op === "delete" && isId(id)) steps.push({ op, table, id });
    else if (op === "restore" && isId(id)) {
      const v = cleanValues(table, values);
      if (!v) return null;
      steps.push({ op, table, id, values: v });
    } else if (op === "insert" && table === "memories") {
      const v = cleanValues(table, values);
      if (!v) return null;
      steps.push({ op, table, values: v });
    } else return null;
  }
  return steps;
}

/** Suppression manuelle : par identifiant, ou par date pour le sommeil et les pas (une ligne par jour). */
export type DeleteRequest = { table: string; id: number } | { table: "sleep_logs" | "steps_logs"; date: string };
export function parseDeleteRequest(input: unknown): DeleteRequest | null {
  if (!input || typeof input !== "object") return null;
  const { table, id, date } = input as Record<string, unknown>;
  if (typeof table !== "string" || !DELETABLE.includes(table)) return null;
  if (isId(id)) return { table, id };
  if ((table === "sleep_logs" || table === "steps_logs") && typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) return { table, date };
  return null;
}

/** Texte du bouton : « Séance « Musculation » » pour un ajout, « 3 ajouts » pour plusieurs. */
export function undoLabel(actions: Undo[]) {
  return actions.length === 1 ? actions[0].label : `${actions.length} ajouts`;
}

/** Ce que le serveur envoie après le texte de la réponse : un séparateur de fin d'enregistrement (U+001E) puis le JSON des actions annulables. */
export const ACTIONS_MARK = "\u001e";
export function splitReply(raw: string): { text: string; actions: Undo[] } {
  const i = raw.indexOf(ACTIONS_MARK);
  if (i === -1) return { text: raw, actions: [] };
  let actions: Undo[] = [];
  try {
    const parsed = JSON.parse(raw.slice(i + 1));
    if (Array.isArray(parsed)) actions = parsed.filter((a): a is Undo => !!a && typeof a.label === "string" && parseUndoSteps(a.steps) !== null);
  } catch {
    /* trailer incomplet (flux coupé) : on ignore, le texte reste intact */
  }
  return { text: raw.slice(0, i), actions };
}

/**
 * Sépare le résultat d'un outil (JSON) de son « undo » : le modèle reçoit le résultat SANS l'undo (inutile pour lui),
 * l'écran reçoit l'undo. Un résultat qui n'est pas du JSON, ou sans undo valide, est renvoyé tel quel.
 */
export function extractUndo(raw: string): { result: string; undo?: Undo } {
  try {
    const o = JSON.parse(raw);
    if (o && typeof o === "object" && o.undo && typeof o.undo.label === "string" && parseUndoSteps(o.undo.steps)) {
      const { undo, ...rest } = o;
      return { result: JSON.stringify(rest), undo };
    }
  } catch {
    /* pas du JSON */
  }
  return { result: raw };
}
