// Regroupement des tâches par échéance, calculé en code sur le calendrier de Paris.

export const GROUPS = ["En retard", "Aujourd'hui", "Demain", "Plus tard", "Sans date"] as const;
export type Group = (typeof GROUPS)[number];

/** Jour civil à Paris au format AAAA-MM-JJ (en-CA donne directement ce format). */
const parisDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });

export function groupOf(dueAt: string | null, now: Date): Group {
  if (!dueAt) return "Sans date";
  const due = new Date(dueAt);
  if (due < now) return "En retard";
  const today = parisDay(now);
  // Midi UTC du jour suivant : évite les pièges du changement d'heure.
  const tomorrow = new Date(new Date(`${today}T12:00:00Z`).getTime() + 86_400_000).toISOString().slice(0, 10);
  const day = parisDay(due);
  if (day === today) return "Aujourd'hui";
  if (day === tomorrow) return "Demain";
  return "Plus tard";
}
