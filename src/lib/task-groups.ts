// Regroupement des tâches par échéance, calculé en code sur le calendrier de Paris.

export const GROUPS = ["En retard", "Aujourd'hui", "Demain", "Plus tard", "Sans date"] as const;
export type Group = (typeof GROUPS)[number];

/** Jour civil à Paris au format AAAA-MM-JJ (en-CA donne directement ce format). */
export const parisDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });

/** Libellé d'un jour (AAAA-MM-JJ) : « Aujourd'hui », « Demain » ou « samedi 17 octobre ». */
export function dayLabel(day: string, now: Date) {
  const today = parisDay(now);
  const noon = (d: string) => new Date(`${d}T12:00:00Z`).getTime();
  const diff = Math.round((noon(day) - noon(today)) / 86_400_000);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return "Demain";
  return new Date(noon(day)).toLocaleDateString("fr-FR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
}

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
