import { describe, expect, it } from "vitest";
import { importKeys, parseBankCsv, parseFrenchAmount, parseFrenchDate, splitCsvLine } from "./csv";

describe("parseFrenchAmount", () => {
  it("lit la virgule décimale, les espaces de milliers et l'euro", () => {
    expect(parseFrenchAmount("-1 234,56")).toBe(-1234.56);
    expect(parseFrenchAmount("1 234,5 €")).toBe(1234.5);
    expect(parseFrenchAmount("1.234,56")).toBe(1234.56);
    expect(parseFrenchAmount("+2350,00")).toBe(2350);
    expect(parseFrenchAmount("12.50")).toBe(12.5);
  });
  it("renvoie null si vide ou illisible", () => {
    expect(parseFrenchAmount("")).toBeNull();
    expect(parseFrenchAmount("abc")).toBeNull();
  });
});

describe("parseFrenchDate", () => {
  it("convertit JJ/MM/AAAA et JJ/MM/AA", () => {
    expect(parseFrenchDate("05/10/2026")).toBe("2026-10-05");
    expect(parseFrenchDate("5/1/26")).toBe("2026-01-05");
    expect(parseFrenchDate("31.12.2026")).toBe("2026-12-31");
  });
  it("refuse les dates impossibles ou au mauvais format", () => {
    expect(parseFrenchDate("31/02/2026")).toBeNull();
    expect(parseFrenchDate("2026-10-05")).toBeNull();
  });
});

describe("splitCsvLine", () => {
  it("respecte les guillemets", () => {
    expect(splitCsvLine('05/10/2026;"CB ; CARREFOUR";-23,40', ";")).toEqual(["05/10/2026", "CB ; CARREFOUR", "-23,40"]);
    expect(splitCsvLine('"a ""b""",c', ",")).toEqual(['a "b"', "c"]);
  });
});

describe("parseBankCsv", () => {
  it("séparateur « ; », une colonne Montant, lignes d'infos avant l'en-tête", () => {
    const csv = "﻿Compte courant n° 1234\nSolde au 05/10/2026;2847,32\n\nDate;Libellé;Montant\n05/10/2026;CB CARREFOUR CITY;-23,40\n04/10/2026;VIR SALAIRE ACME;2 350,00\n";
    const r = parseBankCsv(csv);
    expect(r.error).toBeUndefined();
    expect(r.transactions).toEqual([
      { date: "2026-10-05", label: "CB CARREFOUR CITY", amount: -23.4 },
      { date: "2026-10-04", label: "VIR SALAIRE ACME", amount: 2350 },
    ]);
  });

  it("séparateur « , » avec guillemets et colonnes Débit / Crédit", () => {
    const csv = 'Date opération,Libellé,Débit,Crédit\n03/10/2026,"NAVIGO, MOIS",86.40,\n02/10/2026,REMBOURSEMENT,,"15,00"\n';
    expect(parseBankCsv(csv).transactions).toEqual([
      { date: "2026-10-03", label: "NAVIGO, MOIS", amount: -86.4 },
      { date: "2026-10-02", label: "REMBOURSEMENT", amount: 15 },
    ]);
  });

  it("ignore et compte les lignes illisibles", () => {
    const r = parseBankCsv("Date;Libellé;Montant\n05/10/2026;OK;-1,00\nTotal;;-1,00\n32/10/2026;KO;-2,00\n");
    expect(r.transactions).toHaveLength(1);
    expect(r.skipped).toBe(2);
  });

  it("explique quand le fichier n'est pas un relevé", () => {
    expect(parseBankCsv("nom;prénom\nRuben;C").error).toMatch(/En-tête introuvable/);
    expect(parseBankCsv("Date;Nom\n01/01/2026;x").error).toMatch(/introuvables/);
  });
});

describe("importKeys", () => {
  it("distingue deux opérations identiques et redonne les mêmes clés à la réimport", () => {
    const t = { date: "2026-10-05", label: "CB CAFE", amount: -2.5 };
    const keys = importKeys([t, t, { ...t, amount: -3 }]);
    expect(keys).toEqual(["2026-10-05|cb cafe|-2.50|1", "2026-10-05|cb cafe|-2.50|2", "2026-10-05|cb cafe|-3.00|1"]);
    expect(importKeys([t, t, { ...t, amount: -3 }])).toEqual(keys);
  });
});
