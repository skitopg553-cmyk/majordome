"use client";

import { useEffect, useMemo } from "react";
import { mascotApi } from "./mascot-engine";

const RING = 2 * Math.PI * 44; // circonférence de l'anneau (rayon 44)
const PARTICLES = 14;
const DURATION = 1500; // ms : court, jamais bloquant

/**
 * Célébration d'un « oui » (≈ 1,5 s) : un anneau de lumière cyan qui se remplit, une coche, quelques particules, la mascotte contente et une légère vibration.
 * CSS / SVG seulement. Elle ne capte aucun toucher (pointer-events-none) : l'écran reste utilisable pendant qu'elle joue.
 * « Réduire les animations » : aucun mouvement, seulement le changement d'humeur de la mascotte.
 */
export default function Celebration({ note, onDone }: { note?: string; onDone: () => void }) {
  const calm = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const dots = useMemo(
    () =>
      Array.from({ length: PARTICLES }, (_, i) => {
        const a = (i / PARTICLES) * Math.PI * 2 + (i % 2) * 0.2;
        const d = 62 + (i % 3) * 14;
        return { dx: Math.round(Math.cos(a) * d), dy: Math.round(Math.sin(a) * d), delay: (i % 4) * 30 };
      }),
    [],
  );

  useEffect(() => {
    mascotApi.react("happy", 2000);
    if (!calm) navigator.vibrate?.(25);
    const t = setTimeout(onDone, calm ? 800 : DURATION);
    return () => clearTimeout(t);
  }, [calm, onDone]);

  if (calm) return null;
  return (
    <div className="celebrate pointer-events-none fixed inset-0 z-[55] flex flex-col items-center justify-center gap-3" aria-hidden>
      <div className="celebrate-glow relative size-36">
        <svg viewBox="0 0 100 100" className="size-full -rotate-90" fill="none">
          <circle cx="50" cy="50" r="44" stroke="rgba(108,242,255,.14)" strokeWidth="5" />
          <circle cx="50" cy="50" r="44" stroke="#6CF2FF" strokeWidth="5" strokeLinecap="round" strokeDasharray={RING} strokeDashoffset={RING} className="celebrate-ring" style={{ ["--ring" as string]: RING }} />
        </svg>
        <svg viewBox="0 0 24 24" className="absolute inset-0 m-auto size-12" fill="none" stroke="#6CF2FF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.5 4.5L19 7.5" className="celebrate-check" pathLength={1} />
        </svg>
        {dots.map((p, i) => (
          <span key={i} className="celebrate-dot" style={{ ["--dx" as string]: `${p.dx}px`, ["--dy" as string]: `${p.dy}px`, animationDelay: `${300 + p.delay}ms` }} />
        ))}
      </div>
      <p className="celebrate-text text-[17px] font-semibold tracking-tight">Bien joué</p>
      {note && <p className="celebrate-text text-[13px] text-muted">{note}</p>}
    </div>
  );
}
