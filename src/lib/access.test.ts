import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { denied } from "./access";

const req = (code?: string) => new Request("http://x.test", { headers: code === undefined ? {} : { "x-access-code": code } });

describe("denied (code d'accès)", () => {
  const old = process.env.MAJORDOME_ACCESS_CODE;
  beforeEach(() => (process.env.MAJORDOME_ACCESS_CODE = "une longue phrase secrète"));
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
});
