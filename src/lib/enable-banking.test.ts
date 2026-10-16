import { createPublicKey, createVerify, generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { EnableBankingError, findRevolut, getTransactions, normalizePem, signJwt, startAuth, ebRequest } from "./enable-banking";

// Clé de TEST générée à la volée : aucune vraie clé n'est jamais écrite dans les tests.
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
const NOW = 1_800_000_000_000;
const decode = (s: string) => JSON.parse(Buffer.from(s, "base64url").toString("utf8"));

describe("signJwt", () => {
  const jwt = signJwt("app-123", privateKey, NOW);
  const [h, c, s] = jwt.split(".");

  it("en-tête RS256 avec kid = App ID", () => expect(decode(h)).toEqual({ typ: "JWT", alg: "RS256", kid: "app-123" }));
  it("claims : iss, aud, iat et exp ≤ 1 h", () => {
    const claims = decode(c);
    expect(claims).toMatchObject({ iss: "enablebanking.com", aud: "api.enablebanking.com", iat: NOW / 1000 });
    expect(claims.exp - claims.iat).toBeGreaterThan(0);
    expect(claims.exp - claims.iat).toBeLessThanOrEqual(3600);
  });
  it("la signature se vérifie avec la clé publique", () => {
    expect(createVerify("RSA-SHA256").update(`${h}.${c}`).verify(createPublicKey(publicKey), Buffer.from(s, "base64url"))).toBe(true);
  });
  it("une signature falsifiée est refusée", () => {
    const bad = decode(c);
    bad.exp += 1;
    const forged = Buffer.from(JSON.stringify(bad)).toString("base64url");
    expect(createVerify("RSA-SHA256").update(`${h}.${forged}`).verify(createPublicKey(publicKey), Buffer.from(s, "base64url"))).toBe(false);
  });
});

describe("normalizePem (clé dans une variable d'environnement)", () => {
  it("transforme les « \\n » écrits à la main en vrais retours à la ligne et retire les guillemets", () => {
    const oneLine = `"${privateKey.trim().replace(/\n/g, "\\n")}"`;
    expect(normalizePem(oneLine)).toBe(privateKey.trim());
    expect(() => signJwt("a", oneLine, NOW)).not.toThrow(); // et la signature marche avec cette forme
  });
});

describe("ebRequest", () => {
  const env = { ENABLE_BANKING_APP_ID: "app-123", ENABLE_BANKING_PRIVATE_KEY: privateKey };
  const reply = (status: number, body: string) => async () => new Response(body, { status });

  it("envoie le JWT dans Authorization et construit l'URL avec les paramètres", async () => {
    let seen: { url: string; auth: string } | null = null;
    const fetchFn = (async (url: string, init: RequestInit) => {
      seen = { url, auth: (init.headers as Record<string, string>).Authorization };
      return new Response('{"ok":true}');
    }) as unknown as typeof fetch;
    await ebRequest("/aspsps", { query: { country: "FR", vide: undefined } }, { env, fetch: fetchFn, now: () => NOW });
    expect(seen!.url).toBe("https://api.enablebanking.com/aspsps?country=FR");
    expect(seen!.auth).toMatch(/^Bearer [\w-]+\.[\w-]+\.[\w-]+$/);
  });

  it("renvoie la réponse BRUTE de l'API en cas d'erreur, sans jamais citer le JWT", async () => {
    const err = await ebRequest("/sessions", { method: "POST", body: { code: "x" } }, { env, fetch: reply(422, '{"message":"code expired","error":"INVALID_CODE"}') as never }).catch((e) => e);
    expect(err).toBeInstanceOf(EnableBankingError);
    expect(err.message).toContain('{"message":"code expired","error":"INVALID_CODE"}');
    expect(err.message).toContain("422");
    expect(err.message).not.toContain("Bearer");
    expect(err.status).toBe(422);
  });

  it("variables manquantes ou clé illisible : message clair, sans fuite de la clé", async () => {
    await expect(ebRequest("/x", {}, { env: {} })).rejects.toThrow(/manquant/);
    const err = await ebRequest("/x", {}, { env: { ...env, ENABLE_BANKING_PRIVATE_KEY: "pas une clé SECRET-123" }, fetch: reply(200, "{}") as never }).catch((e) => e);
    expect(err.message).toMatch(/illisible/);
    expect(err.message).not.toContain("SECRET-123");
  });

  it("une réponse qui n'est pas du JSON est signalée avec son contenu", async () => {
    await expect(ebRequest("/x", {}, { env, fetch: reply(200, "<html>oups</html>") as never })).rejects.toThrow(/pas du JSON.*oups/);
  });
});

describe("startAuth", () => {
  it("envoie access.valid_until, la banque, le state, l'URL de retour et psu_type « personal »", async () => {
    let body: Record<string, unknown> = {};
    const fetchFn = (async (_u: string, init: RequestInit) => {
      body = JSON.parse(String(init.body));
      return new Response('{"url":"https://bank.example/auth"}');
    }) as unknown as typeof fetch;
    const r = await startAuth(
      { aspsp: { name: "Revolut", country: "FR" }, state: "st", redirectUrl: "https://app.test/cb", validUntil: new Date("2027-01-01T00:00:00Z") },
      { env: { ENABLE_BANKING_APP_ID: "a", ENABLE_BANKING_PRIVATE_KEY: privateKey }, fetch: fetchFn },
    );
    expect(r.url).toBe("https://bank.example/auth");
    expect(body).toEqual({ access: { valid_until: "2027-01-01T00:00:00.000Z" }, aspsp: { name: "Revolut", country: "FR" }, state: "st", redirect_url: "https://app.test/cb", psu_type: "personal" });
  });
});

describe("findRevolut", () => {
  it("préfère « Revolut » exact, accepte un nom qui le contient, sinon null", () => {
    expect(findRevolut([{ name: "Revolut Business", country: "FR" }, { name: "Revolut", country: "FR" }])?.name).toBe("Revolut");
    expect(findRevolut([{ name: "Revolut Bank UAB", country: "FR" }])?.name).toBe("Revolut Bank UAB");
    expect(findRevolut([{ name: "BNP", country: "FR" }])).toBeNull();
  });
});

describe("getTransactions : pagination", () => {
  const env = { ENABLE_BANKING_APP_ID: "a", ENABLE_BANKING_PRIVATE_KEY: privateKey };
  it("suit la continuation_key jusqu'à la dernière page, en BOOK seulement", async () => {
    const urls: string[] = [];
    const pages = [{ transactions: [{ entry_reference: "1" }], continuation_key: "k1" }, { transactions: [{ entry_reference: "2" }], continuation_key: "k2" }, { transactions: [{ entry_reference: "3" }], continuation_key: null }];
    const fetchFn = (async (url: string) => {
      urls.push(url);
      return new Response(JSON.stringify(pages[urls.length - 1]));
    }) as unknown as typeof fetch;
    const all = await getTransactions("uid/1", "2026-07-01", { env, fetch: fetchFn });
    expect(all.map((t) => t.entry_reference)).toEqual(["1", "2", "3"]);
    expect(urls).toHaveLength(3);
    expect(urls[0]).toContain("/accounts/uid%2F1/transactions?date_from=2026-07-01&transaction_status=BOOK");
    expect(urls[1]).toContain("continuation_key=k1");
    expect(urls[2]).toContain("continuation_key=k2");
  });
  it("s'arrête par sécurité si l'API ne finit jamais", async () => {
    const fetchFn = (async () => new Response('{"transactions":[],"continuation_key":"encore"}')) as unknown as typeof fetch;
    await expect(getTransactions("u", "2026-07-01", { env, fetch: fetchFn })).rejects.toThrow(/Plus de 20 pages/);
  });
});
