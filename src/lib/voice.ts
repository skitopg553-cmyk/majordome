// Logique pure de la voix (testée dans voice.test.ts) : état du point lumineux, texte à lire, choix de la voix.

export type OrbState = "idle" | "listening" | "thinking" | "speaking";

/** État visuel du point : l'écoute prime, puis la réflexion (avant le 1er mot), puis la parole (texte qui arrive ou lecture). */
export function orbState(s: { listening: boolean; waiting: boolean; busy: boolean; speaking: boolean }): OrbState {
  if (s.listening) return "listening";
  if (s.waiting) return "thinking";
  if (s.busy || s.speaking) return "speaking";
  return "idle";
}

/** Texte lisible à voix haute : on retire la mise en forme markdown et les émojis d'alerte. */
export function plainText(md: string) {
  return md
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\s*[-•*]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/[*_`#>]+/g, "")
    .replace(/⚠️/g, "")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

type VoiceLike = { lang: string; name: string };

/** Voix française de meilleure qualité si possible (Google, naturelle…), sinon n'importe quelle voix fr. */
export function pickFrenchVoice<V extends VoiceLike>(voices: V[]): V | null {
  const fr = voices.filter((v) => v.lang.replace("_", "-").toLowerCase().startsWith("fr"));
  return (
    fr.find((v) => /^fr-fr$/i.test(v.lang.replace("_", "-")) && /google|natural|premium|enhanced/i.test(v.name)) ??
    fr.find((v) => /^fr-fr$/i.test(v.lang.replace("_", "-"))) ??
    fr[0] ??
    null
  );
}

const LABEL: Record<OrbState, string> = {
  idle: "Majordome",
  listening: "Je t'écoute…",
  thinking: "Je réfléchis…",
  speaking: "Majordome parle",
};
export const orbLabel = (s: OrbState) => LABEL[s];
