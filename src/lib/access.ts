import { createHash, timingSafeEqual } from "node:crypto";

const hash = (s: string) => createHash("sha256").update(s).digest();

// Protection commune des routes API : le code d'accès doit être dans l'en-tête x-access-code
// (sinon n'importe qui ayant l'URL pourrait lire tes données ou dépenser tes crédits).
// Comparaison en temps constant (sur des empreintes de même longueur) : le temps de réponse ne révèle rien du code.
export function denied(req: Request) {
  const code = process.env.MAJORDOME_ACCESS_CODE;
  if (!code) return true;
  return !timingSafeEqual(hash(req.headers.get("x-access-code") ?? ""), hash(code));
}
