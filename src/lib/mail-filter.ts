// Phase 2 : pré-filtre des mails EN CODE, avant toute IA.
// But : ne garder que les mails qui parlent probablement d'un rendez-vous (ou d'une demande de RDV),
// pour que Haiku n'en lise qu'une poignée par jour. Testé sur 20 exemples fictifs (mail-filter.test.ts).

export type MailMeta = { from: string; subject: string; snippet?: string; hasIcs?: boolean };

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

// Expéditeurs qui n'envoient presque que des RDV / réservations.
const RDV_SENDERS = ["doctolib", "calendar-notification@google.com", "calendly", "planity", "maiia", "thefork", "lafourchette", "zenchef", "outlook calendar", "ticketmaster"];

// Signaux forts (un seul suffit).
const STRONG = [
  /\brendez[- ]vous\b/,
  /\brdv\b/,
  /\binvitation\s*:/,
  /\bconfirmation de (votre|ta) (reservation|rendez)/,
  /\breservation confirmee\b/,
  /\bvotre reservation\b/,
  /\b(annulation|report) de (votre|ton|notre) (rdv|rendez-vous|reservation|creneau)\b/,
];

// Signaux faibles (il en faut deux, ou un + une date/heure).
const WEAK = [/\bcreneau\b/, /\bdispo(nible|nibilites)?\b/, /\bse voir\b/, /\bon se cale\b/, /\breunion\b/, /\bvisio\b/, /\bappel\b/, /\brappel\b/, /\bentretien\b/, /\bseance\b/];

// Date ou heure en français : « le 12/10 », « mardi 14 h », « 10h30 », « jeudi prochain ».
const WHEN = /\b(\d{1,2}[/.]\d{1,2}|\d{1,2} ?h ?\d{0,2}|(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)( prochain)?|demain|apres-demain)\b/;

// Bruit : promos et newsletters (sauf si un signal fort est présent).
const NOISE = [/\bpromo(tion)?s?\b/, /\bsoldes\b/, /-\d{1,2} ?%/, /\bnewsletter\b/, /\bse desabonner\b/, /\bunsubscribe\b/, /\boffre (speciale|exclusive)\b/, /\bcode promo\b/];

export type FilterResult = { keep: boolean; reasons: string[] };

export function isAppointmentMail(m: MailMeta): FilterResult {
  const from = norm(m.from);
  const text = norm(`${m.subject} ${m.snippet ?? ""}`);
  const reasons: string[] = [];

  if (m.hasIcs) reasons.push("pièce jointe agenda (.ics)");
  if (RDV_SENDERS.some((s) => from.includes(s))) reasons.push("expéditeur de rendez-vous");
  if (STRONG.some((r) => r.test(text))) reasons.push("mot-clé de rendez-vous");
  const strong = reasons.length > 0;

  const weak = WEAK.filter((r) => r.test(text)).length;
  const when = WHEN.test(text);
  if (!strong && (weak >= 2 || (weak >= 1 && when))) reasons.push("demande de créneau avec date ou heure");

  if (!strong && NOISE.some((r) => r.test(text))) return { keep: false, reasons: ["promo ou newsletter"] };
  return { keep: reasons.length > 0, reasons };
}
