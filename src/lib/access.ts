import { createHash, timingSafeEqual } from "node:crypto";
import { createLimiter } from "./rate-limit";

const hash = (s: string) => createHash("sha256").update(s).digest();

export const limiter = createLimiter();
// Vercel place l'adresse réelle du visiteur en tête de x-forwarded-for.
const ipOf = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "inconnue";

// Protection commune des routes API : le code d'accès doit être dans l'en-tête x-access-code
// (sinon n'importe qui ayant l'URL pourrait lire tes données ou dépenser tes crédits).
// Comparaison en temps constant (sur des empreintes de même longueur) : le temps de réponse ne révèle rien du code.
// Limite d'essais : 5 mauvais codes depuis la même IP → 10 min d'attente, MÊME avec le bon code pendant l'attente (sinon on pourrait continuer à deviner).
export function denied(req: Request) {
  const code = process.env.MAJORDOME_ACCESS_CODE;
  if (!code) return true;
  const ip = ipOf(req);
  if (limiter.isLocked(ip)) return true;
  const given = req.headers.get("x-access-code") ?? "";
  if (timingSafeEqual(hash(given), hash(code))) {
    limiter.clear(ip);
    return false;
  }
  if (given) limiter.fail(ip); // un en-tête vide n'est pas une tentative de deviner
  return true;
}
