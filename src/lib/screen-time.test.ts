import { describe, expect, it } from "vitest";
import { minutesLabel, parseScreenTime, screenTrend, type ScreenRow } from "./screen-time";

const now = new Date("2026-10-16T10:00:00+02:00");

describe("parseScreenTime", () => {
  it("heures, minutes ou les deux", () => {
    expect(parseScreenTime({ hours: 4 }, now)).toEqual({ ok: true, value: { date: "2026-10-16", minutes: 240 } });
    expect(parseScreenTime({ hours: 2, minutes: 30 }, now)).toMatchObject({ value: { minutes: 150 } });
    expect(parseScreenTime({ minutes: 45, date: "2026-10-15" }, now)).toMatchObject({ value: { date: "2026-10-15", minutes: 45 } });
    expect(parseScreenTime({ hours: 3.5 }, now)).toMatchObject({ value: { minutes: 210 } });
  });
  it("refuse l'absurde", () => {
    for (const bad of [{}, { hours: -1 }, { hours: 25 }, { hours: "4" }, { minutes: NaN }, { hours: 2, date: "2026-10-20" }]) expect(parseScreenTime(bad, now).ok).toBe(false);
  });
  it("libellé", () => {
    expect(minutesLabel(240)).toBe("4 h");
    expect(minutesLabel(150)).toBe("2 h 30");
    expect(minutesLabel(125)).toBe("2 h 05");
    expect(minutesLabel(45)).toBe("45 min");
  });
});

describe("screenTrend : 7 derniers jours vs 7 précédents", () => {
  const today = "2026-10-16";
  const row = (date: string, minutes: number): ScreenRow => ({ date, minutes });
  it("baisse : − et pourcentage arrondi", () => {
    // 7 derniers jours (10 → 16) : 246 min ; 7 précédents (3 → 9) : 300 min → −18 %
    const rows = [row("2026-10-16", 246), row("2026-10-10", 246), row("2026-10-09", 300), row("2026-10-03", 300)];
    expect(screenTrend(rows, today)).toEqual({ current: 246, previous: 300, pct: -18, direction: "down", label: "−18 % vs semaine dernière" });
  });
  it("hausse, stable", () => {
    expect(screenTrend([row("2026-10-16", 330), row("2026-10-09", 300)], today)).toMatchObject({ pct: 10, direction: "up", label: "+10 % vs semaine dernière" });
    expect(screenTrend([row("2026-10-16", 300), row("2026-10-09", 300)], today)).toMatchObject({ pct: 0, direction: "flat" });
  });
  it("moyenne sur les jours renseignés seulement", () => {
    const t = screenTrend([row("2026-10-16", 200), row("2026-10-15", 400), row("2026-10-08", 300)], today)!;
    expect(t.current).toBe(300);
  });
  it("null sans données d'un côté, ou référence à 0", () => {
    expect(screenTrend([row("2026-10-16", 100)], today)).toBeNull();
    expect(screenTrend([row("2026-10-08", 100)], today)).toBeNull();
    expect(screenTrend([row("2026-10-16", 100), row("2026-10-08", 0)], today)).toBeNull();
    expect(screenTrend([], today)).toBeNull();
  });
  it("les bornes : le 9 est dans la semaine précédente, le 10 dans la courante", () => {
    const t = screenTrend([row("2026-10-10", 100), row("2026-10-09", 200)], today)!;
    expect(t).toMatchObject({ current: 100, previous: 200 });
  });
});
