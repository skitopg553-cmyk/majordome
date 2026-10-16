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

/** Les 7 jours à partir d'aujourd'hui (AAAA-MM-JJ), pour la vue semaine. */
export const nextDays = (now: Date, n = 7) => Array.from({ length: n }, (_, i) => addDays(parisDay(now), i));

export function groupOf(dueAt: string | null, now: Date): Group {
  if (!dueAt) return "Sans date";
  const due = new Date(dueAt);
  if (due < now) return "En retard";
  const today = parisDay(now);
  const tomorrow = addDays(today, 1);
  const day = parisDay(due);
  if (day === today) return "Aujourd'hui";
  if (day === tomorrow) return "Demain";
  return "Plus tard";
}
