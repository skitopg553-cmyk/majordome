import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { checkCron, isRecurringHour } from "./cron-auth";

const req = (secret?: string) => new Request("http://x.test", { method: "POST", headers: secret === undefined ? {} : { "x-cron-secret": secret } });

describe("checkCron (secret des tâches planifiées)", () => {
  const old = process.env.CRON_SECRET;
  beforeEach(() => (process.env.CRON_SECRET = "un-secret-long-et-aleatoire"));
  afterEach(() => (process.env.CRON_SECRET = old));
  it("bon secret → ok ; mauvais, vide ou absent → refusé", () => {
    expect(checkCron(req("un-secret-long-et-aleatoire"))).toBe("ok");
    for (const bad of ["faux", "", "x".repeat(500)]) expect(checkCron(req(bad))).toBe("denied");
    expect(checkCron(req())).toBe("denied");
  });
  it("sans CRON_SECRET configuré : la route est désactivée", () => {
    delete process.env.CRON_SECRET;
    expect(checkCron(req("n'importe quoi"))).toBe("off");
  });
});

describe("isRecurringHour : 4 h à Paris, été comme hiver", () => {
  it("été (UTC+2) : 02:05 UTC oui, 03:05 UTC non", () => {
    expect(isRecurringHour(new Date("2026-07-15T02:05:00Z"))).toBe(true);
    expect(isRecurringHour(new Date("2026-07-15T03:05:00Z"))).toBe(false);
  });
  it("hiver (UTC+1) : 03:05 UTC oui, 02:05 UTC non", () => {
    expect(isRecurringHour(new Date("2026-12-15T03:05:00Z"))).toBe(true);
    expect(isRecurringHour(new Date("2026-12-15T02:05:00Z"))).toBe(false);
  });
});
