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

/**
 * ElevenLabs : on paie en « crédits » par caractère (Flash = 0,5 ; Multilingual v2 et v3 = 1). Le prix du crédit dépend de ton abonnement :
 * ELEVENLABS_USD_PER_1K_CREDITS (défaut 0,20 $ les 1 000 crédits, ordre de grandeur des offres Creator/Pro, À RE-VÉRIFIER sur ton compte).
 * v3 : pas de mode flux (l'audio arrive d'un bloc) ; Flash et v3 acceptent la langue (« fr »), Multilingual v2 la devine.
 */
export const EL_MODELS = {
  flash: { id: "eleven_flash_v2_5", label: "Flash v2.5", credits: 0.5, stream: true, lang: true },
  v2: { id: "eleven_multilingual_v2", label: "Multilingual v2", credits: 1, stream: true, lang: false },
  v3: { id: "eleven_v3", label: "v3", credits: 1, stream: false, lang: true },
} as const;
export type ElModel = keyof typeof EL_MODELS;
export const isElModel = (v: unknown): v is ElModel => typeof v === "string" && Object.hasOwn(EL_MODELS, v);

export function elevenCostUsd(chars: number, model: ElModel, usdPer1kCredits: number = Number(process.env.ELEVENLABS_USD_PER_1K_CREDITS) || 0.2): number {
  return (chars * EL_MODELS[model].credits * usdPer1kCredits) / 1000;
}

/** Réglage de voix entre 0 et 1 ; tout le reste (absent, texte, NaN) → valeur par défaut. */
export const unit01 = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback);

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
