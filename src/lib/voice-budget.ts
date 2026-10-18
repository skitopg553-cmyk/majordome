// Voix cloud : coût estimé, plafond du jour et repli. Tout est pur (testé) : la voix ne doit JAMAIS devenir un point de panne ni de dépense incontrôlée.

/** Plafond par défaut : 8 000 caractères par jour ≈ 9 minutes de parole ≈ 0,14 $ par jour ≈ 4 $ par mois. Réglable par VOICE_MAX_CHARS_PER_DAY. */
export const DEFAULT_MAX_CHARS_PER_DAY = 8000;

export function maxCharsPerDay(env: string | undefined = process.env.VOICE_MAX_CHARS_PER_DAY): number {
  const n = Number(env);
  return env !== undefined && env.trim() !== "" && Number.isFinite(n) && n >= 0 ? Math.floor(n) : DEFAULT_MAX_CHARS_PER_DAY;
}

// gpt-4o-mini-tts : ≈ 0,015 $ par minute d'audio + 0,60 $ par million de tokens de texte (tarifs publics d'OpenAI, À RE-VÉRIFIER sur openai.com/api/pricing).
const USD_PER_AUDIO_MINUTE = 0.015;
const USD_PER_M_TEXT_TOKENS = 0.6;
const CHARS_PER_SECOND = 15; // débit moyen d'une voix française posée
const CHARS_PER_TOKEN = 4;

/** Durée estimée de l'audio d'un texte, en secondes. */
export const audioSeconds = (chars: number) => chars / CHARS_PER_SECOND;

/** Coût estimé en dollars de la lecture de `chars` caractères (estimation : la facture réelle est celle d'OpenAI). */
export const ttsCostUsd = (chars: number) => (audioSeconds(chars) / 60) * USD_PER_AUDIO_MINUTE + ((chars / CHARS_PER_TOKEN) * USD_PER_M_TEXT_TOKENS) / 1_000_000;

export type SpeakDecision = { mode: "cloud" | "phone"; reason: "ok" | "disabled" | "cap" | "empty" };

/**
 * Cloud ou téléphone ? Réglage coupé → téléphone. Texte vide → rien à lire. Plafond atteint (ou dépassé par cette phrase) → téléphone, SANS message d'erreur.
 */
export function decideSpeak(o: { enabled: boolean; usedToday: number; chars: number; maxPerDay: number }): SpeakDecision {
  if (o.chars <= 0) return { mode: "phone", reason: "empty" };
  if (!o.enabled) return { mode: "phone", reason: "disabled" };
  if (o.usedToday + o.chars > o.maxPerDay) return { mode: "phone", reason: "cap" };
  return { mode: "cloud", reason: "ok" };
}

/**
 * Lit avec la voix cloud ; au moindre problème (réseau, service, délai dépassé, audio refusé) la voix du téléphone prend le relais.
 * `phone` ne doit pas échouer ; si elle échoue quand même, on avale l'erreur : se taire vaut mieux qu'un écran cassé.
 */
export async function speakWithFallback(cloud: () => Promise<void>, phone: () => Promise<void> | void, timeoutMs = 8000): Promise<"cloud" | "phone"> {
  try {
    await Promise.race([cloud(), new Promise<never>((_, reject) => setTimeout(() => reject(new Error("délai dépassé")), timeoutMs))]);
    return "cloud";
  } catch {
    try {
      await phone();
    } catch {
      /* silence */
    }
    return "phone";
  }
}
