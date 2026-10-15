"use client";

import { useEffect, useState } from "react";

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY; // clé publique (pas un secret), fixée au build

/** Clé VAPID base64url → octets attendus par pushManager.subscribe. */
function keyBytes(b64: string) {
  const raw = atob((b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

type State = "loading" | "unsupported" | "not-configured" | "off" | "on" | "denied";

/** Réglage « Rappels » : abonne ce téléphone aux notifications push (après son accord). */
export default function RemindersRow({ accessCode }: { accessCode: string }) {
  const [state, setState] = useState<State>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setState("unsupported");
    if (!VAPID) return setState("not-configured");
    if (Notification.permission === "denied") return setState("denied");
    navigator.serviceWorker
      .getRegistration()
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => setState(sub ? "on" : "off"))
      .catch(() => setState("off"));
  }, []);

  async function enable() {
    setError(null);
    try {
      if ((await Notification.requestPermission()) !== "granted") return setState("denied");
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID!) });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-access-code": accessCode },
        body: JSON.stringify(sub.toJSON()),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        await sub.unsubscribe(); // le serveur ne le connaît pas : on ne laisse pas un abonnement fantôme
        throw new Error(d.error ?? `Erreur serveur (${res.status})`);
      }
      setState("on");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Activation impossible");
    }
  }

  const hint: Record<State, string> = {
    loading: "…",
    unsupported: "Pas disponible sur ce navigateur",
    "not-configured": "Bientôt disponible",
    off: "Une notification à l'heure de tes tâches",
    on: "Activés sur ce téléphone",
    denied: "Notifications bloquées dans les réglages du téléphone",
  };

  return (
    <div className="flex min-h-14 items-center justify-between gap-4 py-2">
      <span className="min-w-0">
        <span className="block text-[15px]">Rappels</span>
        <span className={`block text-xs ${error ? "text-neg" : "text-faint"}`}>{error ?? hint[state]}</span>
      </span>
      {state === "off" && (
        <button onClick={enable} className="min-h-11 shrink-0 rounded-full bg-accent px-4 text-[13px] font-semibold text-ink active:scale-95">
          Activer
        </button>
      )}
      {state === "on" && <span className="glow size-2.5 shrink-0 rounded-full bg-accent" aria-hidden />}
    </div>
  );
}
