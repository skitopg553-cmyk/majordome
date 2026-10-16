"use client";

import { useEffect, useState } from "react";
import { usd, type CostSummary } from "@/lib/costs";

/** « Coût de l'IA » : aujourd'hui, ce mois-ci, et par modèle. Calcul en code (src/lib/costs.ts), en dollars comme les tarifs des fournisseurs. */
export default function CostCard({ accessCode, onUnauthorized }: { accessCode: string; onUnauthorized: () => void }) {
  const [s, setS] = useState<(CostSummary & { truncated?: boolean }) | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/costs", { headers: { "x-access-code": accessCode } })
      .then(async (r) => {
        if (r.status === 401) return onUnauthorized();
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error ?? `Erreur serveur (${r.status})`);
        setS(d);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Erreur inconnue"));
  }, [accessCode, onUnauthorized]);

  return (
    <div className="rounded-3xl bg-surface px-4 py-4">
      <p className="text-[15px]">Coût de l&apos;IA</p>
      {error ? (
        <p className="mt-1 break-words text-xs text-neg">{error}</p>
      ) : !s ? (
        <div className="mt-2 h-10 animate-pulse rounded-xl bg-raised" aria-hidden />
      ) : (
        <>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-faint">Aujourd&apos;hui</p>
              <p className="text-[22px] font-semibold tabular-nums tracking-tight">{usd(s.today.cost)}</p>
              <p className="text-xs text-faint">
                {s.today.calls} appel{s.today.calls > 1 ? "s" : ""}
              </p>
            </div>
            <div>
              <p className="text-xs text-faint">Ce mois-ci</p>
              <p className="text-[22px] font-semibold tabular-nums tracking-tight">{usd(s.month.cost)}</p>
              <p className="text-xs text-faint">
                {s.month.calls} appel{s.month.calls > 1 ? "s" : ""}
              </p>
            </div>
          </div>
          {s.byModel.length > 0 && (
            <ul className="mt-3 divide-y divide-line/60 text-[13px]">
              {s.byModel.map((m) => (
                <li key={m.model} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0 truncate text-muted">{m.model}</span>
                  <span className="shrink-0 tabular-nums">
                    {usd(m.cost)} <span className="text-faint">· {m.calls}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {s.unpriced > 0 && <p className="mt-2 text-xs leading-snug text-faint">{s.unpriced} appel{s.unpriced > 1 ? "s" : ""} sans prix connu (compté{s.unpriced > 1 ? "s" : ""} à $0) : le total est sous-estimé. Pour OpenAI, renseigne les variables OPENAI_PRICE_* dans Vercel.</p>}
          {s.truncated && <p className="mt-2 text-xs text-faint">Plus de 10 000 appels ce mois-ci : le total est partiel.</p>}
        </>
      )}
    </div>
  );
}
