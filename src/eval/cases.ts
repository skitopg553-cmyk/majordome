// Phrases d'évaluation : français réaliste, avec ce qui doit être créé. « Maintenant » = lundi 19 octobre 2026, 10 h (Paris).
// Les dates : mardi 20, mercredi 21, jeudi 22, vendredi 23, samedi 24, dimanche 25. Jours : 1 = lundi … 7 = dimanche.
import type { Case, Expect } from "./score";

export const NOW_TEXT = "lundi 19 octobre 2026 à 10:00 (fuseau Europe/Paris, UTC+02:00)";

const pb = (title: RegExp, date?: string): Expect => ({ kind: "pensebete", title, date });
const one = (title: RegExp, date: string, start: string, end?: string): Expect => ({ kind: "creneau", title, date, start, end });
const slot = (title: RegExp, days: string, start: string, end?: string, habit?: boolean): Expect => ({ kind: "creneau_recurrent", title, days, start, end, habit });
const items = (...i: Expect[]) => [{ items: i }];
const ALL = "1,2,3,4,5,6,7";

export const CASES: Case[] = [
  // --- Pense-bêtes (sans horaire : se cochent, jamais dans la frise du Planning)
  { id: "pb-chambre", say: "ranger ma chambre", outcomes: items(pb(/chambre/i)) },
  { id: "pb-poubelles", say: "n'oublie pas de sortir les poubelles ce soir", outcomes: items(pb(/poubelle/i)) },
  { id: "pb-pain", say: "acheter du pain demain", outcomes: items(pb(/pain/i, "2026-10-20")) },
  { id: "pb-plombier", say: "demain je dois appeler le plombier", outcomes: items(pb(/plombier/i, "2026-10-20")) },
  { id: "pb-dossier", say: "pense à envoyer le dossier à Julie", outcomes: items(pb(/dossier/i)) },
  { id: "pb-courses", say: "faire les courses samedi", outcomes: items(pb(/courses/i, "2026-10-24")) },
  { id: "pb-edf", say: "payer la facture EDF avant vendredi", outcomes: items(pb(/edf|facture/i)) },
  { id: "pb-piles", say: "rappelle-moi d'acheter des piles", outcomes: items(pb(/piles/i)) },
  // --- Créneaux ponctuels (une seule fois, avec horaire)
  { id: "one-dentiste", say: "j'ai rendez-vous chez le dentiste mardi à 17h", outcomes: items(one(/dentiste/i, "2026-10-20", "17:00")) },
  { id: "one-diner", say: "dîner avec Arthur lundi à 20h", outcomes: items(one(/arthur/i, "2026-10-19", "20:00")) },
  { id: "one-reunion", say: "réunion demain de 14h à 15h30", outcomes: items(one(/r[eé]union/i, "2026-10-20", "14:00", "15:30")) },
  { id: "one-medecin", say: "mets un rendez-vous médecin jeudi 22 octobre à 10h30", outcomes: items(one(/m[eé]decin/i, "2026-10-22", "10:30")) },
  { id: "one-anniv", say: "samedi anniversaire de Léa à 19h", outcomes: items(one(/anniversaire/i, "2026-10-24", "19:00")) },
  { id: "one-famille", say: "dîner de famille dimanche à 12h30", outcomes: items(one(/famille|d[iî]ner/i, "2026-10-25", "12:30")) },
  { id: "one-salle-soir", say: "salle ce soir de 19h à 20h30", outcomes: items(one(/salle/i, "2026-10-19", "19:00", "20:30")) },
  // --- Créneaux qui reviennent
  { id: "rec-travail", say: "je travaille du lundi au vendredi de 9h à 17h", outcomes: items(slot(/travail|boulot|taff/i, "1,2,3,4,5", "09:00", "17:00", false)) },
  { id: "rec-travail-8-16", say: "tous les jours de la semaine je travaille de 8h à 16h", outcomes: items(slot(/travail/i, "1,2,3,4,5", "08:00", "16:00")) },
  { id: "rec-salle", say: "salle de sport lundi mercredi vendredi de 18h à 20h", outcomes: items(slot(/salle|sport/i, "1,3,5", "18:00", "20:00", true)) },
  { id: "rec-meditation", say: "je médite tous les matins à 7h", outcomes: items(slot(/m[eé]dit/i, ALL, "07:00", undefined, true)) },
  { id: "rec-boxe", say: "j'ai boxe anglaise tous les mardis à 18h30", outcomes: items(slot(/boxe/i, "2", "18:30", undefined, true)) },
  { id: "rec-yoga", say: "yoga le samedi matin à 10h pour 1h", outcomes: items(slot(/yoga/i, "6", "10:00", "11:00", true)) },
  { id: "rec-cours-mar-jeu", say: "cours de 9h à 12h le mardi et le jeudi", outcomes: items(slot(/cours/i, "2,4", "09:00", "12:00")) },
  { id: "rec-hebdo", say: "réunion hebdo le jeudi à 10h pendant 45 minutes", outcomes: items(slot(/r[eé]union/i, "4", "10:00", "10:45")) },
  { id: "rec-sauf-mercredi", say: "cours de 14h à 16h tous les jours sauf le mercredi", outcomes: items(slot(/cours/i, "1,2,4,5,6,7", "14:00", "16:00")) },
  { id: "rec-tennis", say: "j'ai tennis le mercredi à 17h30 et le samedi à 10h", outcomes: items(slot(/tennis/i, "3", "17:30"), slot(/tennis/i, "6", "10:00")) },
  // --- Pense-bêtes qui reviennent (sans horaire)
  { id: "pbr-poubelles", say: "tous les lundis sortir les poubelles", outcomes: items({ kind: "pensebete_recurrent", title: /poubelle/i, days: "1" }) },
  { id: "pbr-loyer", say: "le 5 de chaque mois payer le loyer", outcomes: items({ kind: "pensebete_recurrent", title: /loyer/i }) },
  { id: "pbr-creatine", say: "chaque jour prendre ma créatine", outcomes: items({ kind: "pensebete_recurrent", title: /cr[eé]atine/i, days: ALL }) },
  // --- Flou : une seule question courte, rien de créé (ou, quand c'est raisonnable, le pense-bête sans horaire)
  { id: "flou-sport", say: "je veux faire du sport", outcomes: [{ question: true }, { items: [pb(/sport/i)] }] },
  { id: "flou-truc", say: "j'ai un truc demain", outcomes: [{ question: true }] },
  { id: "flou-bosse", say: "je bosse toute la semaine", outcomes: [{ question: true }] },
  { id: "flou-meditation", say: "méditation tous les jours", outcomes: [{ question: true }, { items: [{ kind: "pensebete_recurrent", title: /m[eé]dit/i, days: ALL }] }] },
  // --- Ma semaine type, en un seul message (le cas qui a échoué le 19/10)
  {
    id: "semaine-lundi-mardi",
    say: "aujourd'hui et tous les lundis j'ai cours de 9h à 13h, pause, puis je reprends à 14h et je finis à 18h. Pour ce lundi 19 j'ai restaurant avec Arthur à 20h. Demain comme tous les mardis j'ai cours de 9h à 12h, pause, puis je reprends à 12h30 et je finis à 17h30. J'ai boxe anglaise à 18h30 comme tous les mardis.",
    outcomes: items(slot(/cours/i, "1", "09:00", "13:00"), slot(/cours/i, "1", "14:00", "18:00"), one(/restaurant|arthur/i, "2026-10-19", "20:00"), slot(/cours/i, "2", "09:00", "12:00"), slot(/cours/i, "2", "12:30", "17:30"), slot(/boxe/i, "2", "18:30", undefined, true)),
  },
  {
    id: "semaine-fin",
    say: "le mercredi et le jeudi je commence à 9h, pause à 12h, je reprends à 13h30 et je finis à 17h. Le vendredi c'est pareil mais je finis à 16h. Je travaille chez Otacos de 18h30 à 23h le vendredi et le dimanche.",
    outcomes: [{ items: [slot(/cours|travail|boulot|taff/i, "3,4", "09:00", "12:00"), slot(/cours|travail|boulot|taff/i, "3,4", "13:30", "17:00"), slot(/otacos/i, "5,7", "18:30", "23:00")], extra: "allow" }],
    note: "extra autorisé : le vendredi peut être décrit de plusieurs façons valides",
  },
  // --- Tout d'un coup : trois sortes mélangées
  {
    id: "melange",
    say: "je travaille du lundi au vendredi de 9h à 17h, salle lundi mercredi vendredi de 18h à 20h, dîner avec Arthur lundi à 20h une seule fois, et ranger ma chambre",
    outcomes: items(slot(/travail/i, "1,2,3,4,5", "09:00", "17:00", false), slot(/salle/i, "1,3,5", "18:00", "20:00", true), one(/arthur/i, "2026-10-19", "20:00"), pb(/chambre/i)),
  },
];
