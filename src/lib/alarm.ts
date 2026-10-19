// Réveils et minuteurs. Une app web ne peut PAS créer un réveil Android toute seule : elle prépare un lien « intent: » qui ouvre l'app Horloge
// déjà remplie, et Ruben valide d'un tap. Tout le calcul (heure du réveil, durée) est fait ici, en code : le modèle ne fait que transmettre ce que Ruben a dit.
import { parisHM } from "./planning";
import { parisDay } from "./task-groups";

type Res<T> = { ok: true; value: T } | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

/** Ce qui a été réellement calculé : la coque Android s'en sert pour régler l'Horloge sans tap, et pour dire la confirmation. */
export type CardParams = { kind: "alarm"; hour: number; minutes: number; label: string; when: string } | { kind: "timer"; seconds: number; label: string };
/** Suppression en masse demandée à l'IA : rien n'est supprimé avant que Ruben touche « Supprimer » sur la carte. */
export type BulkRequest = { scope: "all" | "period"; from?: string; to?: string; include_reminders?: boolean };
export type Card = { kind: "alarm" | "timer" | "confirm"; title: string; detail: string; url: string; params?: CardParams; bulk?: BulkRequest };
const isDayStr = (v: unknown) => v === undefined || (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v));
const isBulk = (b: unknown): b is BulkRequest => {
  const o = b as BulkRequest;
  return !!o && (o.scope === "all" || (o.scope === "period" && typeof o.from === "string" && typeof o.to === "string")) && isDayStr(o.from) && isDayStr(o.to) && (o.include_reminders === undefined || typeof o.include_reminders === "boolean");
};

const pad = (n: number) => String(n).padStart(2, "0");
const int = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null);

/** Texte du libellé : coupé, sans retours à la ligne. */
const cleanLabel = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, 60) : "");

/**
 * Réveil : soit une heure précise (hour + minutes, avec day = « tomorrow » si Ruben a dit demain), soit « dans N minutes » (in_minutes).
 * Android sonne à la PROCHAINE occurrence de l'heure : si « demain 7 h » est demandé avant 7 h, il sonnerait aujourd'hui, on le signale.
 */
export function resolveAlarm(a: Record<string, unknown>, now: Date): Res<{ hour: number; minutes: number; label: string; when: "aujourd'hui" | "demain"; warning: string | null }> {
  const label = cleanLabel(a.label);
  let hour: number;
  let minutes: number;
  let askedTomorrow = a.day === "tomorrow";
  if (a.in_minutes !== undefined && a.in_minutes !== null) {
    const n = int(a.in_minutes);
    if (n === null || n < 1 || n > 1440) return fail("in_minutes invalide : entre 1 et 1440");
    const target = new Date(now.getTime() + n * 60_000);
    ({ h: hour, m: minutes } = parisHM(target.toISOString()));
    askedTomorrow = parisDay(target) !== parisDay(now);
  } else {
    const h = int(a.hour);
    const m = a.minutes === undefined || a.minutes === null ? 0 : int(a.minutes);
    if (h === null || h < 0 || h > 23) return fail("hour invalide : entier entre 0 et 23");
    if (m === null || m < 0 || m > 59) return fail("minutes invalides : entier entre 0 et 59");
    hour = h;
    minutes = m;
  }
  // Prochaine occurrence de hour:minutes à partir de maintenant (heure de Paris).
  const cur = parisHM(now.toISOString());
  const passedToday = hour * 60 + minutes <= cur.h * 60 + cur.m;
  const when = passedToday ? "demain" : "aujourd'hui";
  const warning = askedTomorrow && when === "aujourd'hui" ? "Attention : Android sonnera aujourd'hui à cette heure (elle n'est pas encore passée), pas demain." : null;
  return { ok: true, value: { hour, minutes, label, when, warning } };
}

/** Minuteur : heures + minutes + secondes, additionnées (au moins 1 seconde, au plus 24 h). */
export function resolveTimer(a: Record<string, unknown>): Res<{ seconds: number; label: string }> {
  const parts = ["hours", "minutes", "seconds"].map((k) => (a[k] === undefined || a[k] === null ? 0 : int(a[k])));
  if (parts.some((p) => p === null || p < 0)) return fail("durée invalide : hours, minutes, seconds doivent être des nombres positifs");
  const seconds = parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
  if (seconds < 1 || seconds > 86_400) return fail("durée invalide : entre 1 seconde et 24 heures");
  return { ok: true, value: { seconds, label: cleanLabel(a.label) } };
}

