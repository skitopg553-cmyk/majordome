// Sommeil : durée calculée en CODE à partir de l'heure de coucher et de lever, et habitudes (médiane des dernières nuits) pour pré-remplir la carte du matin.

const toMin = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));
const fromMin = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const isHm = (v: unknown): v is string => typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

export const DEFAULT_BED = "23:00";
export const DEFAULT_WAKE = "07:00";

/** Heures de sommeil entre le coucher et le lever (la nuit passe minuit : 23:30 → 07:00 = 7,5 h). Null si les heures sont invalides, égales, ou si la durée sort de 1 h – 16 h. */
export function sleepHours(bed: unknown, wake: unknown): number | null {
  if (!isHm(bed) || !isHm(wake)) return null;
  const d = (toMin(wake) - toMin(bed) + 1440) % 1440;
  return d >= 60 && d <= 960 ? Math.round((d / 60) * 100) / 100 : null;
}

/** Décale une heure « HH:MM » de `delta` minutes (modulo 24 h) : pour les boutons − / + de la carte. */
export const shiftHm = (hm: string, delta: number) => fromMin((((toMin(hm) + delta) % 1440) + 1440) % 1440);

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const round15 = (m: number) => Math.round(m / 15) * 15;

/**
 * Habitudes de sommeil : médiane des heures de coucher et de lever des 14 dernières nuits connues, arrondies au quart d'heure.
 * Les couchers après minuit (00:30) sont comptés après 23:00 (et non avant 07:00). Sans nuit connue : 23:00 → 07:00.
 */
export function sleepHabit(sleeps: { date: string; bed_time?: string | null; wake_time?: string | null }[]): { bed: string; wake: string } {
  const recent = sleeps.filter((s) => isHm(s.bed_time) && isHm(s.wake_time)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 14);
  if (!recent.length) return { bed: DEFAULT_BED, wake: DEFAULT_WAKE };
  const bed = recent.map((s) => { const m = toMin(s.bed_time!); return m < 12 * 60 ? m + 1440 : m; }); // 00:30 → 24:30
  const wake = recent.map((s) => toMin(s.wake_time!));
  return { bed: fromMin(round15(median(bed)) % 1440), wake: fromMin(round15(median(wake)) % 1440) };
}

export const QUALITIES = [
  { value: 1, label: "Mal" },
  { value: 2, label: "Moyen" },
  { value: 3, label: "Bien" },
] as const;
