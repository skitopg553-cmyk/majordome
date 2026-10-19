"use client";

import { useCallback, useEffect, useState } from "react";
import type { StoredRule } from "@/lib/recurrence";
import type { SlotException } from "@/lib/slots";
import { callApi } from "./api-client";

export type HabitLog = { rule_id: number; day: string; status: "done" | "missed" };
type Payload = { ready: boolean; rules?: StoredRule[]; exceptions?: SlotException[]; logs?: HabitLog[] };

/** Créneaux qui reviennent + exceptions + journal des habitudes (voir /api/slots). Partagé par le Planning et l'Accueil. */
export function useSlots(accessCode: string, onUnauthorized: () => void) {
  const [data, setData] = useState<{ rules: StoredRule[]; exceptions: SlotException[]; logs: HabitLog[] }>({ rules: [], exceptions: [], logs: [] });
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(() => {
    callApi<Payload>(accessCode, "/api/slots", { onUnauthorized })
      .then((d) => setData({ rules: d.rules ?? [], exceptions: d.exceptions ?? [], logs: d.logs ?? [] }))
      .catch(() => {}) // hors ligne ou base absente : on garde ce qu'on a
      .finally(() => setLoaded(true));
  }, [accessCode, onUnauthorized]);
  useEffect(reload, [reload]);

  /** Envoie une action (supprimer / déplacer une occurrence, répondre à une habitude) puis recharge. Lève une erreur lisible. */
  const act = useCallback(
    async (body: Record<string, unknown>) => {
      await callApi(accessCode, "/api/slots", { method: "POST", body, onUnauthorized });
      reload();
    },
    [accessCode, onUnauthorized, reload],
  );

  return { ...data, loaded, reload, act };
}
export type SlotsApi = ReturnType<typeof useSlots>;
