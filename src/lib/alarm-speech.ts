// Phrases de confirmation des réveils et minuteurs, générées par le CODE à partir de l'heure réellement envoyée à l'Horloge.
// Jamais par l'IA : elle ne peut donc pas se tromper d'heure ni promettre un bouton absent. Les nombres sont en toutes lettres : la phrase est aussi lue à voix haute.
import { frenchNumber } from "./french-number";

/** « une », « vingt et une » (féminin pour « heures »), sinon le nombre tel quel. */
const feminine = (n: number) => frenchNumber(n).replace(/(^|\s)un$/, "$1une");

/** 7:00 → « sept heures », 7:30 → « sept heures trente », 0:00 → « minuit », 12:15 → « midi quinze », 1:00 → « une heure », 21:05 → « vingt et une heures cinq ». */
export function hourWords(hour: number, minutes: number): string {
  const m = minutes > 0 ? ` ${frenchNumber(minutes)}` : "";
  if (hour === 0) return `minuit${m}`;
  if (hour === 12) return `midi${m}`;
  return `${feminine(hour)} ${hour === 1 ? "heure" : "heures"}${m}`;
}

const unit = (n: number, one: string, many: string) => `${feminine(n)} ${n === 1 ? one : many}`;

/** 300 → « cinq minutes », 60 → « une minute », 90 → « une minute trente », 3600 → « une heure », 4500 → « une heure quinze », 45 → « quarante-cinq secondes ». */
export function durationWords(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const parts: [number, string, string][] = [[h, "heure", "heures"], [m, "minute", "minutes"], [s, "seconde", "secondes"]];
  const used = parts.filter(([n]) => n > 0);
  if (used.length === 1) return unit(used[0][0], used[0][1], used[0][2]);
  // Deux unités qui se suivent (heures + minutes, minutes + secondes) : la 2e se dit sans unité, comme à l'oral.
  if (used.length === 2 && ((h > 0 && m > 0) || (m > 0 && s > 0))) return `${unit(used[0][0], used[0][1], used[0][2])} ${frenchNumber(used[1][0])}`;
  return used.map(([n, one, many]) => unit(n, one, many)).join(", ").replace(/, ([^,]*)$/, " et $1");
}

/** « de cinq minutes », « d'une minute » (élision devant « un / une » seulement). */
const deOf = (words: string) => (/^une?\b/.test(words) ? `d'${words}` : `de ${words}`);

export const alarmConfirmation = (hour: number, minutes: number) => `Ok, réveil réglé à ${hourWords(hour, minutes)}.`;
export const timerConfirmation = (seconds: number) => `Minuteur ${deOf(durationWords(seconds))} lancé.`;
export const alarmFailure = "Je n'ai pas réussi à régler le réveil.";
export const timerFailure = "Je n'ai pas réussi à lancer le minuteur.";

// Sur le web (hors coque Android) : la carte avec son bouton. Cette phrase n'est écrite QUE quand la carte est réellement envoyée.
export const alarmWebText = (hour: number, minutes: number, when: string) => `Réveil ${when === "demain" ? "demain " : ""}à ${hourWords(hour, minutes)} prêt. Touche le bouton pour le créer.`;
export const timerWebText = (seconds: number) => `Minuteur ${deOf(durationWords(seconds))} prêt. Touche le bouton pour le lancer.`;
