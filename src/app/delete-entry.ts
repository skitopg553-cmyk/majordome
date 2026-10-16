// Suppression définitive d'une entrée depuis un écran. Toujours précédée d'une confirmation (confirmDelete).
export type DeleteTarget = { table: string; id: number } | { table: "sleep_logs" | "steps_logs"; date: string };

export const confirmDelete = (what: string) => window.confirm(`Supprimer ${what} ?\n\nCette action est définitive.`);

/** Appelle DELETE /api/entries ; lève une erreur lisible (message brut du serveur) en cas d'échec. */
export async function deleteEntry(accessCode: string, target: DeleteTarget, onUnauthorized: () => void) {
  const res = await fetch("/api/entries", { method: "DELETE", headers: { "Content-Type": "application/json", "x-access-code": accessCode }, body: JSON.stringify(target) });
  if (res.status === 401) {
    onUnauthorized();
    throw new Error("Code d'accès incorrect");
  }
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `Erreur serveur (${res.status})`);
}
