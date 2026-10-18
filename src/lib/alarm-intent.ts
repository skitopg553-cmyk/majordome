// Réveils et minuteurs reconnus EN CODE dans la phrase de Ruben, avant le modèle (comme pour « retiens que… » dans intents.ts).
// Raison (constat du 18/10 sur la vraie base) : le modèle répondait « Touche le bouton pour le créer » sans toujours appeler l'outil, donc sans carte.
// Ici, une phrase claire (« mets un réveil à 7 h demain », « minuteur de 5 minutes ») produit TOUJOURS la carte, instantanément, sans appel IA.
// Les phrases floues ne sont pas devinées : on rend la main au modèle.
import { frenchNumber, parseNumberWords } from "./french-number";
import { fold } from "./text";

export type AlarmIntent =
  | { tool: "set_alarm"; args: { hour?: number; minutes?: number; day?: "tomorrow"; in_minutes?: number; label?: string } }
  | { tool: "set_timer"; args: { hours?: number; minutes?: number; seconds?: number; label?: string } };

// Nombres écrits en lettres (0 à 99 + « une »), du plus long au plus court pour que « vingt et un » passe avant « vingt ».
const WORDS = [...new Set([...Array.from({ length: 100 }, (_, i) => frenchNumber(i)), ...Array.from({ length: 5 }, (_, i) => `${frenchNumber(i * 10 + 20)} et une`), "une"].map((w) => fold(w).replace(/-/g, " ")))].sort((a, b) => b.length - a.length);
const NUM = `(\\d+|${WORDS.join("|")})`;
const num = (s: string) => parseNumberWords(s.replace(/\bune\b/g, "un")); // « vingt et une heures » = 21

