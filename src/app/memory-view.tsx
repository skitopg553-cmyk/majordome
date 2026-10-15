"use client";

import { useCallback, useEffect, useState } from "react";

type Memory = { id: number; content: string; category: "objectif" | "preference" | "habitude" | "info" };

const CATEGORIES: [Memory["category"], string][] = [
  ["objectif", "Objectifs"],
  ["preference", "Préférences"],
  ["habitude", "Habitudes"],
  ["info", "Infos"],
];

export default function MemoryView({ accessCode, hidden, onUnauthorized }: { accessCode: string; hidden: boolean; onUnauthorized: () => void }) {
  const [memories, setMemories] = useState<Memory[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const api = useCallback(
    async (method: string, body?: unknown) => {
      const res = await fetch("/api/memories", {
        method,
        headers: { "Content-Type": "application/json", "x-access-code": accessCode },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (res.status === 401) onUnauthorized();
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Erreur serveur (${res.status})`);
      return data;
    },
    [accessCode, onUnauthorized],
  );

  // Rechargé à chaque ouverture de l'onglet (l'IA a pu mémoriser des choses entre-temps).
  useEffect(() => {
    if (hidden) return;
    api("GET")
      .then((d) => {
        setMemories(d.memories);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, [hidden, api]);

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
    <section className={`${hidden ? "hidden" : "flex"} min-h-0 flex-1 flex-col`}>
      <header className="flex h-14 items-center px-5">
        <h1 className="font-serif text-2xl font-medium tracking-wide">Mémoire</h1>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
        <p className="text-sm text-faint">Ce que Majordome sait de vous. Dites-lui en conversation ce qu&apos;il doit retenir.</p>
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
        {memories?.length === 0 && <p className="pt-16 text-center font-serif text-xl text-muted">Rien en mémoire pour l&apos;instant.</p>}
      </div>
    </section>
  );
}
