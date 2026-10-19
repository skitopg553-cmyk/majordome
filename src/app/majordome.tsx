"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { EMO, EYE_GAP, eyeStyle, GAZE_X, GAZE_Y } from "@/lib/mascot";
import { mascotApi, type Frame } from "./mascot-engine";

/** Démarre le moteur une seule fois ; monté dans le layout racine. N'affiche rien. */
export function MascotRuntime() {
  useEffect(() => mascotApi.start(), []);
  return null;
}

/**
 * La mascotte : deux yeux blancs arrondis sur fond noir, avec une lueur cyan. `size` = S, la hauteur d'un œil au repos, en pixels.
 * `fond` = couleur du fond derrière les yeux (les paupières la reprennent : sinon on verrait un carré). Décoratif : aria-hidden.
 * Tous les yeux de l'app lisent le même état (regard, humeur, voix) : voir mascot-engine.ts.
 */
export default function Majordome({ size = 40, fond = "#050506", className = "" }: { size?: number; fond?: string; className?: string }) {
  const pair = useRef<HTMLSpanElement>(null);
  const eyes = useRef<(HTMLSpanElement | null)[]>([null, null]);
  const tops = useRef<(HTMLSpanElement | null)[]>([null, null]);
  const bots = useRef<(HTMLSpanElement | null)[]>([null, null]);
  const mood = useSyncExternalStore(mascotApi.subscribeState, mascotApi.getMood, () => "neutral");

  useEffect(() => {
    const S = size;
    const last = { eye: ["", ""], top: ["", ""], bot: ["", ""], pair: "" };
    const apply = (f: Frame) => {
      if (!pair.current) return; // démonté (ex. écran de chargement) : les refs sont vidées un instant avant la fin de l'abonnement
      for (const i of [0, 1] as const) {
        const e = eyeStyle(f.p, S, i);
        const eye = eyes.current[i]!;
        const a = `${e.width.toFixed(2)}|${e.height.toFixed(2)}|${e.borderRadius.toFixed(2)}`;
        if (a !== last.eye[i]) {
          last.eye[i] = a;
          eye.style.width = `${e.width}px`;
          eye.style.height = `${e.height}px`;
          eye.style.borderRadius = `${e.borderRadius}px`;
        }
        const t = `${e.topLidTop.toFixed(2)}|${e.topLidRotate.toFixed(2)}`;
        if (t !== last.top[i]) {
          last.top[i] = t;
          tops.current[i]!.style.top = `${e.topLidTop}%`;
          tops.current[i]!.style.transform = `rotate(${e.topLidRotate}deg)`;
        }
        const b = e.bottomLidTop.toFixed(2);
        if (b !== last.bot[i]) {
          last.bot[i] = b;
          bots.current[i]!.style.top = `${e.bottomLidTop}%`;
        }
      }
      const p = `translate3d(${(f.gx * S * GAZE_X).toFixed(2)}px, ${(f.gy * S * GAZE_Y - f.bounce * S).toFixed(2)}px, 0)`;
      if (p !== last.pair) {
        last.pair = p;
        pair.current!.style.transform = p;
      }
    };
    return mascotApi.subscribeFrame(apply);
  }, [size]);

  const n = EMO.neutral;
  const glow = `0 0 ${Math.round(size * 0.6)}px rgba(108,242,255,.28)`;
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size * 1.6, height: size * 1.16, ["--fond" as string]: fond }}
      data-mood={mood}
      aria-hidden
    >
      <span ref={pair} className="flex items-center will-change-transform" style={{ gap: EYE_GAP * size }}>
        {[0, 1].map((i) => {
          const e = eyeStyle(n, size, i as 0 | 1);
          return (
            <span
              key={i}
              ref={(el) => void (eyes.current[i] = el)}
              className="mascot-eye"
              style={{ width: e.width, height: e.height, borderRadius: e.borderRadius, boxShadow: glow }}
            >
              <span ref={(el) => void (tops.current[i] = el)} className="mascot-lt" style={{ top: `${e.topLidTop}%`, transform: `rotate(${e.topLidRotate}deg)` }} />
              <span ref={(el) => void (bots.current[i] = el)} className="mascot-lb" style={{ top: `${e.bottomLidTop}%` }} />
            </span>
          );
        })}
      </span>
    </span>
  );
}
