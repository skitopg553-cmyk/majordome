"use client";

import { useEffect, useState } from "react";
import { barPercent, dayTotals } from "@/lib/nutrition/food";
import { openUsageSettings, usageAvailable, usageDays, usageGranted } from "@/lib/native-usage";
import { minutesLabel, screenTrend, type ScreenRow } from "@/lib/screen-time";
import { parisDay } from "@/lib/task-groups";
import { Bar, Card, Label } from "./ui";

export type Meal = { id: number; label: string; grams: number; kcal: number; protein: number; carbs: number; fat: number; estimated: number };
export type NutritionData = { meals: Meal[]; goals: { kcal: number | null; protein: number | null; carbs: number | null; fat: number | null } | null };

const TRASH = (
  <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3" />
  </svg>
);

/** Carte « Aujourd'hui » : calories + 3 barres fines pour les macros. Tout est calculé en code (src/lib/nutrition). */
export function NutritionCard({ data, onDelete }: { data: NutritionData; onDelete: (m: Meal) => void }) {
  const t = dayTotals(data.meals);
  const g = data.goals;
  const macros: { name: string; value: number; goal: number | null }[] = [
    { name: "Protéines", value: t.protein, goal: g?.protein ?? null },
    { name: "Glucides", value: t.carbs, goal: g?.carbs ?? null },
    { name: "Lipides", value: t.fat, goal: g?.fat ?? null },
  ];
  return (
    <Card>
      <Label>Aujourd&apos;hui</Label>
      <p className="mt-1 text-[28px] font-semibold tabular-nums tracking-tight">
        {t.estimated ? "≈ " : ""}
        {t.kcal.toLocaleString("fr-FR")}
        <span className="text-base font-normal text-faint"> {g?.kcal ? `/ ${g.kcal.toLocaleString("fr-FR")} ` : ""}kcal</span>
      </p>
      {g?.kcal ? (
        <div className="mt-2" role="img" aria-label={`${barPercent(t.kcal, g.kcal)} % de l'objectif calorique`}>
          <Bar value={t.kcal} max={g.kcal} over={t.kcal > g.kcal} />
        </div>
      ) : null}
      <div className="mt-4 space-y-3">
        {macros.map((m) => (
          <div key={m.name}>
            <div className="flex justify-between text-[13px]">
              <span className="text-muted">{m.name}</span>
              <span className="tabular-nums text-fg">
                {m.value} g<span className="text-faint">{m.goal ? ` / ${m.goal} g` : ""}</span>
              </span>
            </div>
            {m.goal ? (
              <div className="mt-1">
                <Bar value={m.value} max={m.goal} over={m.value > m.goal} />
              </div>
            ) : null}
          </div>
        ))}
      </div>
      {data.meals.length === 0 ? (
        <p className="mt-3 text-[14px] text-muted">Rien noté. Dites par exemple « j&apos;ai mangé 50 g de riz » à Majordome.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line/60">
          {data.meals.map((m) => (
            <li key={m.id} className="flex items-center gap-3 py-1">
              <span className="min-w-0 flex-1 truncate text-[14px]">
                {m.label}
                <span className="text-faint"> · {m.grams} g · {Math.round(m.kcal)} kcal</span>
              </span>
              {m.estimated ? <span className="shrink-0 rounded-full bg-raised px-2 py-0.5 text-[11px] text-muted">estimé</span> : null}
              <button onClick={() => onDelete(m)} aria-label={`Supprimer ${m.label}`} className="-mr-2 flex size-11 shrink-0 items-center justify-center rounded-full text-muted active:bg-raised active:text-neg">
                {TRASH}
              </button>
            </li>
          ))}
        </ul>
      )}
      {!g?.kcal && <p className="mt-2 text-[12px] text-faint">Pas d&apos;objectif : dis « mon objectif est 2200 kcal » à Majordome.</p>}
    </Card>
  );
}

/**
 * Temps d'écran RÉEL. Une PWA ne peut pas le lire : dans la coque Android, le plugin Usage le lit (après ton autorisation, une seule fois)
 * et on l'envoie à /api/screen-time. Sur le web : message honnête, aucun chiffre inventé.
 */
export function ScreenCard({ rows, accessCode, onSynced }: { rows: ScreenRow[]; accessCode: string; onSynced: () => void }) {
  const [mode, setMode] = useState<"web" | "needs" | "ok">("web");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!usageAvailable()) return;
    let alive = true;
    (async () => {
      if (!(await usageGranted())) return alive && setMode("needs");
      setMode("ok");
      for (const d of (await usageDays(14)).filter((x) => x.minutes > 0)) {
        const r = await fetch("/api/screen-time", { method: "POST", headers: { "Content-Type": "application/json", "x-access-code": accessCode }, body: JSON.stringify({ date: d.date, minutes: d.minutes }) });
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? `Erreur ${r.status}`);
      }
      if (alive) onSynced();
    })().catch((e) => alive && setError(e instanceof Error ? e.message : "Lecture impossible"));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- une seule synchro à l'ouverture de l'écran
  }, [accessCode]);

  const today = parisDay(new Date());
  const todayRow = rows.find((r) => r.date === today);
  const trend = screenTrend(rows, today);
  return (
    <Card>
      <Label>Temps d&apos;écran</Label>
      {todayRow ? (
        <>
          <p className="mt-1 text-[28px] font-semibold tabular-nums tracking-tight">{minutesLabel(todayRow.minutes)}</p>
          <p className="text-[13px] text-muted">{trend ? trend.label : "aujourd'hui"}</p>
        </>
      ) : mode === "needs" ? (
        <>
          <p className="mt-1 text-[15px] text-muted">Autorisez Majordome à lire votre temps d&apos;écran : une seule fois, dans les réglages d&apos;Android.</p>
          <button onClick={() => void openUsageSettings()} className="mt-3 min-h-11 rounded-full bg-accent px-4 text-[13px] font-semibold text-ink active:scale-95">
            Autoriser l&apos;accès
          </button>
        </>
      ) : mode === "ok" ? (
        <p className="mt-1 text-[15px] text-muted">Lecture en cours…</p>
      ) : (
        <p className="mt-1 text-[15px] text-muted">Le temps d&apos;écran réel est lu par l&apos;appli Android de Majordome (le navigateur n&apos;y a pas accès).</p>
      )}
      {error && <p className="mt-2 text-[12px] text-neg">{error}</p>}
    </Card>
  );
}
