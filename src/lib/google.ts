// Phase 2 (PRÉPARÉE, DÉSACTIVÉE) : connexion Google en LECTURE SEULE (Gmail + Agenda).
// Interrupteur : GOOGLE_ENABLED=true dans Vercel. Tant qu'il est absent, les routes /api/google/* répondent 404.
// Guide pour créer le client OAuth : docs/google-setup.md.
import { createHmac, timingSafeEqual } from "node:crypto";

export const googleEnabled = () => process.env.GOOGLE_ENABLED === "true";

// Lecture seule, rien d'autre (règle du projet : jamais d'action irréversible sans Ruben).
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar.readonly",
  "openid",
  "email",
];

const STATE_TTL_MS = 10 * 60_000; // le lien de connexion vaut 10 minutes

/** « state » OAuth signé (HMAC) : prouve que la connexion a été lancée depuis l'app, sans mettre de secret dans l'URL. */
export function signState(secret: string, now = Date.now()) {
  const ts = String(now);
  const sig = createHmac("sha256", secret).update(`google-oauth:${ts}`).digest("base64url");
  return `${ts}.${sig}`;
}

export function verifyState(state: string | null, secret: string, now = Date.now()) {
  if (!state) return false;
  const [ts, sig] = state.split(".");
  if (!ts || !sig || !/^\d+$/.test(ts)) return false;
  const age = now - Number(ts);
  if (age < 0 || age > STATE_TTL_MS) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(`google-oauth:${ts}`).digest("base64url"));
  const given = Buffer.from(sig);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export function authUrl(clientId: string, redirectUri: string, state: string) {
  const p = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline", // pour recevoir un refresh token (lecture en arrière-plan)
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

/** Échange le code reçu contre les jetons. */
export async function exchangeCode(code: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: process.env.GOOGLE_REDIRECT_URI ?? "",
      grant_type: "authorization_code",
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Google ${res.status} : ${data.error_description ?? data.error ?? "échange refusé"}`);
  return data as { access_token: string; refresh_token?: string; scope: string; expires_in: number };
}
