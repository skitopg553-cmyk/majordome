// Phrases d'évaluation : français réaliste, avec l'état final attendu du calendrier. « Maintenant » = lundi 19 octobre 2026, 10 h (Paris).
// Dates : mardi 20, mercredi 21, jeudi 22, vendredi 23, samedi 24, dimanche 25. Jours : 1 = lundi … 7 = dimanche.
// Règle « fin obligatoire » : quand la fin n'est pas dite, poser la question est TOUJOURS une bonne réponse.
import type { Case, Expect, Outcome } from "./score";

export const NOW_TEXT = "lundi 19 octobre 2026 à 10:00 (fuseau Europe/Paris, UTC+02:00)";
export const NOW = new Date("2026-10-19T08:00:00Z");

const pb = (title: RegExp, date?: string): Expect => ({ kind: "pensebete", title, date });
const one = (title: RegExp, date: string, start: string, end?: string): Expect => ({ kind: "creneau", title, date, start, end });
const slot = (title: RegExp, days: string, start: string, end?: string, habit?: boolean): Expect => ({ kind: "creneau_recurrent", title, days, start, end, habit });
const items = (...i: Expect[]): Outcome[] => [{ items: i }];
const ask: Outcome = { question: true };
/** Fin non dite : la question, ou (s'il a choisi 1 h par défaut) l'élément. */
const askOr = (...i: Expect[]): Outcome[] => [ask, { items: i }];
const ALL = "1,2,3,4,5,6,7";
const COURS = /^cours$/i;

/** Ma semaine réelle, pavé par pavé (habitudes : boxe et muscu). */
const week = (o: { boxe?: [string, string] } = {}): Expect[] => [
  slot(COURS, "1", "09:00", "12:00"),
  slot(COURS, "1", "14:00", "18:00"),
  slot(COURS, "2", "09:00", "12:00"),
  slot(COURS, "2", "12:30", "17:30"),
  slot(/boxe/i, "2", ...(o.boxe ?? ["18:30", "20:00"]), true),
  slot(COURS, "3,4", "09:00", "12:00"),
  slot(/muscu/i, "3,4", "12:00", "13:30", true),
  slot(COURS, "3,4", "13:30", "17:00"),
  slot(COURS, "5", "09:00", "12:00"),
  slot(/muscu/i, "5", "12:00", "13:00", true),
  slot(COURS, "5", "13:00", "16:00"),
];
const TACOS = /tacos/i;
const REAL_WEEK =
  "Lundi cours 9 h-12 h et 14 h-18 h, mardi cours 9 h-12 h et 12 h 30-17 h 30 puis boxe anglaise 18 h 30-20 h, mercredi et jeudi cours 9 h-12 h, muscu 12 h-13 h 30, cours 13 h 30-17 h, vendredi cours 9 h-12 h, muscu 12 h-13 h, cours jusqu'à 16 h, travail au O'Tacos vendredi et dimanche à 18 h 30";
// O'Tacos sans fin : soit tout le reste est créé ET la question est posée, soit O'Tacos est créé avec 1 h par défaut (et c'est dit).
const realWeekOutcomes: Outcome[] = [
  { items: week(), say: /\?/ },
  { items: [...week(), slot(TACOS, "5,7", "18:30")], say: /défaut|\?/ },
];

