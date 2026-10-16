// « state » signé pour les retours de connexion (banque, Google) : prouve que la connexion a été lancée depuis l'app,
// sans cookie ni base de données, et sans mettre de secret dans l'URL. Valable 10 minutes.
import { createHmac, timingSafeEqual } from "node:crypto";

const TTL_MS = 10 * 60_000;
const mac = (secret: string, purpose: string, ts: string) => createHmac("sha256", secret).update(`${purpose}:${ts}`).digest("base64url");

/** `purpose` sépare les usages : un state fait pour la banque n'est jamais accepté pour Google, et inversement. */
export function signState(secret: string, purpose: string, now = Date.now()) {
  const ts = String(now);
  return `${ts}.${mac(secret, purpose, ts)}`;
}

export function verifyState(state: string | null, secret: string, purpose: string, now = Date.now()) {
  if (!state) return false;
  const [ts, sig] = state.split(".");
  if (!ts || !sig || !/^\d+$/.test(ts)) return false;
  const age = now - Number(ts);
  if (age < 0 || age > TTL_MS) return false;
  const expected = Buffer.from(mac(secret, purpose, ts));
  const given = Buffer.from(sig);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
