"use client";

import { useCallback, useEffect, useState } from "react";
import type { AgendaEvent } from "@/lib/google-api";
import { addDays, parisDay } from "@/lib/task-groups";
import { callApi } from "./api-client";

export type Suggestion = { id: number; title: string; start: string; place: string | null; calendarUrl: string };
export type GoogleState = "loading" | "off" | "no-table" | "not-connected" | "reconnect" | "ok";
export type GoogleApi = {
  state: GoogleState;
  events: AgendaEvent[];
  mails: { count: number; subjects: string[] } | null;
  suggestions: Suggestion[];
  connect: () => Promise<void>;
  answer: (id: number, action: "task" | "added" | "dismissed") => Promise<void>;
  refresh: () => void;
  error: string | null;
};

/**
 * Google en LECTURE SEULE (agenda, mails) pour l'Accueil et le Planning. À l'ouverture : un passage serveur (sport détecté, mails → rendez-vous),
 * puis le résumé et les événements des prochaines semaines. Tout état inattendu (désactivé, table absente, jeton expiré) donne un état clair, jamais une erreur qui casse l'écran.
 */
export function useGoogle(accessCode: string, onUnauthorized: () => void): GoogleApi {
  const [state, setState] = useState<GoogleState>("loading");
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [mails, setMails] = useState<GoogleApi["mails"]>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Résumé (mails, propositions) + événements : affichés tout de suite. Le passage serveur (sport, mails → RDV) est plus long : il tourne à part
  // et recharge l'écran seulement s'il a trouvé quelque chose.
  const loadView = useCallback(async () => {
    const opts = { onUnauthorized };
    const s = await callApi<{ state?: GoogleState; mails?: GoogleApi["mails"]; suggestions?: Suggestion[] }>(accessCode, "/api/google/summary", opts);
    setState(s.state ?? "off");
    setMails(s.mails ?? null);
    setSuggestions(s.suggestions ?? []);
    if (s.state === "ok") {
      const today = parisDay(new Date());
      const a = await callApi<{ events: AgendaEvent[]; state: GoogleState }>(accessCode, `/api/google/agenda?from=${addDays(today, -1)}&to=${addDays(today, 45)}`, opts);
      if (a.state === "reconnect") setState("reconnect");
      else setEvents(a.events);
    }
    setError(null);
  }, [accessCode, onUnauthorized]);

  const load = useCallback(async () => {
    try {
      await loadView();
      void callApi<{ state?: GoogleState; proposed?: number; workouts?: number }>(accessCode, "/api/google/sync", { method: "POST", onUnauthorized })
        .then((r) => (r.state === "reconnect" ? setState("reconnect") : r.proposed || r.workouts ? loadView() : undefined))
        .catch(() => {}); // le passage a échoué : l'écran garde ce qu'il a
    } catch (e) {
      // Panne passagère (réseau, Google) : on garde ce qu'on avait, on l'explique sans rien casser.
      setState((cur) => (cur === "loading" ? "off" : cur));
      setError(e instanceof Error ? e.message : "Google indisponible");
    }
  }, [accessCode, onUnauthorized, loadView]);

  useEffect(() => {
    void load();
  }, [load]);

  const connect = useCallback(async () => {
    const d = await callApi<{ url: string }>(accessCode, "/api/google/connect", { method: "POST", onUnauthorized });
    window.location.assign(d.url);
  }, [accessCode, onUnauthorized]);

  const answer = useCallback(
    async (id: number, action: "task" | "added" | "dismissed") => {
      setSuggestions((cur) => cur.filter((s) => s.id !== id)); // disparaît tout de suite ; revient si le serveur refuse
      try {
        await callApi(accessCode, "/api/google/suggestion", { method: "POST", body: { id, action }, onUnauthorized });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Impossible d'enregistrer votre réponse");
        void load();
      }
    },
    [accessCode, onUnauthorized, load],
  );

  return { state, events, mails, suggestions, connect, answer, refresh: () => void load(), error };
}
