// Dans la coque Android (Capacitor), un réveil / un minuteur se règle DIRECTEMENT dans l'Horloge du téléphone, sans bouton ni tap (plugin Alarm, voir android/).
// Sur le web (PWA, navigateur), rien de tout ça n'existe : on garde la carte avec son bouton. La phrase de confirmation est écrite par le CODE
// à partir de l'heure réellement envoyée à l'Horloge (alarm-speech.ts), jamais par l'IA.
import type { Card, CardParams } from "./alarm";
import { alarmConfirmation, alarmFailure, timerConfirmation, timerFailure } from "./alarm-speech";

type AlarmPlugin = {
  setAlarm: (o: { hour: number; minutes: number; message: string }) => Promise<{ ok?: boolean }>;
  setTimer: (o: { seconds: number; message: string }) => Promise<{ ok?: boolean }>;
};
type CapacitorGlobal = { isNativePlatform?: () => boolean; Plugins?: { Alarm?: AlarmPlugin } };
const cap = (): CapacitorGlobal | undefined => (typeof window === "undefined" ? undefined : (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor);

/** Vrai seulement dans la coque Android de majordome. */
export const isNative = () => cap()?.isNativePlatform?.() === true;

export type NativeResult = { ok: true; text: string } | { ok: false; text: string; reason: string };

/** Règle l'Horloge. Succès → la phrase de confirmation ; échec → « Je n'ai pas réussi… » (et la carte de repli reste affichée). */
export async function setNative(params: CardParams): Promise<NativeResult> {
  const failure = params.kind === "alarm" ? alarmFailure : timerFailure;
  const plugin = cap()?.Plugins?.Alarm;
  if (!isNative() || !plugin) return { ok: false, text: failure, reason: "plugin absent" };
  try {
    const r = params.kind === "alarm" ? await plugin.setAlarm({ hour: params.hour, minutes: params.minutes, message: params.label }) : await plugin.setTimer({ seconds: params.seconds, message: params.label });
    if (r?.ok === false) return { ok: false, text: failure, reason: "refusé" };
    return { ok: true, text: params.kind === "alarm" ? alarmConfirmation(params.hour, params.minutes) : timerConfirmation(params.seconds) };
  } catch (e) {
    return { ok: false, text: failure, reason: e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : "erreur" };
  }
}

/** Cartes à régler seules dans la coque : celles qui portent leurs paramètres. */
export const nativeParams = (cards: Card[]): CardParams[] => cards.flatMap((c) => (c.params ? [c.params] : []));
