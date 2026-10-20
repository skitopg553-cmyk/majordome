import { describe, expect, it } from "vitest";
import type { StoredRule } from "./recurrence";
import { displayReply, parseSlotAction, recapText, daysLabel, endOfWeek, occurrencesOn, oneOffRecap, parseDays, parseHour, parseSlot, sameSlot, slotRecap, type SlotException } from "./slots";

describe("parseDays : les jours sont validés en code", () => {
  it.each([
    [["lundi", "mercredi", "vendredi"], "1,3,5"],
    ["lundi-vendredi", "1,2,3,4,5"],
    ["du lundi au vendredi", "1,2,3,4,5"],
    ["Tous les jours", "1,2,3,4,5,6,7"],
    [["Mardis", "lundi", "lundi"], "1,2"],
    [["dimanche"], "7"],
  ])("%j", (input, out) => expect(parseDays(input)).toEqual({ ok: true, value: out }));
  it("refuse l'inconnu et propose une question", () => {
    for (const bad of [[], "", "la semaine", ["lundi", "funday"], "vendredi-lundi", 3, null]) expect(parseDays(bad)).toMatchObject({ ok: false });
    expect((parseDays("souvent") as { error: string }).error).toMatch(/UNE question/);
  });
});

describe("parseHour / parseSlot", () => {
  it("heures", () => {
    expect(parseHour("9h")).toEqual({ ok: true, value: "09:00" });
    expect(parseHour("18h30")).toEqual({ ok: true, value: "18:30" });
    expect(parseHour("9:05")).toEqual({ ok: true, value: "09:05" });
    for (const bad of ["25h", "9h75", "midi", "", 9]) expect(parseHour(bad).ok).toBe(false);
  });
  it("créneau complet ; fin avant début refusée ; habitude", () => {
    expect(parseSlot({ title: " Travail ", days: "lundi-vendredi", start: "9h", end: "17h" })).toEqual({ ok: true, value: { title: "Travail", days: "1,2,3,4,5", start: "09:00", end: "17:00", habit: false } });
    expect(parseSlot({ title: "Salle", days: ["lundi"], start: "18:00", end: "20:00", habit: true })).toMatchObject({ ok: true, value: { habit: true } });
    expect(parseSlot({ title: "Boxe", days: ["mardi"], start: "18:30" })).toMatchObject({ ok: true, value: { end: null } });
    expect(parseSlot({ title: "X", days: ["lundi"], start: "17:00", end: "09:00" }).ok).toBe(false);
    expect(parseSlot({ title: "", days: ["lundi"], start: "09:00" }).ok).toBe(false);
  });
});

describe("récapitulatif écrit par le code", () => {
  it("jours et heures lisibles (lu à voix haute ensuite)", () => {
    expect(daysLabel("1,2,3,4,5")).toBe("lundi-vendredi");
    expect(daysLabel("1,3,5")).toBe("lundi, mercredi, vendredi");
    expect(daysLabel("1,2,3,4,5,6,7")).toBe("tous les jours");
    expect(daysLabel("2")).toBe("mardi");
    expect(slotRecap({ title: "Travail", days: "1,2,3,4,5", start: "09:00", end: "17:00", habit: false })).toBe("Travail lundi-vendredi 9 h-17 h");
    expect(slotRecap({ title: "Salle", days: "1,3,5", start: "18:00", end: "20:00", habit: true })).toBe("Salle lundi, mercredi, vendredi 18 h-20 h (habitude à confirmer)");
    expect(slotRecap({ title: "Otacos", days: "5", start: "18:30", end: "23:00", habit: false })).toBe("Otacos vendredi 18 h 30-23 h");
  });
  it("ponctuel : date et « une seule fois »", () => {
    expect(oneOffRecap("Dîner avec Arthur", "2026-10-19T18:00:00.000Z", null)).toBe("Dîner avec Arthur lundi 19 octobre 20 h, une seule fois");
  });
  it("doublon : même titre (sans accents ni casse), mêmes jours, même début", () => {
    expect(sameSlot({ title: "Travail", days: "1,2,3,4,5", at_time: "09:00" }, { title: "travail", days: "1,2,3,4,5", start: "09:00" })).toBe(true);
    expect(sameSlot({ title: "Travail", days: "1,2,3,4,5", at_time: "09:00" }, { title: "Travail", days: "1,2,3,4", start: "09:00" })).toBe(false);
  });
});

const rule = (o: Partial<StoredRule> = {}): StoredRule => ({ id: 1, title: "Travail", kind: "weekly", weekday: null, days: "1,2,3,4,5", month_day: null, at_time: "09:00", end_time: "17:00", habit: false, last_generated: null, created_at: "2026-10-19T08:00:00Z", ...o });

