// Majordome en personne : un point lumineux qui change d'animation selon ce qu'il fait.
import type { OrbState } from "@/lib/voice";

export type { OrbState };

const LABEL: Record<OrbState, string> = {
  idle: "Majordome",
  listening: "Je t'écoute…",
  thinking: "Je réfléchis…",
  speaking: "Majordome parle",
};

export const orbLabel = (s: OrbState) => LABEL[s];

export default function Orb({ state, size = 64 }: { state: OrbState; size?: number }) {
  return (
    <span className={`orb orb-${state}`} style={{ width: size, height: size }} aria-hidden>
      <span className="orb-core" />
    </span>
  );
}
