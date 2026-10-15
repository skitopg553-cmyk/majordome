// Phrase de résumé du jour sur l'Accueil, calculée en code à partir des vraies tâches.

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;

export function daySummary(today: number, late: number) {
  if (today === 0 && late === 0) return "Rien d'urgent aujourd'hui. Profite.";
  if (today === 0) return `Rien de prévu aujourd'hui, mais ${plural(late, "tâche")} en retard.`;
  return `Tu as ${plural(today, "tâche")} aujourd'hui${late ? `, et ${late} en retard` : ""}.`;
}
