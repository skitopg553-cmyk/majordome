// Temps d'écran RÉEL : seulement dans la coque Android (plugin Usage, voir android/). Sur le web, une PWA ne peut pas le lire.
import { isNative } from "./native-alarm";

type UsagePlugin = {
  hasAccess: () => Promise<{ granted: boolean }>;
  openSettings: () => Promise<unknown>;
  days: (o: { count: number }) => Promise<{ days: { date: string; minutes: number }[] }>;
};
const plugin = (): UsagePlugin | undefined => (window as unknown as { Capacitor?: { Plugins?: { Usage?: UsagePlugin } } }).Capacitor?.Plugins?.Usage;

/** La coque Android avec le plugin Usage (une ancienne version de l'APK n'a pas le plugin : on reste en « indisponible »). */
export const usageAvailable = () => typeof window !== "undefined" && isNative() && !!plugin();

export const usageGranted = async () => (await plugin()?.hasAccess())?.granted === true;
export const openUsageSettings = () => plugin()?.openSettings();
/** Minutes d'écran des `count` derniers jours (aujourd'hui compris), tels que lus par Android. */
export const usageDays = async (count = 14) => (await plugin()?.days({ count }))?.days ?? [];
