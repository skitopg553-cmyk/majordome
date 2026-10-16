"use client";

import { callApi } from "./api-client";
import { useCallback, useEffect, useState } from "react";

type Memory = { id: number; content: string; category: "objectif" | "preference" | "habitude" | "info" };

const CATEGORIES: [Memory["category"], string][] = [
  ["objectif", "Objectifs"],
  ["preference", "Préférences"],
  ["habitude", "Habitudes"],
  ["info", "Infos"],
];

// Contenu du panneau profil (chargé à chaque ouverture : l'IA a pu mémoriser des choses entre-temps).
export default function MemoryView({ accessCode, onUnauthorized }: { accessCode: string; onUnauthorized: () => void }) {
  const [memories, setMemories] = useState<Memory[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const api = useCallback(
    (method: string, body?: unknown) => callApi<any>(accessCode, "/api/memories", { method, body, onUnauthorized }), // eslint-disable-line @typescript-eslint/no-explicit-any
    [accessCode, onUnauthorized],
  );

  useEffect(() => {
    api("GET")
      .then((d) => {
        setMemories(d.memories);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, [api]);

  // Suppression optimiste après confirmation : on remet le souvenir si le serveur refuse.
  function forget(m: Memory) {
    if (!confirm(`Oublier ce souvenir ?\n\n« ${m.content} »`)) return;
    setMemories((cur) => cur?.filter((x) => x.id !== m.id) ?? null);
    api("DELETE", { id: m.id }).catch((e) => {
      setMemories((cur) => (cur ? [...cur, m] : [m]));
      setError(e.message);
    });
  }

  return (
    <section>
      <div>
        <p className="text-sm text-faint">Ce que Majordome sait de toi. Dis-lui en conversation ce qu&apos;il doit retenir.</p>
        {error && <p className="pt-3 text-sm text-red-300">{error}</p>}
        {CATEGORIES.map(([cat, label]) => {
          const items = (memories ?? []).filter((m) => m.category === cat);
          if (!items.length) return null;
          return (
            <div key={cat} className="pt-6">
              <h2 className="mb-1 text-[11px] uppercase tracking-[0.14em] text-faint">{label}</h2>
              <ul className="divide-y divide-line/60">
                {items.map((m) => (
                  <li key={m.id} className="rise flex items-start gap-3 py-2.5">
                    <span className="min-w-0 flex-1 pt-2.5 text-[15px] leading-snug">{m.content}</span>
                    <button
                      onClick={() => forget(m)}
                      aria-label={`Oublier : ${m.content}`}
                      className="-mr-2 flex size-11 shrink-0 items-center justify-center text-faint active:text-red-300"
                    >
                      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                        <path d="M6 6l12 12M18 6L6 18" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        {memories?.length === 0 && <p className="pt-10 text-center text-muted">Rien en mémoire pour l&apos;instant.</p>}
      </div>
    </section>
  );
}