/** Texte prêt à analyser : sans accents ni majuscules, apostrophes et traits d'union en espaces. */
const prep = (t: string) => fold(t).replace(/[’']/g, " ").replace(/-/g, " ").replace(/\s+/g, " ").trim();

const CANCEL = /\b(annule|annuler|supprime|supprimer|desactive|desactiver|enleve|enlever|efface|effacer)\b/;

// ---------- Heure du jour : « 7h », « 7 h 30 », « 07:30 », « sept heures et demie », « midi », « minuit » ----------

export function parseClock(text: string): { hour: number; minutes: number } | null {
  const f = prep(text);
  let hour: number | null = null;
  let minutes = 0;
  let end = 0;
  let m = f.match(/\b(\d{1,2})\s*(?:h|:|heures?)(?:\s*(\d{2}))?\b/);
  if (m) {
    hour = Number(m[1]);
    minutes = m[2] ? Number(m[2]) : 0;
    end = (m.index ?? 0) + m[0].length;
  } else if ((m = f.match(new RegExp(`\\b${NUM}\\s+heures?\\b(?:\\s+${NUM}\\b)?`)))) {
    hour = num(m[1]);
    const maybeMin = m[2] ? num(m[2]) : null;
    if (maybeMin !== null && maybeMin < 60) minutes = maybeMin;
    end = (m.index ?? 0) + m[0].length;
  } else if ((m = f.match(/\bmidi\b/))) {
    hour = 12;
    end = (m.index ?? 0) + m[0].length;
  } else if ((m = f.match(/\bminuit\b/))) {
    hour = 0;
    end = (m.index ?? 0) + m[0].length;
  }
  if (hour === null) return null;
  // « et demie », « et quart », « moins le quart » juste après l'heure.
  const after = f.slice(end);
  if (/^\s+et\s+demi[e]?\b/.test(after)) minutes = 30;
  else if (/^\s+et\s+quart\b/.test(after)) minutes = 15;
  else if (/^\s+moins\s+(?:le\s+)?quart\b/.test(after)) {
    hour = (hour + 23) % 24;
    minutes = 45;
  }
  // « 7 h du soir » / « ce soir à 7 h » → 19 h.
  if (hour >= 1 && hour <= 11 && /\b(du soir|de l apres midi|ce soir)\b/.test(f)) hour += 12;
  if (hour < 0 || hour > 23 || minutes < 0 || minutes > 59) return null;
  return { hour, minutes };
}

// ---------- Durée : « 5 minutes », « 1 h 30 », « 90 secondes », « un quart d'heure », « une demi-heure » ----------

export function parseDuration(text: string): number | null {
  const f = prep(text);
  let s = 0;
  if (/\btrois quarts d heure\b/.test(f)) s += 2700;
  else if (/\bquart d heure\b/.test(f)) s += 900;
  if (/\b(?:une )?demi heure\b/.test(f)) s += 1800;
  const clock = f.match(/\b(\d+)\s*h\s*(\d{1,2})\b(?!\s*(?:h|%))/); // « 1h30 » : minutes sans unité
  if (clock) s += Number(clock[1]) * 3600 + Number(clock[2]) * 60;
  else {
    const h = f.match(new RegExp(`\\b${NUM}\\s*(?:heures?|h)\\b(\\s+et\\s+demi[e]?\\b)?`));
    if (h && num(h[1]) !== null) s += num(h[1])! * 3600 + (h[2] ? 1800 : 0);
    const mn = f.match(new RegExp(`\\b${NUM}\\s*(?:minutes?|mins?|mn)\\b(\\s+et\\s+demi[e]?\\b)?`));
    if (mn && num(mn[1]) !== null) s += num(mn[1])! * 60 + (mn[2] ? 30 : 0);
  }
  const sec = f.match(new RegExp(`\\b${NUM}\\s*(?:secondes?|secs?)\\b`));
  if (sec && num(sec[1]) !== null) s += num(sec[1])!;
  return s > 0 && s <= 86_400 ? s : null;
}

/** « pour la salle », « pour les pâtes » → « Salle », « Pâtes » (seulement s'il n'y a pas de chiffre : sinon on ne devine pas). */
function labelOf(original: string): string | undefined {
  const m = original.match(/\bpour\s+(?:(?:les|le|la|l['’]|une|un|aller\s+(?:à\s+la\s+|au\s+|à\s+)?|mes|mon|ma)\s*)?([^.,!?;\n]{2,40})$/i);
  const raw = m?.[1]?.trim();
  if (!raw || /\d/.test(raw) || /\b(demain|ce soir|ce matin|heures?|minutes?|secondes?)\b/i.test(raw)) return undefined;
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/** Phrase de Ruben → ordre clair de réveil ou de minuteur, ou null (le modèle décide alors). */
export function detectAlarmIntent(text: string): AlarmIntent | null {
  const t = text.trim();
  if (!t || t.length > 300) return null;
  const f = prep(t);
  if (CANCEL.test(f)) return null; // annuler un réveil n'est pas géré par l'app : on ne devine pas

  if (/\b(minuteur|minuterie|timer|compte a rebours)\b/.test(f)) {
    const seconds = parseDuration(t);
    if (seconds === null) return null;
    const label = labelOf(t);
    return { tool: "set_timer", args: { hours: Math.floor(seconds / 3600), minutes: Math.floor((seconds % 3600) / 60), seconds: seconds % 60, ...(label ? { label } : {}) } };
  }

  const asksAlarm = /\breveille moi\b/.test(f) || (/\b(reveil|alarme)\b/.test(f) && /\b(mets|met|mettre|regle|regler|programme|programmer|fais|faire|cree|creer|ajoute|ajouter|lance|configure|besoin d un|veux un|voudrais un|aimerais un)\b/.test(f));
  if (!asksAlarm) return null;
  const label = labelOf(t);

  // « dans 20 minutes », « dans une heure et demie » : le code calcule l'heure à partir de maintenant.
  const rel = f.match(/\bdans (.+)$/);
  if (rel) {
    const s = parseDuration(rel[1]);
    if (s !== null && s >= 60) return { tool: "set_alarm", args: { in_minutes: Math.round(s / 60), ...(label ? { label } : {}) } };
  }
  const clock = parseClock(t);
  if (!clock) return null;
  return { tool: "set_alarm", args: { hour: clock.hour, minutes: clock.minutes, ...(/\bdemain\b/.test(f) ? { day: "tomorrow" as const } : {}), ...(label ? { label } : {}) } };
}
