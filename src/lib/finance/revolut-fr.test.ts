import { readSheet } from "read-excel-file/node";
import { describe, expect, it } from "vitest";
import writeExcelFile from "write-excel-file/node";
import { parseBankCsv } from "./csv";
import { fixMojibake } from "../text";
import { rowsToCsv, type Cell } from "./xlsx";

// Faux relevé Revolut EN FRANÇAIS (données inventées, JAMAIS de vraies données).
// Colonnes : Type, Produit, Date de début, Date de fin, Description, Montant, Frais, Devise, État, Solde.
const HEADER = ["Type", "Produit", "Date de début", "Date de fin", "Description", "Montant", "Frais", "Devise", "État", "Solde"];
const ROWS: string[][] = [
  ["Paiement par carte", "Actuel", "2026-10-03 12:30:11", "2026-10-04 08:02:45", "Carrefour City", "-23.40", "0.00", "EUR", "TERMINÉ", "976.60"],
  ["Paiement par carte", "Actuel", "2026-10-05 19:10:00", "2026-10-05 19:10:00", "Burger, Fries", "-12.50", "0.50", "EUR", "TERMINÉ", "963.60"],
  ["Rechargement", "Actuel", "2026-10-06 09:00:00", "2026-10-06 09:00:05", "Rechargement par *1234", "1500.00", "0.00", "EUR", "TERMINÉ", "2463.60"],
  ["Paiement par carte", "Actuel", "2026-10-07 10:00:00", "", "Spotify", "-10.99", "0.00", "EUR", "EN ATTENTE", "2452.61"],
  ["Paiement par carte", "Actuel", "2026-10-08 10:00:00", "2026-10-08 10:01:00", "Amazon", "-45.00", "0.00", "EUR", "ANNULÉ", "2452.61"],
  ["Paiement par carte", "Actuel", "2026-10-10 10:00:00", "2026-10-10 10:00:30", "Hôtel Londres", "-120.00", "0.00", "GBP", "TERMINÉ", "2452.61"],
  ["Virement", "Actuel", "2026-10-12 14:00:00", "2026-10-12 14:00:10", "Virement vers Léa", "-60.00", "0.00", "EUR", "TERMINÉ", "2392.61"],
];
const EXPECTED = [
  { date: "2026-10-04", label: "Carrefour City", amount: -23.4 },
  { date: "2026-10-05", label: "Burger, Fries", amount: -13 },
  { date: "2026-10-06", label: "Rechargement par *1234", amount: 1500 },
  { date: "2026-10-12", label: "Virement vers Léa", amount: -60 },
];

const toCsv = (header: string[], rows: string[][]) => [header, ...rows].map((r) => r.map((c) => (/[",;]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(",")).join("\n");

describe("relevé Revolut en français (CSV)", () => {
  const r = parseBankCsv(toCsv(HEADER, ROWS));
  it("reconnaît le format, date = Date de fin, montant = Montant − Frais, seulement TERMINÉ en euros", () => {
    expect(r.format).toBe("revolut");
    expect(r.transactions).toEqual(EXPECTED);
    expect(r.skipped).toBe(3); // en attente, annulé, livres
  });
  it("lit le solde : celui de l'opération terminée la plus récente (12/10 → 2392,61)", () => {
    expect(r.balance).toEqual({ amount: 2392.61, date: "2026-10-12" });
  });
  it("le solde ne vient jamais d'une ligne en attente, annulée ou en livres", () => {
    const only = parseBankCsv(toCsv(HEADER, [ROWS[0], ROWS[3], ROWS[4], ROWS[5]]));
    expect(only.balance).toEqual({ amount: 976.6, date: "2026-10-04" });
  });
  it("ordre des lignes quelconque : c'est la date qui compte, pas la position", () => {
    expect(parseBankCsv(toCsv(HEADER, [...ROWS].reverse())).balance).toEqual({ amount: 2392.61, date: "2026-10-12" });
  });
  it("montants à virgule et signe moins typographique (« −12,50 »), dates JJ/MM/AAAA", () => {
    const rows = [["Paiement", "Actuel", "05/10/2026 10:00", "06/10/2026 11:30", "Café", "−12,50", "0,00", "EUR", "TERMINÉ", "1 234,56"]];
    const x = parseBankCsv(toCsv(HEADER, rows));
    expect(x.transactions).toEqual([{ date: "2026-10-06", label: "Café", amount: -12.5 }]);
    expect(x.balance).toEqual({ amount: 1234.56, date: "2026-10-06" });
  });
  it("sans colonne Solde : pas de solde, mais l'import marche", () => {
    const noBal = HEADER.slice(0, 9);
    const x = parseBankCsv(toCsv(noBal, ROWS.map((r) => r.slice(0, 9))));
    expect(x.transactions).toEqual(EXPECTED);
    expect(x.balance).toBeUndefined();
  });
});

describe("en-têtes mal encodés (UTF-8 lu comme Windows-1252)", () => {
  // « Ã‰tat » = « État » ; « DÃ©but » = « début » ; « TerminÃ© » = « Terminé » ; « HÃ´tel » = « Hôtel ».
  it("répare les textes mal décodés", () => {
    expect(fixMojibake("Ã‰tat")).toBe("État");
    expect(fixMojibake("Date de dÃ©but")).toBe("Date de début");
    expect(fixMojibake("TERMINÃ‰")).toBe("TERMINÉ");
    expect(fixMojibake("HÃ´tel Londres")).toBe("Hôtel Londres");
  });
  it("laisse intact un texte correct, ou qui n'est pas réparable", () => {
    for (const s of ["État", "Terminé", "Voiture 3000 €", "Ã tout à l'heure", "Mon œuf ✓ Ã"]) expect(fixMojibake(s)).toBe(s);
  });
  it("un relevé entier mal encodé est reconnu comme s'il était correct", () => {
    const garbled = toCsv(HEADER, ROWS)
      .replace(/É/g, "Ã‰").replace(/é/g, "Ã©").replace(/ô/g, "Ã´").replace(/è/g, "Ã¨");
    const x = parseBankCsv(garbled);
    expect(x.format).toBe("revolut");
    expect(x.transactions).toEqual(EXPECTED);
    expect(x.balance).toEqual({ amount: 2392.61, date: "2026-10-12" });
  });
});

describe("relevé Revolut en français (Excel .xlsx)", () => {
  async function xlsxRows(amountsAs: "nombres" | "texte") {
    const data = ROWS.map((r) =>
      r.map((v, i): Cell => {
        if ([5, 6, 9].includes(i)) return amountsAs === "nombres" ? { value: Number(v), type: Number } : v.replace(".", ",").replace(/^-/, "−"); // texte français : « −23,40 »
        return v === "" ? null : v;
      }),
    );
    const buffer = await writeExcelFile([HEADER.map((h) => ({ value: h, fontWeight: "bold" as const })), ...data] as never).toBuffer();
    return (await readSheet(buffer)) as Cell[][];
  }
  it.each(["nombres", "texte"] as const)("montants en %s : même résultat que le CSV, accents conservés", async (kind) => {
    const x = parseBankCsv(rowsToCsv(await xlsxRows(kind)));
    expect(x.format).toBe("revolut");
    expect(x.transactions).toEqual(EXPECTED);
    expect(x.balance).toEqual({ amount: 2392.61, date: "2026-10-12" });
  });
});