// Liens « intent: » (Chrome Android). Le libellé est encodé (encodeURIComponent) pour ne pas casser le lien avec un « ; » ou un « = ».
export const alarmUrl = (hour: number, minutes: number, label: string) =>
  `intent:#Intent;action=android.intent.action.SET_ALARM;i.android.intent.extra.alarm.HOUR=${hour};i.android.intent.extra.alarm.MINUTES=${minutes};S.android.intent.extra.alarm.MESSAGE=${encodeURIComponent(label)};end`;
export const timerUrl = (seconds: number, label: string) =>
  `intent:#Intent;action=android.intent.action.SET_TIMER;i.android.intent.extra.alarm.LENGTH=${seconds};S.android.intent.extra.alarm.MESSAGE=${encodeURIComponent(label)};end`;

export const durationLabel = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h ? `${h} h` : "", m ? `${m} min` : "", s ? `${s} s` : ""].filter(Boolean).join(" ");
};

export function alarmCard(v: { hour: number; minutes: number; label: string; when: string; warning: string | null }): Card {
  return {
    kind: "alarm",
    title: "Créer le réveil",
    detail: `${pad(v.hour)}:${pad(v.minutes)} · ${v.when}${v.label ? ` · ${v.label}` : ""}${v.warning ? `\n${v.warning}` : ""}`,
    url: alarmUrl(v.hour, v.minutes, v.label),
    params: { kind: "alarm", hour: v.hour, minutes: v.minutes, label: v.label, when: v.when },
  };
}
export function timerCard(v: { seconds: number; label: string }): Card {
  return { kind: "timer", title: "Lancer le minuteur", detail: `${durationLabel(v.seconds)}${v.label ? ` · ${v.label}` : ""}`, url: timerUrl(v.seconds, v.label), params: { kind: "timer", seconds: v.seconds, label: v.label } };
}

/** Une carte reçue du serveur n'est affichée que si son lien ouvre bien l'Horloge (jamais un lien quelconque). */
export const isCard = (c: unknown): c is Card => {
  const o = c as Card;
  if (o?.kind === "confirm") return typeof o.title === "string" && typeof o.detail === "string" && o.url === "" && isBulk(o.bulk);
  const p = o?.params as Record<string, unknown> | undefined;
  const paramsOk = p === undefined || (p.kind === "alarm" ? Number.isInteger(p.hour) && Number.isInteger(p.minutes) && (p.hour as number) >= 0 && (p.hour as number) <= 23 && (p.minutes as number) >= 0 && (p.minutes as number) <= 59 && typeof p.label === "string" && typeof p.when === "string" : p.kind === "timer" && Number.isInteger(p.seconds) && (p.seconds as number) >= 1 && (p.seconds as number) <= 86_400 && typeof p.label === "string");
  return !!o && paramsOk && (o.kind === "alarm" || o.kind === "timer") && typeof o.title === "string" && typeof o.detail === "string" && typeof o.url === "string" && /^intent:#Intent;action=android\.intent\.action\.SET_(ALARM|TIMER);[^<>"\s]*;end$/.test(o.url);
};

// Cartes dans le flux du chat : derrière U+001C, après les autres éléments (comme les réglages).
export const CARDS_MARK = "\u001c";
export function splitCards(raw: string): { rest: string; cards: Card[] } {
  const i = raw.indexOf(CARDS_MARK);
  if (i === -1) return { rest: raw, cards: [] };
  let cards: Card[] = [];
  try {
    const parsed = JSON.parse(raw.slice(i + 1));
    if (Array.isArray(parsed)) cards = parsed.filter(isCard);
  } catch {
    /* flux coupé : on ignore */
  }
  return { rest: raw.slice(0, i), cards };
}
export function extractCard(raw: string): { result: string; card?: Card } {
  try {
    const o = JSON.parse(raw);
    if (o && isCard(o.card)) {
      const { card, ...rest } = o;
      return { result: JSON.stringify(rest), card };
    }
  } catch {
    /* pas du JSON */
  }
  return { result: raw };
}
