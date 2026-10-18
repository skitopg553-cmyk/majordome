import { describe, expect, it } from "vitest";
import { alarmCard, alarmUrl, CARDS_MARK, durationLabel, extractCard, isCard, resolveAlarm, resolveTimer, splitCards, timerCard, timerUrl } from "./alarm";

const now = new Date("2026-10-16T10:30:00+02:00"); // vendredi 10 h 30, Paris

describe("resolveAlarm : l'heure est calculée en code", () => {
  it("heure précise : aujourd'hui si elle n'est pas passée, sinon demain (Android sonne à la prochaine occurrence)", () => {
    expect(resolveAlarm({ hour: 14, minutes: 15, label: "Dentiste" }, now)).toMatchObject({ ok: true, value: { hour: 14, minutes: 15, when: "aujourd'hui", warning: null } });
    expect(resolveAlarm({ hour: 7, minutes: 30 }, now)).toMatchObject({ value: { when: "demain" } });
  });
  it("« demain 7 h » avant 7 h : on prévient que ça sonnera aujourd'hui", () => {
    const early = new Date("2026-10-16T05:00:00+02:00");
    const r = resolveAlarm({ hour: 7, day: "tomorrow" }, early);
    expect(r).toMatchObject({ ok: true, value: { when: "aujourd'hui" } });
    expect(r.ok && r.value.warning).toContain("aujourd'hui");
    expect(resolveAlarm({ hour: 7, day: "tomorrow" }, now)).toMatchObject({ value: { when: "demain", warning: null } });
  });
  it("« dans 20 minutes », y compris en passant minuit", () => {
    expect(resolveAlarm({ in_minutes: 20 }, now)).toMatchObject({ value: { hour: 10, minutes: 50, when: "aujourd'hui" } });
    const late = new Date("2026-10-16T23:50:00+02:00");
    expect(resolveAlarm({ in_minutes: 20 }, late)).toMatchObject({ value: { hour: 0, minutes: 10, when: "demain" } });
  });
  it("refuse l'invalide", () => {
    for (const bad of [{ hour: 24 }, { hour: -1 }, { hour: 7, minutes: 60 }, { hour: "7" }, {}, { in_minutes: 0 }, { in_minutes: 5000 }]) expect(resolveAlarm(bad, now).ok).toBe(false);
  });
});

describe("resolveTimer", () => {
  it("additionne heures, minutes, secondes", () => {
    expect(resolveTimer({ minutes: 20, label: "Pâtes" })).toEqual({ ok: true, value: { seconds: 1200, label: "Pâtes" } });
    expect(resolveTimer({ hours: 1, minutes: 30, seconds: 15 })).toMatchObject({ value: { seconds: 5415 } });
  });
  it("refuse 0, négatif, plus de 24 h", () => {
    for (const bad of [{}, { minutes: 0 }, { minutes: -5 }, { hours: 25 }, { minutes: "dix" }]) expect(resolveTimer(bad).ok).toBe(false);
    expect(durationLabel(5415)).toBe("1 h 30 min 15 s");
  });
});

describe("liens Android", () => {
  it("réveil et minuteur : exactement les formats demandés", () => {
    expect(alarmUrl(7, 30, "Salle")).toBe("intent:#Intent;action=android.intent.action.SET_ALARM;i.android.intent.extra.alarm.HOUR=7;i.android.intent.extra.alarm.MINUTES=30;S.android.intent.extra.alarm.MESSAGE=Salle;end");
    expect(timerUrl(1200, "Pâtes")).toBe("intent:#Intent;action=android.intent.action.SET_TIMER;i.android.intent.extra.alarm.LENGTH=1200;S.android.intent.extra.alarm.MESSAGE=P%C3%A2tes;end");
  });
  it("un libellé piégé (; = espaces) est encodé : il ne peut pas casser ni détourner le lien", () => {
    const url = alarmUrl(7, 0, "x;end;S.evil=1 a=b");
    expect(url.split(";").filter((p) => p.startsWith("S."))).toHaveLength(1);
    expect(url).not.toContain("evil=1");
    expect(isCard({ kind: "alarm", title: "t", detail: "d", url })).toBe(true);
  });
});

describe("cartes dans le flux", () => {
  const card = alarmCard({ hour: 7, minutes: 30, label: "Salle", when: "demain", warning: null });
  it("carte réveil / minuteur lisibles", () => {
    expect(card).toMatchObject({ kind: "alarm", title: "Créer le réveil", detail: "07:30 · demain · Salle" });
    expect(timerCard({ seconds: 1200, label: "" })).toMatchObject({ kind: "timer", detail: "20 min" });
  });
  it("splitCards sépare le texte ; un lien autre que l'Horloge est refusé ; flux coupé ignoré", () => {
    expect(splitCards(`Ok${CARDS_MARK}${JSON.stringify([card])}`)).toEqual({ rest: "Ok", cards: [card] });
    const evil = { ...card, url: "https://evil.example/phishing" };
    expect(splitCards(`Ok${CARDS_MARK}${JSON.stringify([evil, { ...card, url: "intent:#Intent;action=android.intent.action.CALL;end" }])}`).cards).toEqual([]);
    expect(splitCards(`Ok${CARDS_MARK}[{"kind":"al`)).toEqual({ rest: "Ok", cards: [] });
    expect(splitCards("Ok")).toEqual({ rest: "Ok", cards: [] });
  });
  it("extractCard retire la carte du résultat d'outil (le modèle n'en a pas besoin)", () => {
    const raw = JSON.stringify({ ok: true, card });
    const r = extractCard(raw);
    expect(r.card).toEqual(card);
    expect(JSON.parse(r.result).card).toBeUndefined();
    expect(extractCard("pas du json").card).toBeUndefined();
  });
});
