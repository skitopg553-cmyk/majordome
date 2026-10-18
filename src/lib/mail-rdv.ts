// Mails → rendez-vous. Le pré-filtre (mail-filter.ts) et la vérification de la date sont EN CODE ; Haiku ne fait qu'extraire {titre, date, heure, lieu}
// des quelques mails candidats. Rien du contenu des mails n'est gardé : seulement l'identifiant du message et ce qui a été extrait.
import type { AgendaEvent, MailHead } from "./google-api";
import { isRealDay } from "./life";
import { isAppointmentMail } from "./mail-filter";
import { addDays, parisIso } from "./task-groups";

export const DAILY_CAP = 20; // mails lus par Haiku au maximum, par jour

/** Mails à envoyer à Haiku : passent le pré-filtre, jamais déjà traités, dans la limite du quota restant du jour. */
export function selectCandidates(heads: MailHead[], known: Set<string>, remaining: number): MailHead[] {
  return heads.filter((h) => !known.has(h.id) && isAppointmentMail({ from: h.from, subject: h.subject, snippet: h.snippet }).keep).slice(0, Math.max(0, remaining));
}

export function extractionPrompt(mail: { from: string; subject: string; body: string }, today: string) {
  return {
    system: `Tu extrais un rendez-vous d'un e-mail. Réponds UNIQUEMENT par un objet JSON : {"found":true|false,"title":"…","date":"AAAA-MM-JJ","time":"HH:MM","place":"…"|null}. Nous sommes le ${today} (Paris) : convertis « mardi », « demain » en date exacte. Si le mail ne contient pas un rendez-vous précis avec une date ET une heure, réponds {"found":false}. N'invente rien.`,
    user: `Expéditeur : ${mail.from.slice(0, 120)}\nObjet : ${mail.subject.slice(0, 200)}\n\n${mail.body}`,
  };
}

export type Extracted = { title: string; start: string; place: string | null };
type Res = { ok: true; value: Extracted } | { ok: false; reason: string };

/** Réponse de Haiku → rendez-vous vérifié. La date et l'heure sont contrôlées et calculées ICI (heure de Paris), jamais crues sur parole. */
export function parseExtraction(text: string, today: string): Res {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return { ok: false, reason: "pas de JSON" };
  let o: Record<string, unknown>;
  try {
    o = JSON.parse(m[0]);
  } catch {
    return { ok: false, reason: "JSON invalide" };
  }
  if (o.found !== true) return { ok: false, reason: "aucun rendez-vous" };
  const title = typeof o.title === "string" ? o.title.replace(/\s+/g, " ").trim().slice(0, 100) : "";
  if (!title) return { ok: false, reason: "titre absent" };
  if (!isRealDay(o.date)) return { ok: false, reason: "date invalide" };
  if (o.date < today || o.date > addDays(today, 366)) return { ok: false, reason: "date passée ou trop lointaine" };
  const t = typeof o.time === "string" ? o.time.match(/^([01]?\d|2[0-3]):([0-5]\d)$/) : null;
  if (!t) return { ok: false, reason: "heure absente ou invalide" };
  const place = typeof o.place === "string" && o.place.trim() ? o.place.replace(/\s+/g, " ").trim().slice(0, 120) : null;
  return { ok: true, value: { title, start: parisIso(o.date, Number(t[1]), Number(t[2])), place } };
}

/** Un événement existe déjà à peu près au même moment (±45 min, hors événements « toute la journée ») : on ne propose rien. */
export function alreadyInAgenda(startIso: string, events: AgendaEvent[], toleranceMin = 45) {
  const s = new Date(startIso).getTime();
  return events.some((e) => !e.allDay && Math.abs(new Date(e.start).getTime() - s) <= toleranceMin * 60_000);
}
