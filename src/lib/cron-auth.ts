// Appels automatiques de Supabase (pg_cron + pg_net) vers l'app : protégés par un secret partagé (variable CRON_SECRET, et le même dans le Vault Supabase),
// envoyé dans l'en-tête x-cron-secret. Comparaison en temps constant (comme le code d'accès).
import { createHash, timingSafeEqual } from "node:crypto";
import { parisHM } from "./planning";

const hash = (s: string) => createHash("sha256").update(s).digest();

/** "off" = CRON_SECRET absent (route désactivée, 404), "denied" = mauvais secret (401), "ok". */
export function checkCron(req: Request): "ok" | "off" | "denied" {
  const secret = process.env.CRON_SECRET;
  if (!secret) return "off";
  return timingSafeEqual(hash(req.headers.get("x-cron-secret") ?? ""), hash(secret)) ? "ok" : "denied";
}

/**
 * Les tâches récurrentes du jour se créent à 4 h, heure de Paris. pg_cron compte en UTC (4 h Paris = 2 h UTC l'été, 3 h UTC l'hiver) :
 * le job tourne aux deux heures et cette fonction ne laisse passer que celle qui tombe à 4 h à Paris.
 */
export const isRecurringHour = (now: Date) => parisHM(now.toISOString()).h === 4;
