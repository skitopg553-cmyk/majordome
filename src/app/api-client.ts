// Appel de l'API de l'app avec le code d'accès : une seule façon de faire (avant : le même code recopié dans 6 fichiers).
// Code d'accès refusé (401) → on prévient l'écran (retour à la saisie du code) et on lève une erreur lisible ; autre erreur → le message du serveur.
export async function callApi<T = Record<string, unknown>>(accessCode: string, path: string, opts: { method?: string; body?: unknown; onUnauthorized?: () => void } = {}): Promise<T> {
  const res = await fetch(path, {
    method: opts.method ?? "GET",
    headers: { ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}), "x-access-code": accessCode },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    opts.onUnauthorized?.();
    throw new Error("Code d'accès incorrect");
  }
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Erreur serveur (${res.status})`);
  return data as T;
}
