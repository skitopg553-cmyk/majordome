// Protection commune des routes API : le code d'accès doit être dans l'en-tête x-access-code
// (sinon n'importe qui ayant l'URL pourrait lire tes données ou dépenser tes crédits).
export function denied(req: Request) {
  const code = process.env.MAJORDOME_ACCESS_CODE;
  return !code || req.headers.get("x-access-code") !== code;
}
