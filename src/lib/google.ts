// Phase 2 (PRÉPARÉE, DÉSACTIVÉE) : connexion Google en LECTURE SEULE (Gmail + Agenda).
// Interrupteur : GOOGLE_ENABLED=true dans Vercel. Tant qu'il est absent, les routes /api/google/* répondent 404.
// Guide pour créer le client OAuth : docs/google-setup.md.
import { signState as signStateFor, verifyState as verifyStateFor } from "./signed-state";

export const googleEnabled = () => process.env.GOOGLE_ENABLED === "true";

// Lecture seule, rien d'autre (règle du projet : jamais d'action irréversible sans Ruben).
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar.readonly",
  "openid",
  "email",
];

// Le « state » signé est partagé avec la connexion bancaire (src/lib/signed-state.ts). Même calcul qu'avant : rien ne change.
export const signState = (secret: string, now = Date.now()) => signStateFor(secret, "google-oauth", now);
export const verifyState = (state: string | null, secret: string, now = Date.now()) => verifyStateFor(state, secret, "google-oauth", now);

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
