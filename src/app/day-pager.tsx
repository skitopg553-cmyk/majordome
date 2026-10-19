"use client";

import { useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { addDays } from "@/lib/task-groups";

export type PagerHandle = { goTo: (day: string) => void };

// Ressort : dépasse un peu la cible puis se cale. Seulement transform (composé par le GPU) : pas de recalcul de mise en page pendant le geste.
const EASE = "cubic-bezier(0.34, 1.4, 0.64, 1)";
const MS = 380;
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Trois jours côte à côte (précédent, courant, suivant) : le jour suit le doigt, les deux jours sont visibles pendant le geste,
 * puis il se cale avec un effet ressort. Événements pointer (souris et tactile), aucune librairie.
 * Avec « réduire les animations » : pas de glissement, un simple fondu.
 */
export default function DayPager({ ref, day, onDay, render }: { ref: React.Ref<PagerHandle>; day: string; onDay: (d: string) => void; render: (day: string) => React.ReactNode }) {
  const viewport = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState<{ to: string; dir: 1 | -1 } | null>(null); // jour qui arrive (glissement en cours)
  const [fade, setFade] = useState(0);
  const gesture = useRef<{ x: number; y: number; t: number; active: boolean } | null>(null);

  const place = (x: string, animate: boolean) => {
    const el = track.current!;
    el.style.transition = animate ? `transform ${MS}ms ${EASE}` : "none";
    el.style.transform = `translate3d(${x},0,0)`;
  };
  // Le jour courant est la colonne du milieu : on remet la piste au centre à chaque changement de jour.
  useLayoutEffect(() => place("-100%", false), [day]);
  // Un jour qui arrive (geste, flèche ou date touchée) : la piste glisse vers lui.
  useLayoutEffect(() => {
    if (pending) place(pending.dir === 1 ? "-200%" : "0%", true);
  }, [pending]);

  function jump(to: string, dir: 1 | -1) {
    if (reducedMotion()) {
      onDay(to);
      setFade((f) => f + 1);
    } else setPending({ to, dir });
  }
  useImperativeHandle(ref, () => ({ goTo: (to) => to !== day && !pending && jump(to, to > day ? 1 : -1) }));

  const up = (e: React.PointerEvent) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g?.active) return;
    const dx = e.clientX - g.x;
    const velocity = dx / Math.max(1, performance.now() - g.t); // px par ms
    const far = Math.abs(dx) > viewport.current!.offsetWidth * 0.25 || (Math.abs(velocity) > 0.5 && Math.abs(dx) > 24);
    if (far) jump(addDays(day, dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
    else if (!reducedMotion()) place("-100%", true); // pas assez loin : retour avec le ressort
  };

  const prev = pending?.dir === -1 ? pending.to : addDays(day, -1);
  const next = pending?.dir === 1 ? pending.to : addDays(day, 1);
  return (
    <div
      ref={viewport}
      className="min-h-[55dvh] touch-pan-y overflow-hidden"
      onPointerDown={(e) => {
        if (!pending) gesture.current = { x: e.clientX, y: e.clientY, t: performance.now(), active: false };
      }}
      onPointerMove={(e) => {
        const g = gesture.current;
        if (!g) return;
        const dx = e.clientX - g.x;
        const dy = e.clientY - g.y;
        if (!g.active) {
          if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) return void (gesture.current = null); // c'est un défilement vertical
          if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
          g.active = true;
          viewport.current!.setPointerCapture(e.pointerId);
        }
        if (!reducedMotion()) place(`calc(-100% + ${dx}px)`, false); // le jour suit le doigt
      }}
      onPointerUp={up}
      onPointerCancel={up}
    >
      <div
        ref={track}
        className="flex will-change-transform"
        onTransitionEnd={(e) => {
          if (e.target !== track.current || e.propertyName !== "transform" || !pending) return;
          onDay(pending.to); // le jour arrivé devient le jour courant (la piste se recentre dans l'effet)
          setPending(null);
        }}
      >
        {[prev, day, next].map((d, i) => (
          <div key={`${d}-${i === 1 ? fade : 0}`} aria-hidden={i !== 1} className={`w-full shrink-0 px-5 ${fade && i === 1 ? "fade" : ""}`}>
            {render(d)}
          </div>
        ))}
      </div>
    </div>
  );
}
