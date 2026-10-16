import { describe, expect, it } from "vitest";
import type { EbTransaction } from "../enable-banking";
import { accountsFromSession, daysLeft, mapTransaction, mapTransactions, pickBalance, totalBalance } from "./bank";

// Opérations FICTIVES au format Enable Banking (montant toujours positif, le sens vient de credit_debit_indicator).
const tx = (o: Partial<EbTransaction> = {}): EbTransaction => ({
  entry_reference: "ref-1",
  transaction_amount: { currency: "EUR", amount: "23.40" },
  credit_debit_indicator: "DBIT",
  status: "BOOK",
  booking_date: "2026-10-04",
  creditor: { name: "Carrefour City" },
  ...o,
});

describe("mapTransaction", () => {
  it("dépense : DBIT → montant négatif, libellé = le bénéficiaire", () => {
    expect(mapTransaction(tx())).toEqual({ date: "2026-10-04", label: "Carrefour City", amount: -23.4, id: "ref-1" });
  });
  it("entrée : CRDT → montant positif, libellé = celui qui a payé", () => {
    expect(mapTransaction(tx({ credit_debit_indicator: "CRDT", debtor: { name: "ACME SAS" }, creditor: null, transaction_amount: { currency: "EUR", amount: "1450.00" } }))).toMatchObject({ amount: 1450, label: "ACME SAS" });
  });
  it("libellé de secours : texte de l'opération, puis note, puis un texte neutre", () => {
    expect(mapTransaction(tx({ creditor: null, remittance_information: ["Loyer  octobre", "ref 42"] }))?.label).toBe("Loyer octobre ref 42");
    expect(mapTransaction(tx({ creditor: { name: " " }, note: "Cadeau" }))?.label).toBe("Cadeau");
    expect(mapTransaction(tx({ creditor: null }))?.label).toBe("Opération bancaire");
  });
  it("date : booking_date, sinon value_date, sinon transaction_date ; ignore une date impossible", () => {
    expect(mapTransaction(tx({ booking_date: null, value_date: "2026-10-05" }))?.date).toBe("2026-10-05");
    expect(mapTransaction(tx({ booking_date: "2026-02-31", value_date: null, transaction_date: "2026-10-06" }))?.date).toBe("2026-10-06");
  });
  it("ne devine jamais : autre devise, sens inconnu, montant nul / illisible, sans date, en attente → null", () => {
    expect(mapTransaction(tx({ transaction_amount: { currency: "GBP", amount: "10" } }))).toBeNull();
    expect(mapTransaction(tx({ credit_debit_indicator: undefined }))).toBeNull();
    expect(mapTransaction(tx({ transaction_amount: { currency: "EUR", amount: "0.00" } }))).toBeNull();
    expect(mapTransaction(tx({ transaction_amount: { currency: "EUR", amount: "beaucoup" } }))).toBeNull();
    expect(mapTransaction(tx({ booking_date: null }))).toBeNull();
    expect(mapTransaction(tx({ status: "PDNG" }))).toBeNull();
  });
  it("arrondit au centime", () => {
    expect(mapTransaction(tx({ transaction_amount: { currency: "EUR", amount: "0.1" } }))?.amount).toBe(-0.1);
    expect(mapTransaction(tx({ transaction_amount: { currency: "EUR", amount: "10.999" } }))?.amount).toBe(-11);
  });
});

describe("mapTransactions : clés anti-doublon", () => {
  it("clé = identifiant de la banque ; les clés commencent par « eb| » (jamais en collision avec un import CSV)", () => {
    const { items } = mapTransactions([tx(), tx({ entry_reference: "ref-2" })], "acc-1");
    expect(items.map((i) => i.key)).toEqual(["eb|acc-1|ref-1", "eb|acc-1|ref-2"]);
  });
  it("sans identifiant : clé construite sur le contenu ; deux opérations identiques restent deux lignes", () => {
    const noId = tx({ entry_reference: null, transaction_id: null });
    const { items } = mapTransactions([noId, noId], "acc-1");
    expect(items.map((i) => i.key)).toEqual(["eb|acc-1|2026-10-04|carrefour city|-23.40", "eb|acc-1|2026-10-04|carrefour city|-23.40#2"]);
  });
  it("une re-synchro redonne exactement les mêmes clés (donc zéro doublon à l'enregistrement)", () => {
    const batch = [tx(), tx({ entry_reference: null, creditor: { name: "Café" } }), tx({ entry_reference: null, creditor: { name: "Café" } })];
    expect(mapTransactions(batch, "a").items.map((i) => i.key)).toEqual(mapTransactions(batch, "a").items.map((i) => i.key));
  });
  it("compte ce qui est ignoré", () => {
    expect(mapTransactions([tx(), tx({ status: "PDNG" }), tx({ transaction_amount: { currency: "USD", amount: "5" } })], "a")).toMatchObject({ skipped: 2 });
  });
});

describe("pickBalance", () => {
  const b = (balance_type: string, amount: string, currency = "EUR") => ({ balance_type, balance_amount: { currency, amount } });
  it("préfère le solde comptabilisé (CLBD), puis les autres types dans l'ordre", () => {
    expect(pickBalance([b("ITAV", "900.00"), b("CLBD", "976.60")])).toBe(976.6);
    expect(pickBalance([b("XPCD", "5"), b("ITAV", "900.00")])).toBe(900);
  });
  it("ignore ce qui n'est pas en euros ; null s'il n'y a rien d'utilisable", () => {
    expect(pickBalance([b("CLBD", "100", "GBP")])).toBeNull();
    expect(pickBalance([])).toBeNull();
    expect(pickBalance(undefined)).toBeNull();
    expect(pickBalance([b("CLBD", "n'importe quoi")])).toBeNull();
  });
  it("accepte un type inconnu en dernier recours", () => {
    expect(pickBalance([b("AUTRE", "12.5")])).toBe(12.5);
  });
});

describe("comptes de la session et solde total", () => {
  it("objets ou simples identifiants ; ignore ceux sans identifiant", () => {
    expect(accountsFromSession({ session_id: "s", accounts: [{ uid: "u1", name: "Compte courant", currency: "EUR" }, "u2", { name: "sans uid" }, ""] })).toEqual([
      { uid: "u1", name: "Compte courant", currency: "EUR" },
      { uid: "u2", name: null, currency: null },
    ]);
    expect(accountsFromSession({ session_id: "s" })).toEqual([]);
  });
  it("total = somme des comptes qui ont un solde, sans erreur de virgule", () => {
    expect(totalBalance([{ uid: "a", name: null, currency: "EUR", balance: 0.1 }, { uid: "b", name: null, currency: "EUR", balance: 0.2 }, { uid: "c", name: null, currency: "EUR" }])).toBe(0.3);
    expect(totalBalance([{ uid: "a", name: null, currency: "EUR" }])).toBeNull();
  });
});

describe("daysLeft (avertissement d'expiration)", () => {
  const now = new Date("2026-10-16T12:00:00Z");
  it("jours restants, négatif si expiré, null si inconnu", () => {
    expect(daysLeft("2026-10-26T12:00:00Z", now)).toBe(10);
    expect(daysLeft("2026-10-16T13:00:00Z", now)).toBe(1); // moins d'un jour = 1 (on arrondit vers le haut)
    expect(daysLeft("2026-10-15T12:00:00Z", now)).toBe(-1);
    expect(daysLeft(null, now)).toBeNull();
    expect(daysLeft("pas une date", now)).toBeNull();
  });
});