export const CASES: Case[] = [
  // --- Pense-bêtes (sans horaire : se cochent, jamais dans la grille)
  { id: "pb-chambre", say: "ranger ma chambre", outcomes: items(pb(/chambre/i)) },
  { id: "pb-poubelles", say: "penser à sortir les poubelles", outcomes: items(pb(/poubelle/i)) },
  { id: "pb-poubelles-soir", say: "n'oublie pas de sortir les poubelles ce soir", outcomes: items(pb(/poubelle/i)) },
  { id: "pb-pain", say: "acheter du pain demain", outcomes: items(pb(/pain/i, "2026-10-20")) },
  { id: "pb-plombier", say: "demain je dois appeler le plombier", outcomes: items(pb(/plombier/i, "2026-10-20")) },
  { id: "pb-dossier", say: "pense à envoyer le dossier à Julie", outcomes: items(pb(/dossier/i)) },
  { id: "pb-courses", say: "faire les courses samedi", outcomes: items(pb(/courses/i, "2026-10-24")) },
  { id: "pb-edf", say: "payer la facture EDF avant vendredi", outcomes: items(pb(/edf|facture/i)) },
  { id: "pb-piles", say: "rappelle-moi d'acheter des piles", outcomes: items(pb(/piles/i)) },
  // --- Événements ponctuels
  { id: "one-dentiste-jeudi", say: "rendez-vous dentiste jeudi 15h", outcomes: askOr(one(/dentiste/i, "2026-10-22", "15:00")) },
  { id: "one-dentiste-mardi", say: "j'ai rendez-vous chez le dentiste mardi à 17h", outcomes: askOr(one(/dentiste/i, "2026-10-20", "17:00")) },
  { id: "one-diner", say: "dîner avec Arthur ce soir de 20h à 22h", outcomes: items(one(/arthur/i, "2026-10-19", "20:00", "22:00")) },
  { id: "one-reunion", say: "réunion demain de 14h à 15h30", outcomes: items(one(/r[eé]union/i, "2026-10-20", "14:00", "15:30")) },
  { id: "one-medecin", say: "mets un rendez-vous médecin jeudi 22 octobre de 10h30 à 11h", outcomes: items(one(/m[eé]decin/i, "2026-10-22", "10:30", "11:00")) },
  { id: "one-anniv", say: "samedi anniversaire de Léa à 19h", outcomes: askOr(one(/anniversaire/i, "2026-10-24", "19:00")) },
  { id: "one-salle-soir", say: "salle ce soir de 19h à 20h30", outcomes: items(one(/salle/i, "2026-10-19", "19:00", "20:30")) },
  // --- Événements qui reviennent
  { id: "rec-travail", say: "je travaille du lundi au vendredi de 9h à 17h", outcomes: items(slot(/travail|boulot|taff/i, "1,2,3,4,5", "09:00", "17:00", false)) },
  { id: "rec-salle", say: "salle de sport lundi mercredi vendredi de 18h à 20h", outcomes: items(slot(/salle|sport/i, "1,3,5", "18:00", "20:00", true)) },
  { id: "rec-meditation", say: "je médite tous les matins de 7h à 7h20", outcomes: items(slot(/m[eé]dit/i, ALL, "07:00", "07:20", true)) },
  { id: "rec-boxe-sans-fin", say: "j'ai boxe à 18h30", outcomes: [ask], note: "doit demander la fin (et le jour)" },
  { id: "rec-boxe-tous-mardis", say: "j'ai boxe anglaise tous les mardis à 18h30", outcomes: askOr(slot(/boxe/i, "2", "18:30", undefined, true)) },
  { id: "rec-yoga", say: "yoga le samedi matin à 10h pour 1h, chaque semaine", outcomes: items(slot(/yoga/i, "6", "10:00", "11:00", true)) },
  { id: "rec-cours-mar-jeu", say: "cours de 9h à 12h le mardi et le jeudi, toutes les semaines", outcomes: items(slot(COURS, "2,4", "09:00", "12:00")) },
  { id: "rec-hebdo", say: "réunion hebdo le jeudi à 10h pendant 45 minutes", outcomes: items(slot(/r[eé]union/i, "4", "10:00", "10:45")) },
  { id: "rec-sauf-mercredi", say: "cours de 14h à 16h tous les jours sauf le mercredi", outcomes: items(slot(COURS, "1,2,4,5,6,7", "14:00", "16:00")) },
  { id: "rec-pause", say: "tous les lundis j'ai cours de 9h à 12h, pause, puis cours de 13h à 17h", outcomes: items(slot(COURS, "1", "09:00", "12:00"), slot(COURS, "1", "13:00", "17:00")), note: "la pause n'est pas un événement" },
  { id: "rec-fin-de-cours", say: "le mercredi je commence les cours à 9h, fin de cours à 16h", outcomes: items(slot(COURS, "3", "09:00", "16:00")), note: "« fin de cours » = heure de fin" },
  // --- Pense-bêtes qui reviennent (sans horaire)
  { id: "pbr-poubelles", say: "tous les lundis sortir les poubelles", outcomes: items({ kind: "pensebete_recurrent", title: /poubelle/i, days: "1" }) },
  { id: "pbr-loyer", say: "le 5 de chaque mois payer le loyer", outcomes: items({ kind: "pensebete_recurrent", title: /loyer/i }) },
  { id: "pbr-creatine", say: "chaque jour prendre ma créatine", outcomes: items({ kind: "pensebete_recurrent", title: /cr[eé]atine/i, days: ALL }) },
  // --- Flou : une seule question courte, rien de créé
  { id: "flou-sport", say: "je veux faire du sport", outcomes: [ask, { items: [pb(/sport/i)] }] },
  { id: "flou-truc", say: "j'ai un truc demain", outcomes: [ask] },
  { id: "flou-bosse", say: "je bosse toute la semaine", outcomes: [ask] },
  // --- Ma semaine réelle
  { id: "semaine-reelle", say: REAL_WEEK, outcomes: realWeekOutcomes },
  { id: "semaine-deux-fois", say: [REAL_WEEK, REAL_WEEK], outcomes: realWeekOutcomes, note: "envoyée deux fois : aucun doublon" },
  // --- Modifier, supprimer (semaine déjà enregistrée)
  { id: "decale-boxe", seed: "week", say: "décale la boxe à 19h", outcomes: [{ items: [...week({ boxe: ["19:00", "20:30"] }), slot(TACOS, "5,7", "18:30", "23:00")] }] },
  {
    id: "supprime-cours-mardi-aprem",
    seed: "week",
    say: "supprime le cours de mardi après-midi juste cette semaine",
    outcomes: [{ items: [...week(), slot(TACOS, "5,7", "18:30", "23:00"), { kind: "exception", title: COURS, date: "2026-10-20", action: "skip" }] }],
  },
  { id: "supprime-tout", seed: "week+reminders", say: "supprime tout", outcomes: [{ items: [], say: /J'ai supprimé 13 événements et 1 pense-bête/ }] },
  // --- Tout d'un coup : les deux sortes mélangées
  {
    id: "melange",
    say: "je travaille du lundi au vendredi de 9h à 17h, salle lundi mercredi vendredi de 18h à 20h, dîner avec Arthur ce soir de 20h à 22h, et ranger ma chambre",
    outcomes: items(slot(/travail/i, "1,2,3,4,5", "09:00", "17:00", false), slot(/salle/i, "1,3,5", "18:00", "20:00", true), one(/arthur/i, "2026-10-19", "20:00", "22:00"), pb(/chambre/i)),
  },
];
