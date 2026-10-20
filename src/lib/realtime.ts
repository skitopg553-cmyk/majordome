// Prototype « conversation » (page /voix-test seulement) : le modèle audio temps réel d'OpenAI, qui parle directement sans passer par du texte lu.
// Pur et testé : plafond de minutes par jour, coût estimé, consignes de la session. La clé OpenAI ne quitte jamais le serveur : le navigateur reçoit un jeton temporaire.

export const REALTIME_MODEL = "gpt-realtime"; // remplaçable par REALTIME_MODEL (ex. « gpt-realtime-mini », moins cher)
export const DEFAULT_MAX_MINUTES_PER_DAY = 10;
/** Coût estimé par minute de session, en dollars : 0,20 $ (estimation prudente d'une conversation où chacun parle, À RE-VÉRIFIER sur openai.com/api/pricing). Réglable par REALTIME_USD_PER_MINUTE. */
export const DEFAULT_USD_PER_MINUTE = 0.2;
export const TOKEN_TTL_SECONDS = 120; // le jeton ne sert qu'à OUVRIR la session

const num = (v: string | undefined) => (v !== undefined && v.trim() !== "" && Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : null);

export const maxSecondsPerDay = (env: string | undefined = process.env.REALTIME_MAX_MINUTES_PER_DAY) => Math.floor((num(env) ?? DEFAULT_MAX_MINUTES_PER_DAY) * 60);
export const usdPerMinute = (env: string | undefined = process.env.REALTIME_USD_PER_MINUTE) => num(env) ?? DEFAULT_USD_PER_MINUTE;
export const realtimeCostUsd = (seconds: number, perMinute = usdPerMinute()) => Math.round((Math.max(0, seconds) / 60) * perMinute * 1e6) / 1e6;

/** Secondes encore autorisées aujourd'hui. Sous 10 s, on ne démarre plus (une session ne servirait à rien). */
export function remainingSeconds(usedMs: number, maxSeconds = maxSecondsPerDay()): number {
  const left = Math.floor(maxSeconds - usedMs / 1000);
  return left >= 10 ? left : 0;
}

/** Durée d'une session, telle que rapportée par l'écran, bornée : jamais négative, jamais plus que ce qui était autorisé (+ 15 s de marge réseau). */
export const clampSessionSeconds = (reported: unknown, allowed: number) => (typeof reported === "number" && Number.isFinite(reported) ? Math.min(Math.max(0, Math.round(reported)), allowed + 15) : 0);

/** Personnalité de la session : le même grand majordome que dans l'appli, mais sans accès à ses données (prototype). */
export const REALTIME_INSTRUCTIONS =
  "Tu es Majordome, un grand majordome britannique qui parle un français impeccable, sans accent anglais. Tu vouvoies ton interlocuteur et tu l'appelles « Monsieur ». " +
  "Manières impeccables, serviabilité discrète, phrases courtes et élégantes, une pointe d'humour pince-sans-rire de temps en temps. Jamais familier, jamais servile au point d'être ridicule. " +
  "Tu réponds en une ou deux phrases, avec une voix posée, chaleureuse et vivante, de vraies pauses, des variations d'intonation. " +
  "Dans ce prototype tu n'as pas accès à son agenda ni à ses données : si on te le demande, dis-le simplement. Tu restes franc, sans jamais culpabiliser.";
