import { describe, expect, it } from "vitest";
import { ACTIONS_MARK, extractUndo, parseDeleteRequest, parseUndoSteps, splitReply, undoLabel, type Undo } from "./undo";

describe("parseUndoSteps (ce que le navigateur peut demander)", () => {
  it("accepte supprimer / remettre / recréer un souvenir", () => {
    expect(parseUndoSteps([{ op: "delete", table: "workouts", id: 4 }])).toEqual([{ op: "delete", table: "workouts", id: 4 }]);
    expect(parseUndoSteps([{ op: "restore", table: "savings_goals", id: 2, values: { saved: 450, target: 3000 } }])).toHaveLength(1);
    expect(parseUndoSteps([{ op: "insert", table: "memories", values: { content: "x", category: "info" } }])).toHaveLength(1);
  });
  it("refuse une table inconnue, un id absurde, une colonne non autorisée", () => {
    for (const bad of [
      [{ op: "delete", table: "ai_calls", id: 1 }],
      [{ op: "delete", table: "tasks", id: "1; drop table tasks" }],
      [{ op: "delete", table: "tasks", id: -3 }],
      [{ op: "delete", table: "tasks", id: 1.5 }],
      [{ op: "restore", table: "tasks", id: 1, values: { id: 99 } }],
      [{ op: "restore", table: "tasks", id: 1, values: { title: { a: 1 } } }],
      [{ op: "restore", table: "tasks", id: 1, values: {} }],
      [{ op: "insert", table: "tasks", values: { id: 5 } }], // recréer : seulement les colonnes autorisées
      [{ op: "insert", table: "ai_calls", values: { x: 1 } }],
      [{ op: "nettoyer", table: "tasks", id: 1 }],
      [],
      "tasks",
      null,
    ]) expect(parseUndoSteps(bad as never)).toBeNull();
  });
  it("un seul mauvais pas refuse tout le lot (rien n'est fait à moitié)", () => {
    expect(parseUndoSteps([{ op: "delete", table: "tasks", id: 1 }, { op: "delete", table: "secrets", id: 2 }])).toBeNull();
  });
  it("plafonne le nombre de pas", () => {
    expect(parseUndoSteps(Array.from({ length: 21 }, () => ({ op: "delete", table: "tasks", id: 1 })))).toBeNull();
  });
});

describe("parseDeleteRequest (suppression depuis un écran)", () => {
  it("par id, ou par date pour le sommeil et les pas", () => {
    expect(parseDeleteRequest({ table: "transactions", id: 12 })).toEqual({ table: "transactions", id: 12 });
    expect(parseDeleteRequest({ table: "sleep_logs", date: "2026-10-16" })).toEqual({ table: "sleep_logs", date: "2026-10-16" });
  });
  it("refuse une table interdite, une date sur une autre table, un id manquant", () => {
    expect(parseDeleteRequest({ table: "ai_calls", id: 1 })).toBeNull();
    expect(parseDeleteRequest({ table: "bank_connections", id: 1 })).toBeNull();
    expect(parseDeleteRequest({ table: "tasks", date: "2026-10-16" })).toBeNull();
    expect(parseDeleteRequest({ table: "tasks" })).toBeNull();
    expect(parseDeleteRequest({ table: "sleep_logs", date: "16/10/2026" })).toBeNull();
  });
});

describe("réponse + actions annulables dans le même flux", () => {
  const undo: Undo = { label: "Séance « Muscu »", steps: [{ op: "delete", table: "workouts", id: 7 }] };
  it("sépare le texte et les actions", () => {
    expect(splitReply(`C'est noté.${ACTIONS_MARK}${JSON.stringify([undo])}`)).toEqual({ text: "C'est noté.", actions: [undo] });
    expect(splitReply("Bonjour")).toEqual({ text: "Bonjour", actions: [] });
  });
  it("un trailer coupé ou piégé ne casse pas le texte et n'annule rien", () => {
    expect(splitReply(`Ok${ACTIONS_MARK}[{"label":"x","steps":[{"op":`)).toEqual({ text: "Ok", actions: [] });
    expect(splitReply(`Ok${ACTIONS_MARK}${JSON.stringify([{ label: "piège", steps: [{ op: "delete", table: "ai_calls", id: 1 }] }])}`).actions).toEqual([]);
  });
  it("libellé du bouton", () => {
    expect(undoLabel([undo])).toBe("Séance « Muscu »");
    expect(undoLabel([undo, undo, undo])).toBe("3 ajouts");
  });
});

