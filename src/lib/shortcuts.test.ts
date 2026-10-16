import { describe, expect, it } from "vitest";
import { isStatement, shortcutFromSearch } from "./shortcuts";

describe("raccourcis Android", () => {
  it("reconnaît les 3 actions et prépare la phrase", () => {
    expect(shortcutFromSearch("?action=parler")).toEqual({ chat: true, prefill: "" });
    expect(shortcutFromSearch("?action=tache")).toEqual({ chat: true, prefill: "Ajoute une tâche : " });
    expect(shortcutFromSearch("?action=depense")?.prefill).toBe("J'ai dépensé ");
  });
  it("ignore tout le reste (y compris les noms spéciaux de JavaScript)", () => {
    for (const s of ["", "?action=", "?action=supprimer", "?action=constructor", "?action=__proto__", "?bank=ok"]) expect(shortcutFromSearch(s)).toBeNull();
  });
  it("partage : seulement CSV et Excel", () => {
    expect(isStatement("releve.CSV", "")).toBe(true);
    expect(isStatement("Revolut.xlsx", "application/octet-stream")).toBe(true);
    expect(isStatement("x", "text/csv")).toBe(true);
    expect(isStatement("photo.jpg", "image/jpeg")).toBe(false);
    expect(isStatement("virus.exe", "")).toBe(false);
  });
});
