"use client";

import { useEffect, useState } from "react";
import Majordome from "./majordome";
import { Wordmark } from "./ui";

/**
 * Écran de chargement : la mascotte et le nom, le temps STRICTEMENT nécessaire (jusqu'à ce que `show` passe à false), puis un fondu rapide.
 * Aucune durée minimale ; garde-fou : disparaît seul après 4 s même si le chargement traîne, pour ne jamais bloquer l'appli.
 */
export default function Splash({ show }: { show: boolean }) {
  const [timedOut, setTimedOut] = useState(false);
  const [gone, setGone] = useState(false);
  const visible = show && !timedOut;

  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 4000);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (visible) return;
    const t = setTimeout(() => setGone(true), 220); // le temps du fondu
    return () => clearTimeout(t);
  }, [visible]);

  if (gone) return null;
  return (
    <div aria-hidden={!visible} className={`fixed inset-0 z-[60] flex flex-col items-center justify-center gap-6 bg-ink transition-opacity duration-200 ${visible ? "opacity-100" : "pointer-events-none opacity-0"}`}>
      <Majordome size={34} />
      <Wordmark className="text-[22px]" />
    </div>
  );
}
