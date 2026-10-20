// Voix expressive (ElevenLabs v3) : l'humeur de la mascotte (@mood) devient une indication d'émotion dans le texte envoyé, et les phrases longues « respirent »
// (courte interjection, pauses entre les phrases). Tout est fait en code : aucune IA. Les indications [entre crochets] ne servent QU'à v3 :
// les autres modèles les liraient à voix haute. Le texte vient déjà nettoyé par toSpokenText (heures et nombres en lettres).
import type { AiMood } from "./mascot";

/** Indication d'émotion v3 par humeur ; « neutral » : voix naturelle, sans indication. */
export const MOOD_TAG: Record<AiMood, string | null> = { neutral: null, happy: "[warmly]", surprised: "[amused]", sad: "[concerned]", focus: "[thoughtful]", angry: "[firmly]" };

// Petites interjections de majordome, une par humeur au plus ; jamais ajoutées à une phrase qui commence déjà par une formule.
const OPENERS: Record<AiMood, string[]> = { neutral: [], happy: ["Parfait.", "Fort bien."], surprised: ["Tiens."], sad: ["Hélas…"], focus: ["Voyons…"], angry: [] };
const ALREADY = /^\s*(?:parfait|fort bien|tr[èe]s bien|voyons|tiens|h[ée]las|bonjour|bonsoir|certainement|bien s[ûu]r|c'est not[ée]|entendu|je crains)\b/i;
const LONG = 60; // en dessous, une confirmation reste courte et brute (« Très bien, Monsieur. C'est noté. »)

const sentences = (t: string) => t.split(/(?<=[.!?…])\s+/).map((s) => s.trim()).filter(Boolean);

/** Respiration : interjection d'ouverture (selon l'humeur) et une ligne par phrase pour de vraies pauses. Un texte court est rendu tel quel. */
export function breathe(text: string, mood: AiMood = "neutral"): string {
  const t = text.trim();
  if (t.length < LONG) return t;
  const list = OPENERS[mood];
  const opener = list.length && !ALREADY.test(t) ? list[t.length % list.length] : "";
  const parts = sentences(t);
  return `${opener ? `${opener}\n` : ""}${parts.join("\n")}`;
}

/** Texte final envoyé à la synthèse : avec `expressive` (v3 seulement), indication d'émotion + respiration ; sinon le texte propre, inchangé. */
export function forVoice(text: string, o: { mood?: AiMood; expressive: boolean }): string {
  if (!o.expressive) return text;
  const mood = o.mood ?? "neutral";
  const tag = MOOD_TAG[mood];
  const body = breathe(text, mood);
  return tag ? `${tag} ${body}` : body;
}
