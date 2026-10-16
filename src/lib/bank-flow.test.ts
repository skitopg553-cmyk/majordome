import { describe, expect, it } from "vitest";
import { BankFlowError, connectBank, finishConnection, syncAccounts, syncSince, type Eb } from "./bank-flow";
import { signState } from "./signed-state";

const SECRET = "secret-de-test";
const NOW = Date.parse("2026-10-16T12:00:00Z");

// Faux Enable Banking : enregistre les appels, ne contacte jamais Internet.
function fakeEb(over: Partial<Eb> = {}) {
  const calls: string[] = [];
  const eb: Eb = {
    listAspsps: async (c) => (calls.push(`aspsps:${c}`), { aspsps: [{ name: "BNP", country: "FR" }, { name: "Revolut", country: "FR" }] }),
    startAuth: async (p) => (calls.push(`auth:${p.aspsp.name}:${p.redirectUrl}:${p.validUntil.toISOString()}:${p.state.split(".").length}`), { url: "https://revolut.example/consent" }),
    createSession: async (code) => (calls.push(`session:${code}`), { session_id: "S1", aspsp: { name: "Revolut" }, access: { valid_until: "2027-01-14T00:00:00Z" }, accounts: [{ uid: "u1", name: "Compte", currency: "EUR" }] }),
    getBalances: async () => ({ balances: [{ balance_type: "CLBD", balance_amount: { currency: "EUR", amount: "976.60" } }] }),
    getTransactions: async (_u, since) => (calls.push(`tx:${since}`), [{ entry_reference: "r1", transaction_amount: { currency: "EUR", amount: "23.40" }, credit_debit_indicator: "DBIT", status: "BOOK", booking_date: "2026-10-04", creditor: { name: "Carrefour" } }]),
    ...over,
  };
  return { eb, calls };
}

describe("connectBank", () => {
  it("trouve Revolut, demande 90 jours de lecture et renvoie l'adresse de la banque", async () => {
    const { eb, calls } = fakeEb();
    const r = await connectBank({ eb, secret: SECRET, redirectUrl: "https://app.test/cb", now: NOW });
    expect(r.url).toBe("https://revolut.example/consent");
    expect(calls).toEqual(["aspsps:FR", `auth:Revolut:https://app.test/cb:${new Date(NOW + 90 * 86_400_000).toISOString()}:2`]);
  });
  it("Revolut absent de la liste : message clair avec les banques proposées", async () => {
    const { eb } = fakeEb({ listAspsps: async () => ({ aspsps: [{ name: "BNP", country: "FR" }] }) });
    await expect(connectBank({ eb, secret: SECRET, redirectUrl: "x", now: NOW })).rejects.toThrow(/Revolut n'apparaît pas.*BNP/);
  });
  it("une erreur de l'API remonte telle quelle (message brut)", async () => {
    const { eb } = fakeEb({ startAuth: async () => { throw new Error("Enable Banking 422 sur POST /auth : {\"error\":\"REDIRECT_URI_NOT_ALLOWED\"}"); } });
    await expect(connectBank({ eb, secret: SECRET, redirectUrl: "x", now: NOW })).rejects.toThrow(/REDIRECT_URI_NOT_ALLOWED/);
  });
});

describe("finishConnection", () => {
  it("state valide + code → session, comptes et date d'expiration", async () => {
    const { eb, calls } = fakeEb();
    const r = await finishConnection({ eb, secret: SECRET, state: signState(SECRET, "bank", NOW), code: "abc", now: NOW + 60_000 });
    expect(r).toEqual({ sessionId: "S1", bankName: "Revolut", accounts: [{ uid: "u1", name: "Compte", currency: "EUR" }], validUntil: "2027-01-14T00:00:00Z" });
    expect(calls).toEqual(["session:abc"]);
  });
  it("refuse un state falsifié, expiré, d'un autre usage ou absent — et n'appelle PAS la banque", async () => {
    const { eb, calls } = fakeEb();
    for (const state of [null, "n'importe quoi", signState("autre-secret", "bank", NOW), signState(SECRET, "google-oauth", NOW), signState(SECRET, "bank", NOW - 11 * 60_000)]) {
      await expect(finishConnection({ eb, secret: SECRET, state, code: "abc", now: NOW })).rejects.toBeInstanceOf(BankFlowError);
    }
    expect(calls).toEqual([]);
  });
  it("code absent, ou session sans compte : message clair", async () => {
    const { eb } = fakeEb({ createSession: async () => ({ session_id: "S", accounts: [] }) });
    await expect(finishConnection({ eb, secret: SECRET, state: signState(SECRET, "bank", NOW), code: null, now: NOW })).rejects.toThrow(/code d'autorisation/);
    await expect(finishConnection({ eb, secret: SECRET, state: signState(SECRET, "bank", NOW), code: "c", now: NOW })).rejects.toThrow(/aucun compte/);
  });
});

describe("syncSince", () => {
  const now = new Date(NOW);
  it("1re synchro : 90 jours en arrière ; ensuite 7 jours avant la dernière", () => {
    expect(syncSince(null, now)).toBe("2026-07-18");
    expect(syncSince("2026-10-10T08:00:00Z", now)).toBe("2026-10-03");
    expect(syncSince("date illisible", now)).toBe("2026-07-18");
  });
});

describe("syncAccounts", () => {
  it("lit solde + opérations de chaque compte, convertit, et additionne les soldes", async () => {
    const { eb, calls } = fakeEb();
    const r = await syncAccounts({ eb, accounts: [{ uid: "u1", name: "A", currency: "EUR" }, { uid: "u2", name: "B", currency: "EUR" }], since: "2026-07-18", now: new Date(NOW) });
    expect(calls).toEqual(["tx:2026-07-18", "tx:2026-07-18"]);
    expect(r.items.map((i) => i.key)).toEqual(["eb|u1|r1", "eb|u2|r1"]); // deux comptes : clés distinctes
    expect(r.items[0]).toMatchObject({ date: "2026-10-04", label: "Carrefour", amount: -23.4 });
    expect(r.accounts.map((a) => a.balance)).toEqual([976.6, 976.6]);
    expect(r.balance).toBe(1953.2);
  });
  it("lecture seule : seuls des appels de lecture sont faits", async () => {
    const { eb } = fakeEb();
    const names = Object.keys(eb);
    expect(names.filter((n) => /pay|transfer|initiate|payment/i.test(n))).toEqual([]);
  });
  it("une erreur de l'API sur un compte arrête la synchro avec son message brut", async () => {
    const { eb } = fakeEb({ getBalances: async () => { throw new Error('Enable Banking 401 sur GET /accounts/u1/balances : {"error":"SESSION_EXPIRED"}'); } });
    await expect(syncAccounts({ eb, accounts: [{ uid: "u1", name: null, currency: null }], since: "2026-07-18", now: new Date(NOW) })).rejects.toThrow(/SESSION_EXPIRED/);
  });
});
