// Client serveur Enable Banking (https://api.enablebanking.com). LECTURE SEULE : on ne crée jamais de paiement.
// Authentification : un JWT RS256 signé avec la clé privée de l'application, renvoyé à chaque requête (Authorization: Bearer …).
// Aucun secret n'est écrit dans les logs ni dans les messages d'erreur : ni la clé, ni le JWT.
import { createSign } from "node:crypto";

export const EB_API = "https://api.enablebanking.com";
const JWT_LIFETIME_S = 3300; // 55 min : sous la limite d'1 h, avec une marge pour les horloges décalées

const b64url = (v: string | Buffer) => Buffer.from(v).toString("base64url");

/**
 * Remet la clé PEM sous sa forme normale. Dans une variable d'environnement, les retours à la ligne sont souvent
 * écrits « \n » (deux caractères), ou la clé est entourée de guillemets : on gère les deux.
 */
export function normalizePem(raw: string) {
  return raw.trim().replace(/^["']|["']$/g, "").replace(/\\n/g, "\n").trim();
}

/** JWT RS256 : en-tête { typ, alg, kid = App ID }, claims { iss, aud, iat, exp }. `now` en millisecondes (injectable pour les tests). */
export function signJwt(appId: string, privateKeyPem: string, now = Date.now()) {
  const iat = Math.floor(now / 1000);
  const header = { typ: "JWT", alg: "RS256", kid: appId };
  const claims = { iss: "enablebanking.com", aud: "api.enablebanking.com", iat, exp: iat + JWT_LIFETIME_S };
  const body = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  const sig = createSign("RSA-SHA256").update(body).sign(normalizePem(privateKeyPem));
  return `${body}.${b64url(sig)}`;
}

/** Erreur de l'API : le message contient la réponse BRUTE de Enable Banking, pour qu'on puisse la copier-coller. */
export class EnableBankingError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

type Deps = { fetch?: typeof fetch; env?: Record<string, string | undefined>; now?: () => number };

export async function ebRequest<T>(
  path: string,
  opts: { method?: "GET" | "POST"; query?: Record<string, string | undefined>; body?: unknown } = {},
  deps: Deps = {},
): Promise<T> {
  const env = deps.env ?? process.env;
  const appId = env.ENABLE_BANKING_APP_ID;
  const key = env.ENABLE_BANKING_PRIVATE_KEY;
  if (!appId || !key) throw new EnableBankingError("ENABLE_BANKING_APP_ID ou ENABLE_BANKING_PRIVATE_KEY manquant dans les variables d'environnement");

  let jwt: string;
  try {
    jwt = signJwt(appId, key, deps.now?.());
  } catch {
    // Message volontairement sans détail : l'erreur d'OpenSSL pourrait citer des morceaux de la clé.
    throw new EnableBankingError("ENABLE_BANKING_PRIVATE_KEY illisible : vérifie que c'est bien la clé PEM complète (BEGIN … END PRIVATE KEY)");
  }

  const qs = new URLSearchParams(Object.entries(opts.query ?? {}).filter((e): e is [string, string] => e[1] !== undefined)).toString();
  const res = await (deps.fetch ?? fetch)(`${EB_API}${path}${qs ? `?${qs}` : ""}`, {
    method: opts.method ?? "GET",
    headers: { Authorization: `Bearer ${jwt}`, ...(opts.body ? { "Content-Type": "application/json" } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new EnableBankingError(`Enable Banking ${res.status} sur ${opts.method ?? "GET"} ${path} : ${text.slice(0, 600) || "(réponse vide)"}`, res.status);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new EnableBankingError(`Enable Banking ${res.status} sur ${path} : réponse qui n'est pas du JSON : ${text.slice(0, 300)}`, res.status);
  }
}

/* ---------- Appels utilisés par l'app (tous en lecture, sauf /auth et /sessions qui ne créent qu'un accord de lecture) ---------- */

export type Aspsp = { name: string; country: string };

/** La banque de Ruben dans la liste d'Enable Banking : « Revolut » exact d'abord, sinon un nom qui contient « revolut ». */
export function findRevolut(aspsps: Aspsp[]): Aspsp | null {
  const lower = (a: Aspsp) => a.name.toLowerCase();
  return aspsps.find((a) => lower(a) === "revolut") ?? aspsps.find((a) => lower(a).includes("revolut")) ?? null;
}

export const listAspsps = (country: string, deps?: Deps) => ebRequest<{ aspsps: Aspsp[] }>("/aspsps", { query: { country } }, deps);

/** Démarre l'autorisation : renvoie l'URL de la banque où Ruben donne son accord (lecture seule, durée limitée). */
export const startAuth = (p: { aspsp: Aspsp; state: string; redirectUrl: string; validUntil: Date }, deps?: Deps) =>
  ebRequest<{ url: string; authorization_id?: string }>(
    "/auth",
    { method: "POST", body: { access: { valid_until: p.validUntil.toISOString() }, aspsp: { name: p.aspsp.name, country: p.aspsp.country }, state: p.state, redirect_url: p.redirectUrl, psu_type: "personal" } },
    deps,
  );

type SessionAccount = { uid?: string; name?: string; currency?: string; account_id?: { iban?: string } } | string;
export type Session = { session_id: string; accounts?: SessionAccount[]; aspsp?: { name?: string }; access?: { valid_until?: string } };

/** Échange le code reçu au retour de la banque contre une session (liste des comptes + date d'expiration de l'accord). */
export const createSession = (code: string, deps?: Deps) => ebRequest<Session>("/sessions", { method: "POST", body: { code } }, deps);

export type BalanceResource = { name?: string; balance_type?: string; balance_amount?: { currency?: string; amount?: string } };
export const getBalances = (uid: string, deps?: Deps) => ebRequest<{ balances?: BalanceResource[] }>(`/accounts/${encodeURIComponent(uid)}/balances`, {}, deps);

export type EbTransaction = {
  entry_reference?: string | null;
  transaction_id?: string | null;
  transaction_amount?: { currency?: string; amount?: string };
  credit_debit_indicator?: "CRDT" | "DBIT" | string;
  status?: string;
  booking_date?: string | null;
  value_date?: string | null;
  transaction_date?: string | null;
  creditor?: { name?: string | null } | null;
  debtor?: { name?: string | null } | null;
  remittance_information?: string[] | null;
  note?: string | null;
};

const MAX_PAGES = 20; // garde-fou : jamais de boucle infinie si l'API renvoie toujours une clé de continuation

/** Toutes les opérations comptabilisées (BOOK) depuis `dateFrom`, en suivant la pagination (continuation_key). */
export async function getTransactions(uid: string, dateFrom: string, deps?: Deps): Promise<EbTransaction[]> {
  const out: EbTransaction[] = [];
  let key: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const r = await ebRequest<{ transactions?: EbTransaction[]; continuation_key?: string | null }>(
      `/accounts/${encodeURIComponent(uid)}/transactions`,
      { query: { date_from: dateFrom, transaction_status: "BOOK", continuation_key: key } },
      deps,
    );
    out.push(...(r.transactions ?? []));
    if (!r.continuation_key) return out;
    key = r.continuation_key;
  }
  throw new EnableBankingError(`Plus de ${MAX_PAGES} pages d'opérations : arrêt par sécurité (réduis la période de synchro)`);
}