describe("occurrencesOn : récurrences calculées à l'affichage", () => {
  it("les semaines FUTURES sont visibles tout de suite (rien n'est créé jour par jour)", () => {
    const monNext = occurrencesOn([rule()], [], "2026-10-26");
    expect(monNext).toHaveLength(1);
    expect(monNext[0]).toMatchObject({ title: "Travail", start: "2026-10-26T08:00:00.000Z", end: "2026-10-26T16:00:00.000Z" }); // heure d'hiver (UTC+1) le 26/10
    expect(occurrencesOn([rule()], [], "2026-10-24")).toEqual([]); // samedi
  });
  it("rien avant le jour de création de la règle", () => {
    expect(occurrencesOn([rule()], [], "2026-10-16")).toEqual([]);
    expect(occurrencesOn([rule()], [], "2026-10-19")).toHaveLength(1);
  });
  it("une règle sans heure n'est pas un créneau", () => {
    expect(occurrencesOn([rule({ at_time: null })], [], "2026-10-20")).toEqual([]);
  });
  it("supprimer UNE occurrence ne touche pas la série", () => {
    const exc: SlotException[] = [{ rule_id: 1, day: "2026-10-21", action: "skip", new_day: null, new_start: null, new_end: null }];
    expect(occurrencesOn([rule()], exc, "2026-10-21")).toEqual([]);
    expect(occurrencesOn([rule()], exc, "2026-10-22")).toHaveLength(1);
  });
  it("déplacer UNE occurrence : disparaît du jour d'origine, apparaît au nouveau (heures changées ou non)", () => {
    const exc: SlotException[] = [{ rule_id: 1, day: "2026-10-21", action: "move", new_day: "2026-10-24", new_start: "10:00", new_end: "12:00" }];
    expect(occurrencesOn([rule()], exc, "2026-10-21")).toEqual([]);
    const moved = occurrencesOn([rule()], exc, "2026-10-24");
    expect(moved).toHaveLength(1);
    expect(moved[0]).toMatchObject({ moved: true, key: "1:2026-10-21", start: "2026-10-24T08:00:00.000Z", end: "2026-10-24T10:00:00.000Z" }); // 10 h-12 h Paris (heure d'été jusqu'au 25/10)
  });
  it("trié par heure ; changement d'heure : toujours 9 h à Paris", () => {
    const a = occurrencesOn([rule({ id: 2, title: "Salle", at_time: "18:00", end_time: "20:00" }), rule()], [], "2026-10-26");
    expect(a.map((o) => o.title)).toEqual(["Travail", "Salle"]);
    expect(occurrencesOn([rule()], [], "2026-10-23")[0].start).toBe("2026-10-23T07:00:00.000Z"); // été
    expect(occurrencesOn([rule()], [], "2026-10-26")[0].start).toBe("2026-10-26T08:00:00.000Z"); // hiver
  });
});

describe("endOfWeek", () => {
  it("dimanche de la semaine", () => {
    expect(endOfWeek("2026-10-19")).toBe("2026-10-25");
    expect(endOfWeek("2026-10-25")).toBe("2026-10-25");
    expect(endOfWeek("2026-10-23")).toBe("2026-10-25");
  });
});

describe("recapText", () => {
  it("liste exacte à partir de deux éléments, sans doublon ; rien pour un seul", () => {
    expect(recapText(["Travail lundi-vendredi 9 h-17 h", "Salle lundi, mercredi, vendredi 18 h-20 h", "Travail lundi-vendredi 9 h-17 h"])).toBe("C'est noté, Monsieur :\n- Travail lundi-vendredi 9 h-17 h\n- Salle lundi, mercredi, vendredi 18 h-20 h");
    expect(recapText(["Seul"])).toBe("C'est noté, Monsieur. Seul");
    expect(recapText([])).toBe("");
  });
});

describe("parseSlotAction", () => {
  const today = "2026-10-19";
  it("skip, move, habit valides", () => {
    expect(parseSlotAction({ action: "skip", rule_id: 3, day: "2026-10-21" }, today)).toMatchObject({ ok: true });
    expect(parseSlotAction({ action: "move", rule_id: 3, day: "2026-10-21", new_day: "2026-10-24", new_start: "10h", new_end: "12:00" }, today)).toEqual({ ok: true, value: { action: "move", rule_id: 3, day: "2026-10-21", new_day: "2026-10-24", new_start: "10:00", new_end: "12:00" } });
    expect(parseSlotAction({ action: "habit", rule_id: 3, day: "2026-10-18", status: "missed", then: "tomorrow" }, today)).toMatchObject({ ok: true, value: { then: "tomorrow" } });
    expect(parseSlotAction({ action: "habit", rule_id: 3, day: "2026-10-18", status: "done", then: "week" }, today)).toMatchObject({ ok: true, value: { then: null } }); // pas de reprogrammation après un « oui »
  });
  it("refuse l'invalide : jour futur pour un bilan, jour irréel, fin avant début, id absurde", () => {
    for (const bad of [
      { action: "habit", rule_id: 3, day: "2026-10-20", status: "done" },
      { action: "skip", rule_id: 3, day: "2026-02-30" },
      { action: "move", rule_id: 3, day: "2026-10-21", new_day: "2026-10-24", new_start: "10:00", new_end: "09:00" },
      { action: "skip", rule_id: -1, day: "2026-10-21" },
      { action: "supprimer", rule_id: 3, day: "2026-10-21" },
      { action: "habit", rule_id: 3, day: "2026-10-18", status: "peut-être" },
    ]) expect(parseSlotAction(bad as never, today).ok).toBe(false);
  });
});

describe("displayReply", () => {
  it("retire le « OK » devant « C'est noté, Monsieur », garde le reste", () => {
    expect(displayReply("OK\n\nC'est noté, Monsieur. Cours lundi 9 h-12 h")).toBe("C'est noté, Monsieur. Cours lundi 9\u00a0h\u201112\u00a0h");
    expect(displayReply("OK, je regarde.")).toBe("OK, je regarde.");
    expect(displayReply("D'accord.\nC'est noté, Monsieur :\n- Boxe")).toBe("C'est noté, Monsieur :\n- Boxe");
  });
  it("une heure ne se coupe plus : « 19 h-20 h 30 » reste d'un bloc", () => {
    expect(displayReply("Boxe 19 h-20 h 30")).toBe("Boxe 19\u00a0h\u201120\u00a0h\u00a030");
    expect(displayReply("lundi-vendredi")).toBe("lundi-vendredi");
  });
});
