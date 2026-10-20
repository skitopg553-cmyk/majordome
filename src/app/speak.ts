// Lecture à voix haute d'un texte, SEULEMENT après un geste de l'utilisateur (tap sur la mascotte ou sur « Écouter ») : les navigateurs interdisent tout son qui démarre seul.
import { toSpokenText } from "@/lib/speech-text";
import { pickFrenchVoice } from "@/lib/voice";
import { mascotApi } from "./mascot-engine";

/** Lit `text` avec la voix du téléphone (heures et nombres en toutes lettres). Rend la main quand la lecture se termine. */
export function speakPhone(text: string, onEnd?: () => void) {
  const synth = typeof window === "undefined" ? undefined : window.speechSynthesis;
  const spoken = toSpokenText(text);
  if (!synth || !spoken) return onEnd?.();
  synth.cancel();
  const u = new SpeechSynthesisUtterance(spoken);
  u.lang = "fr-FR";
  u.voice = pickFrenchVoice(synth.getVoices());
  u.onboundary = () => mascotApi.pulse();
  u.onend = u.onerror = () => onEnd?.();
  synth.speak(u);
}
