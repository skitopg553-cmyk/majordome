import { callApi } from "./api-client";

// Suppression définitive d'une entrée depuis un écran. Toujours précédée d'une confirmation (confirmDelete).
export type DeleteTarget = { table: string; id: number } | { table: "sleep_logs" | "steps_logs" | "screen_time_logs"; date: string };

export const confirmDelete = (what: string) => window.confirm(`Supprimer ${what} ?\n\nCette action est définitive.`);

/** Appelle DELETE /api/entries ; lève une erreur lisible (message brut du serveur) en cas d'échec. */
export async function deleteEntry(accessCode: string, target: DeleteTarget, onUnauthorized: () => void) {
  await callApi(accessCode, "/api/entries", { method: "DELETE", body: target, onUnauthorized });
}
