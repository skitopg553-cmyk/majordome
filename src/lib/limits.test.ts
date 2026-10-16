import { describe, expect, it } from "vitest";
import { clampText, MAX_NOTES, MAX_TITLE, parseDueAt, taskFields, taskPatch } from "./limits";

describe("clampText", () => {
  it("nettoie, coupe, et refuse ce qui n'est pas du texte ou est vide", () => {
    expect(clampText("  Appeler Paul  ", 50)).toBe("Appeler Paul");
    expect(clampText("x".repeat(500), MAX_TITLE)).toHaveLength(MAX_TITLE);
    for (const bad of ["", "   ", null, undefined, 12, {}]) expect(clampText(bad, 10)).toBeNull();
  });
});

describe("parseDueAt : échéance stricte, avec fuseau obligatoire", () => {
  it.each(["2026-10-16T10:00:00+02:00", "2026-10-16T08:00:00Z", "2026-10-16T08:00Z", "2026-10-16T08:00:00.000Z", "2026-12-31T23:59:59-05:00"])("accepte %s", (s) => {
    expect(parseDueAt(s)).toBe(s);
  });
  it.each([
    "1", // Date.parse("1") est « valide » pour JavaScript : l'ancien code l'acceptait
    "demain 10h",
    "2026-10-16", // jour seul : on ne devine pas l'heure
    "2026-10-16T10:00:00", // sans fuseau : lu comme de l'UTC par la base → décalage de 1 à 2 h à Paris
    "2026-02-31T10:00:00Z", // jour inexistant
    "2026-10-16T25:00:00Z",
    "2026-10-16T10:61:00Z",
    "2026-10-16T10:00:00+99:00",
    "2026-10-16 10:00:00+02:00",
    "",
  ])("refuse %j", (s) => expect(parseDueAt(s)).toBeNull());
  it("refuse tout ce qui n'est pas du texte", () => {
    for (const bad of [null, undefined, 1792000000000, {}, ["2026-10-16T10:00:00Z"]]) expect(parseDueAt(bad)).toBeNull();
  });
});

describe("taskFields", () => {
  it("création : titre obligatoire, champs bornés et validés", () => {
    expect(taskFields({ title: "  Appeler le médecin ", due_at: "2026-10-16T10:00:00+02:00", priority: 1, notes: "Dr Martin" }, { requireTitle: true })).toEqual({
      ok: true,
      fields: { title: "Appeler le médecin", due_at: "2026-10-16T10:00:00+02:00", priority: 1, notes: "Dr Martin" },
    });
    expect(taskFields({ title: "x".repeat(10_000) }, { requireTitle: true })).toMatchObject({ ok: true, fields: { title: "x".repeat(MAX_TITLE) } });
    expect(taskFields({ title: "ok", notes: "n".repeat(10_000) }, { requireTitle: true })).toMatchObject({ fields: { notes: "n".repeat(MAX_NOTES) } });
  });
  it("refuse un titre absent ou vide à la création, une échéance ou une priorité invalide (avec un message que le modèle peut corriger)", () => {
    expect(taskFields({}, { requireTitle: true })).toMatchObject({ ok: false, error: expect.stringMatching(/title/) });
    expect(taskFields({ title: "  " }, { requireTitle: true })).toMatchObject({ ok: false });
    expect(taskFields({ title: "x", due_at: "demain" }, { requireTitle: true })).toMatchObject({ ok: false, error: expect.stringMatching(/due_at.*fuseau/) });
    expect(taskFields({ title: "x", priority: 5 }, { requireTitle: true })).toMatchObject({ ok: false, error: expect.stringMatching(/priority/) });
    expect(taskFields({ title: "x", priority: "1" }, { requireTitle: true })).toMatchObject({ ok: false });
  });
  it("modification : seuls les champs donnés sont renvoyés", () => {
    expect(taskFields({ due_at: "2026-10-17T09:00:00Z" }, { requireTitle: false })).toEqual({ ok: true, fields: { due_at: "2026-10-17T09:00:00Z" } });
    expect(taskFields({}, { requireTitle: false })).toEqual({ ok: true, fields: {} });
    expect(taskFields({ title: "  " }, { requireTitle: false })).toMatchObject({ ok: false }); // un titre donné ne peut pas être vide
  });
  it("une valeur nulle (champ à ignorer) n'est pas une erreur", () => {
    expect(taskFields({ title: "ok", due_at: null, priority: null, notes: null }, { requireTitle: true })).toEqual({ ok: true, fields: { title: "ok" } });
  });
});

describe("taskPatch (modification depuis l'écran)", () => {
  it("coche / décoche", () => {
    expect(taskPatch({ done: true })).toMatchObject({ ok: true, patch: { status: "done" } });
    expect(taskPatch({ done: false })).toEqual({ ok: true, patch: { status: "todo", done_at: null } });
  });
  it("champs validés, échéance et notes effaçables", () => {
    expect(taskPatch({ title: "  Nouveau titre ", priority: 1 })).toEqual({ ok: true, patch: { title: "Nouveau titre", priority: 1 } });
    expect(taskPatch({ due_at: "2026-10-17T09:00:00+02:00" })).toEqual({ ok: true, patch: { due_at: "2026-10-17T09:00:00+02:00" } });
    expect(taskPatch({ due_at: null })).toEqual({ ok: true, patch: { due_at: null } });
    expect(taskPatch({ notes: "" })).toEqual({ ok: true, patch: { notes: null } });
  });
  it("refuse l'invalide et le vide", () => {
    for (const bad of [{ due_at: "demain" }, { title: "  " }, { priority: 9 }, {}, { id: 3 }]) expect(taskPatch(bad)).toMatchObject({ ok: false });
  });
});
