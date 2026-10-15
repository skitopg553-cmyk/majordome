import { describe, expect, it } from "vitest";
import { isAppointmentMail, type MailMeta } from "./mail-filter";

// 20 mails FICTIFS : 10 à garder (RDV ou demande de RDV), 10 à ignorer.
const KEEP: MailMeta[] = [
  { from: "Doctolib <no-reply@doctolib.fr>", subject: "Rappel : votre rendez-vous demain à 10h30" },
  { from: "Google Agenda <calendar-notification@google.com>", subject: "Invitation : Point projet @ jeu. 22 oct. 14:00" },
  { from: "Planity <contact@planity.com>", subject: "Confirmation de votre réservation chez Coiffure Paris" },
  { from: "Léa Martin <lea@agence.fr>", subject: "On se cale un créneau ?", snippet: "Tu serais dispo jeudi 14h pour en parler ?" },
  { from: "TheFork <noreply@thefork.com>", subject: "Réservation confirmée - Le Comptoir, samedi 20h" },
  { from: "Cabinet Dr Durand <secretariat@cabinet.fr>", subject: "Annulation de votre RDV du 12/11" },
  { from: "Thomas <thomas@gmail.com>", subject: "Déj ?", snippet: "On peut se voir mardi prochain pour un appel rapide ?" },
  { from: "RH Acme <rh@acme.fr>", subject: "Entretien annuel", snippet: "Je te propose un créneau le 05/11 à 9h" },
  { from: "Client <client@startup.io>", subject: "Visio de lancement", snippet: "Une réunion visio vendredi 11h vous irait ?" },
  { from: "Banque <conseiller@banque.fr>", subject: "Votre conseiller", snippet: "Pièce jointe : rendez-vous.ics", hasIcs: true },
];

const SKIP: MailMeta[] = [
  { from: "Zalando <news@zalando.fr>", subject: "Soldes : -50 % sur tout le site" },
  { from: "Netflix <info@netflix.com>", subject: "Nouveautés de la semaine" },
  { from: "Amazon <ship@amazon.fr>", subject: "Votre colis a été expédié" },
  { from: "Medium <noreply@medium.com>", subject: "Newsletter : 5 articles pour vous", snippet: "Se désabonner" },
  { from: "Uber Eats <promo@uber.com>", subject: "Code promo : -30% ce soir", snippet: "Offre spéciale jusqu'à 22h" },
  { from: "SNCF <facture@sncf.fr>", subject: "Votre facture est disponible" },
  { from: "Maman <maman@gmail.com>", subject: "Photos du week-end", snippet: "Regarde comme c'était beau" },
  { from: "GitHub <noreply@github.com>", subject: "[majordome] Build réussi" },
  { from: "Free Mobile <service@free.fr>", subject: "Votre facture du mois d'octobre" },
  { from: "LinkedIn <jobs@linkedin.com>", subject: "15 nouvelles offres d'emploi pour vous" },
];

describe("isAppointmentMail", () => {
  it.each(KEEP.map((m) => [m.subject, m] as const))("garde « %s »", (_, m) => {
    const r = isAppointmentMail(m);
    expect(r.keep).toBe(true);
    expect(r.reasons.length).toBeGreaterThan(0);
  });
  it.each(SKIP.map((m) => [m.subject, m] as const))("ignore « %s »", (_, m) => {
    expect(isAppointmentMail(m).keep).toBe(false);
  });
  it("un signal fort l'emporte sur l'allure de newsletter", () => {
    expect(isAppointmentMail({ from: "Salon <news@salon.fr>", subject: "Votre rendez-vous de samedi", snippet: "Se désabonner" }).keep).toBe(true);
  });
});
