import { afterEach, describe, expect, it, vi } from "vitest";
import { alarmCard, timerCard } from "./alarm";
import { isNative, nativeParams, setNative } from "./native-alarm";

const setCap = (cap: unknown) => vi.stubGlobal("window", cap === undefined ? {} : { Capacitor: cap });
afterEach(() => vi.unstubAllGlobals());

describe("dans le navigateur (hors coque) : rien ne change", () => {
  it("pas de Capacitor → pas natif, et setNative échoue proprement (la carte reste le repli)", async () => {
    setCap(undefined);
    expect(isNative()).toBe(false);
    expect(await setNative({ kind: "alarm", hour: 7, minutes: 0, label: "", when: "demain" })).toMatchObject({ ok: false, text: "Je n'ai pas réussi à régler le réveil." });
  });
  it("plateforme web de Capacitor → pas natif", () => {
    setCap({ isNativePlatform: () => false, Plugins: {} });
    expect(isNative()).toBe(false);
  });
});

describe("dans la coque Android", () => {
  const alarm = vi.fn();
  const timer = vi.fn();
  const native = () => setCap({ isNativePlatform: () => true, Plugins: { Alarm: { setAlarm: alarm, setTimer: timer } } });

  it("réveil : l'heure réellement envoyée à l'Horloge = celle de la phrase de confirmation", async () => {
    native();
    alarm.mockResolvedValue({ ok: true });
    const r = await setNative({ kind: "alarm", hour: 7, minutes: 30, label: "Salle", when: "demain" });
    expect(alarm).toHaveBeenCalledWith({ hour: 7, minutes: 30, message: "Salle" });
    expect(r).toEqual({ ok: true, text: "Ok, réveil réglé à sept heures trente." });
  });
  it("minuteur", async () => {
    native();
    timer.mockResolvedValue({ ok: true });
    expect(await setNative({ kind: "timer", seconds: 300, label: "" })).toEqual({ ok: true, text: "Minuteur de cinq minutes lancé." });
    expect(timer).toHaveBeenCalledWith({ seconds: 300, message: "" });
  });
  it("le plugin renvoie une erreur → « Je n'ai pas réussi… », jamais « c'est fait »", async () => {
    native();
    alarm.mockRejectedValue(new Error("Aucune application Horloge ne peut régler ça"));
    const r = await setNative({ kind: "alarm", hour: 7, minutes: 0, label: "", when: "demain" });
    expect(r).toMatchObject({ ok: false, text: "Je n'ai pas réussi à régler le réveil.", reason: "Aucune application Horloge ne peut régler ça" });
    timer.mockResolvedValue({ ok: false });
    expect(await setNative({ kind: "timer", seconds: 60, label: "" })).toMatchObject({ ok: false, text: "Je n'ai pas réussi à lancer le minuteur." });
  });
  it("plugin absent de la coque → échec propre", async () => {
    setCap({ isNativePlatform: () => true, Plugins: {} });
    expect(await setNative({ kind: "timer", seconds: 60, label: "" })).toMatchObject({ ok: false, reason: "plugin absent" });
  });
});

describe("nativeParams", () => {
  it("ne garde que les cartes qui portent leurs paramètres", () => {
    const a = alarmCard({ hour: 7, minutes: 0, label: "", when: "demain", warning: null });
    const t = timerCard({ seconds: 60, label: "" });
    expect(nativeParams([a, t, { ...a, params: undefined }])).toEqual([a.params, t.params]);
  });
});
