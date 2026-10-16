import { readSheet } from "read-excel-file/node";
import { describe, expect, it } from "vitest";
import writeExcelFile from "write-excel-file/node";
import { parseBankCsv, parseFrenchAmount, parseIsoDate } from "./csv";
import { rowsToCsv, type Cell } from "./xlsx";

// Faux relevé Revolut (données inventées). Colonnes et formats comme l'export réel : dates « AAAA-MM-JJ HH:MM:SS », point décimal.
const HEADER = ["Type", "Product", "Started Date", "Completed Date", "Description", "Amount", "Fee", "Currency", "State", "Balance"];
const ROWS: string[][] = [
  ["CARD_PAYMENT", "Current", "2026-10-03 12:30:11", "2026-10-04 08:02:45", "Carrefour City", "-23.40", "0.00", "EUR", "COMPLETED", "976.60"],
  ["CARD_PAYMENT", "Current", "2026-10-05 19:10:00", "2026-10-05 19:10:00", "Burger, Fries & Co", "-12.50", "0.50", "EUR", "COMPLETED", "963.60"], // frais 0,50 → -13,00 ; virgule dans la description
  ["TOPUP", "Current", "2026-10-06 09:00:00", "2026-10-06 09:00:05", "Top-up by *1234", "1500.00", "0.00", "EUR", "COMPLETED", "2463.60"],
  ["CARD_PAYMENT", "Current", "2026-10-07 10:00:00", "", "Spotify", "-10.99", "0.00", "EUR", "PENDING", "2452.61"],
  ["CARD_PAYMENT", "Current", "2026-10-08 10:00:00", "2026-10-08 10:01:00", "Amazon (remboursé)", "-45.00", "0.00", "EUR", "REVERTED", "2452.61"],
  ["CARD_PAYMENT", "Current", "2026-10-09 10:00:00", "", "Casino", "-80.00", "0.00", "EUR", "DECLINED", "2452.61"],
  ["CARD_PAYMENT", "Current", "2026-10-10 10:00:00", "2026-10-10 10:00:30", "Hotel Londres", "-120.00", "0.00", "GBP", "COMPLETED", "2452.61"], // autre devise : ignorée, jamais convertie
  ["EXCHANGE", "Current", "2026-10-11 10:00:00", "2026-10-11 10:00:30", "Frais seulement", "0.00", "0.00", "EUR", "COMPLETED", "2452.61"], // net 0 : ignoré
  ["TRANSFER", "Current", "2026-10-12 14:00:00", "2026-10-12 14:00:10", "Virement vers Léa", "-60.00", "0.00", "EUR", "COMPLETED", "2392.61"],
];
const EXPECTED = [
  { date: "2026-10-04", label: "Carrefour City", amount: -23.4 }, // Completed Date (pas Started Date 10-03)
  { date: "2026-10-05", label: "Burger, Fries & Co", amount: -13 }, // Amount − Fee
  { date: "2026-10-06", label: "Top-up by *1234", amount: 1500 },
  { date: "2026-10-12", label: "Virement vers Léa", amount: -60 },
];

const toCsv = (rows: string[][]) =>
  [HEADER, ...rows].map((r) => r.map((c) => (/[",]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(",")).join("\n");

describe("relevé Revolut en CSV", () => {
  const r = parseBankCsv(toCsv(ROWS));

  it("reconnaît le format tout seul", () => expect(r.format).toBe("revolut"));
  it("date = Completed Date, montant = Amount − Fee", () => expect(r.transactions).toEqual(EXPECTED));
  it("ignore ce qui n'est pas COMPLETED, pas en euros, ou à 0 (et le compte)", () => expect(r.skipped).toBe(5));
  it("reconnaît aussi un export à points-virgules et un BOM", () => {
    const semi = "﻿" + toCsv(ROWS).replace(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/g, ";");
    expect(parseBankCsv(semi).transactions).toEqual(EXPECTED);
  });
  it("un relevé français classique reste en format standard", () => {
    expect(parseBankCsv("Date;Libellé;Montant\n05/10/2026;CB CAFE;-2,50").format).toBe("standard");
  });
});

describe("montants et dates", () => {
  it("lit « 1,234.56 » (anglais) comme « 1.234,56 » (français)", () => {
    expect(parseFrenchAmount("1,234.56")).toBe(1234.56);
    expect(parseFrenchAmount("-1,234.50")).toBe(-1234.5);
    expect(parseFrenchAmount("1.234,56")).toBe(1234.56);
    expect(parseFrenchAmount("12,5")).toBe(12.5);
    expect(parseFrenchAmount("-12.5")).toBe(-12.5);
  });
  it("lit les dates « AAAA-MM-JJ HH:MM:SS » et refuse les faux jours", () => {
    expect(parseIsoDate("2026-10-05 12:30:00")).toBe("2026-10-05");
    expect(parseIsoDate("2026-10-05T23:59")).toBe("2026-10-05");
    expect(parseIsoDate("2026-02-31 10:00:00")).toBeNull();
    expect(parseIsoDate("05/10/2026")).toBeNull();
  });
});

describe("relevé Revolut en Excel (.xlsx)", () => {
  // Un VRAI fichier .xlsx est fabriqué puis relu par la bibliothèque de lecture, comme dans le navigateur.
  async function xlsxRows(dateCells: "texte" | "date") {
    const cell = (v: string, i: number): Cell => {
      if (i === 2 || i === 3) {
        if (v === "") return null;
        return dateCells === "date" ? { value: new Date(`${v.replace(" ", "T")}Z`), type: Date, format: "yyyy-mm-dd hh:mm:ss" } : v;
      }
      if ([5, 6, 9].includes(i)) return { value: Number(v), type: Number };
      return v;
    };
    const header = HEADER.map((h) => ({ value: h, fontWeight: "bold" as const }));
    const data = ROWS.map((r) => r.map((v, i) => cell(v, i)));
    const buffer = await writeExcelFile([header, ...data] as never).toBuffer();
    return (await readSheet(buffer)) as Cell[][];
  }

  it.each(["texte", "date"] as const)("dates en %s : même résultat que le CSV", async (kind) => {
    const csv = rowsToCsv(await xlsxRows(kind));
    const r = parseBankCsv(csv);
    expect(r.format).toBe("revolut");
    expect(r.transactions).toEqual(EXPECTED);
    expect(r.skipped).toBe(5);
  });

  it("rowsToCsv : dates en UTC, virgules et retours à la ligne protégés", () => {
    const csv = rowsToCsv([["Description", "Date"], ['Café, "chez" Paul\nBis', new Date("2026-10-05T23:30:00Z")], [null, 12.5]]);
    expect(csv).toBe('Description,Date\n"Café, ""chez"" Paul Bis",2026-10-05 23:30:00\n,12.5');
  });
});
