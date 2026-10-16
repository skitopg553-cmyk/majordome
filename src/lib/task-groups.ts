// Calendrier de Paris : jours, ajout de jours, échéances (l’ancien regroupement par échéance a été remplacé par src/lib/planning.ts).

/** Jour civil à Paris au format AAAA-MM-JJ (en-CA donne directement ce format). */
export const parisDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });

/** Jour suivant / décalé de n jours (AAAA-MM-JJ), sans piège de changement d'heure. */
export const addDays = (day: string, n: number) => new Date(new Date(`${day}T12:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);

/** Instant ISO correspondant à « day hh:mm » heure de Paris (gère l'heure d'été / d'hiver). */
// shortcut: le décalage est lu à l'heure UTC « devinée » ; faux d'1 h seulement pour 0 h–3 h la nuit du changement d'heure, à affiner si besoin.
export function parisIso(day: string, hh: number, mm: number) {
  const guess = new Date(`${day}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00Z`);
  const offset = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Paris", timeZoneName: "longOffset" })
    .formatToParts(guess)
    .find((p) => p.type === "timeZoneName")!
    .value.replace("GMT", ""); // « +02:00 »
  return new Date(`${day}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00${offset || "+00:00"}`).toISOString();
}

/** « Reporter à demain » : même heure demain (heure de Paris) ; sans échéance → demain à 00:00 (une tâche reste une tâche, pas un rendez-vous). */
export function postponeToTomorrow(dueAt: string | null, now: Date) {
  const tomorrow = addDays(parisDay(now), 1);
  if (!dueAt) return parisIso(tomorrow, 0, 0);
  const [hh, mm] = new Date(dueAt)
    .toLocaleTimeString("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .split(":")
    .map(Number);
  return parisIso(tomorrow, hh, mm);
}