describe("extractUndo (ce que voit le modèle, ce que voit l'écran)", () => {
  const undo = { label: "Tâche « Appeler »", steps: [{ op: "delete", table: "tasks", id: 3 }] };
  it("retire l'undo du résultat envoyé au modèle et le renvoie à part", () => {
    const r = extractUndo(JSON.stringify({ ok: true, result: { id: 3 }, undo }));
    expect(JSON.parse(r.result)).toEqual({ ok: true, result: { id: 3 } });
    expect(r.undo).toEqual(undo);
  });
  it("résultat sans undo, en erreur, ou pas en JSON : renvoyé tel quel", () => {
    for (const raw of [JSON.stringify({ ok: false, error: "x" }), JSON.stringify({ ok: true }), "pas du json"]) expect(extractUndo(raw)).toEqual({ result: raw });
  });
  it("un undo invalide n'est jamais transmis à l'écran", () => {
    const raw = JSON.stringify({ ok: true, undo: { label: "piège", steps: [{ op: "delete", table: "ai_calls", id: 1 }] } });
    expect(extractUndo(raw)).toEqual({ result: raw });
  });
});

describe("réglages d'appareil dans le flux", () => {
  const mark = String.fromCharCode(29);
  it("séparés du texte et des actions, sans casser splitReply", async () => {
    const { splitSettings, extractSetting } = await import("./undo");
    const undo: Undo = { label: "Tâche", steps: [{ op: "delete", table: "tasks", id: 3 }] };
    const raw = `Ok.${ACTIONS_MARK}${JSON.stringify([undo])}${mark}${JSON.stringify([{ name: "read_aloud", value: false }])}`;
    expect(splitSettings(raw).settings).toEqual([{ name: "read_aloud", value: false }]);
    expect(splitReply(raw)).toEqual({ text: "Ok.", actions: [undo] });
    expect(splitReply(`Ok.${mark}[{"name":"read_aloud","value":true}]`)).toEqual({ text: "Ok.", actions: [] });
    expect(extractSetting(JSON.stringify({ ok: true, setting: { name: "read_aloud", value: true } })).setting).toEqual({ name: "read_aloud", value: true });
  });
  it("refuse un réglage inconnu ou un flux coupé", async () => {
    const { splitSettings, extractSetting } = await import("./undo");
    expect(splitSettings(`x${mark}[{"name":"supprimer_tout","value":true}]`).settings).toEqual([]);
    expect(splitSettings(`x${mark}[{"name":"read_`).settings).toEqual([]);
    expect(extractSetting(JSON.stringify({ setting: { name: "autre", value: true } })).setting).toBeUndefined();
  });
});

describe("ordre des éléments en fin de flux (actions, réglages, cartes)", () => {
  it("splitReply ne montre rien des trailers, même avec une carte en toute fin", async () => {
    const { alarmCard, CARDS_MARK } = await import("./alarm");
    const card = alarmCard({ hour: 7, minutes: 0, label: "", when: "demain", warning: null });
    const mark = String.fromCharCode(29);
    const raw = `Ok.${ACTIONS_MARK}[]${mark}[{"name":"read_aloud","value":true}]${CARDS_MARK}${JSON.stringify([card])}`;
    expect(splitReply(raw).text).toBe("Ok.");
    const { splitSettings } = await import("./undo");
    const { splitCards } = await import("./alarm");
    expect(splitSettings(splitCards(raw).rest).settings).toEqual([{ name: "read_aloud", value: true }]);
  });
});
