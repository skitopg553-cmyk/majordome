"use client";

import { useEffect, useState } from "react";
import { resolveAlarm } from "@/lib/alarm";
import { isNative, setNative } from "@/lib/native-alarm";

/** Réglages → « Test réveil dans 2 minutes » : visible SEULEMENT dans la coque Android. Règle un vrai réveil à +2 min pour vérifier que ça marche, avant de brancher la voix. */
export default function NativeTestRow() {
  const [native, setNativeFlag] = useState(false);
  const [state, setState] = useState<{ text: string; ok: boolean; detail?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => setNativeFlag(isNative()), []);
  if (!native) return null;

  async function test() {
    setBusy(true);
    setState(null);
    const r = resolveAlarm({ in_minutes: 2, label: "Test majordome" }, new Date());
    if (!r.ok) {
      setState({ ok: false, text: r.error });
    } else {
      const res = await setNative({ kind: "alarm", hour: r.value.hour, minutes: r.value.minutes, label: r.value.label, when: r.value.when });
      setState({ ok: res.ok, text: res.text, detail: res.ok ? `Heure envoyée à l'Horloge : ${String(r.value.hour).padStart(2, "0")}:${String(r.value.minutes).padStart(2, "0")}. Ouvre l'appli Horloge pour vérifier.` : res.reason });
    }
    setBusy(false);
  }

  return (
    <div className="py-3">
      <button onClick={test} disabled={busy} className="flex min-h-11 w-full items-center text-left text-[15px] disabled:opacity-50">
        Test réveil dans 2 minutes
      </button>
      {state && (
        <p className={`text-xs ${state.ok ? "text-muted" : "text-neg"}`} role="status">
          {state.text}
          {state.detail ? ` (${state.detail})` : ""}
        </p>
      )}
    </div>
  );
}
