// Temps d'écran : saisie (voix, capture d'écran confirmée, Tasker) et indicateur de tendance, calculés en code.
// Une PWA ne peut pas lire le temps d'écran du téléphone : la donnée vient toujours d'une saisie.
import { resolveDate } from "./life";
import { addDays } from "./task-groups";

type Res<T> = { ok: true; value: T } | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

/** « 4 h d'écran », « 2 h 30 », « 45 min » → minutes (0 à 24 h) + jour. Le total des deux champs compte. */
export function parseScreenTime(a: Record<string, unknown>, now: Date): Res<{ date: string; minutes: number }> {
  const num = (v: unknown) => (v === undefined || v === null ? 0 : typeof v === "number" && Number.isFinite(v) ? v : NaN);
  const h = num(a.hours);
  const m = num(a.minutes);
  if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || m < 0) return fail("hours / minutes invalides : nombres positifs");
  if (a.hours == null && a.minutes == null) return fail("donne hours et/ou minutes (ex. hours: 4)");
  const minutes = Math.round(h * 60 + m);
  if (minutes > 1440) return fail("plus de 24 h dans une journée : vérifie avec Ruben");
  const date = resolveDate(a.date, now);
  return date.ok ? { ok: true, value: { date: date.value, minutes } } : date;
}

export const minutesLabel = (min: number) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h === 0 ? `${m} min` : m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
};

export type ScreenRow = { date: string; minutes: number };
export type ScreenTrend = { current: number; previous: number; pct: number; direction: "down" | "up" | "flat"; label: string };

const avg = (rows: ScreenRow[]) => rows.reduce((s, r) => s + r.minutes, 0) / rows.length;

/**
 * Moyenne des 7 derniers jours (aujourd'hui compris) comparée aux 7 précédents, sur les jours renseignés.
 * Null s'il manque des données d'un côté. Baisser est positif : « −18 % vs semaine dernière ».
 */
export function screenTrend(rows: ScreenRow[], today: string): ScreenTrend | null {
  const cur = rows.filter((r) => r.date <= today && r.date > addDays(today, -7));
  const prev = rows.filter((r) => r.date <= addDays(today, -7) && r.date > addDays(today, -14));
  if (!cur.length || !prev.length) return null;
  const current = Math.round(avg(cur));
  const previous = Math.round(avg(prev));
  if (previous === 0) return null;
  const pct = Math.round(((current - previous) / previous) * 100);
  const direction = pct < 0 ? "down" : pct > 0 ? "up" : "flat";
  const label = pct === 0 ? "stable vs semaine dernière" : `${pct < 0 ? "−" : "+"}${Math.abs(pct)} % vs semaine dernière`;
  return { current, previous, pct, direction, label };
}

/** Image envoyée pour lecture : seulement png/jpeg/webp en data URL, 3 Mo maximum (la limite d'une requête Vercel est de 4,5 Mo). */
export function validImage(v: unknown): string | null {
  return typeof v === "string" && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v) && v.length <= 3_000_000 ? v : null;
}
