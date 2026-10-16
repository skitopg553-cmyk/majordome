import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { denied, limiter } from "./access";

const req = (code?: string, ip = "1.1.1.1") => new Request("http://x.test", { headers: { "x-forwarded-for": ip, ...(code === undefined ? {} : { "x-access-code": code }) } });

describe("denied (code d'accès)", () => {
  const old = process.env.MAJORDOME_ACCESS_CODE;
  beforeEach(() => {
    process.env.MAJORDOME_ACCESS_CODE = "une longue phrase secrète";
    limiter.reset();
  });
  afterEach(() => (process.env.MAJORDOME_ACCESS_CODE = old));

  it("laisse passer le bon code", () => expect(denied(req("une longue phrase secrète"))).toBe(false));
  it("refuse un mauvais code, un code vide ou absent", () => {
    expect(denied(req("une longue phrase secrete"))).toBe(true);
    expect(denied(req(""))).toBe(true);
    expect(denied(req())).toBe(true);
    expect(denied(req("x".repeat(500)))).toBe(true); // longueur différente : pas d'exception
  });
  it("refuse tout si le code n'est pas configuré", () => {
    delete process.env.MAJORDOME_ACCESS_CODE;
    expect(denied(req(""))).toBe(true);
    expect(denied(req("n'importe quoi"))).toBe(true);
  });

  it("5 mauvais codes → même le bon code est refusé pendant l'attente, mais pas pour une autre adresse", () => {
    for (let i = 0; i < 5; i++) expect(denied(req("faux" + i))).toBe(true);
    expect(denied(req("une longue phrase secrète"))).toBe(true);
    expect(denied(req("une longue phrase secrète", "2.2.2.2"))).toBe(false);
  });
  it("un en-tête vide ou absent ne compte pas comme un essai ; un bon code remet le compteur à zéro", () => {
    for (let i = 0; i < 10; i++) denied(req());
    expect(denied(req("une longue phrase secrète"))).toBe(false);
    for (let i = 0; i < 4; i++) denied(req("faux"));
    expect(denied(req("une longue phrase secrète"))).toBe(false); // le 5e essai est le bon : pas de verrou
    for (let i = 0; i < 4; i++) denied(req("faux"));
    expect(denied(req("une longue phrase secrète"))).toBe(false);
  });
});
