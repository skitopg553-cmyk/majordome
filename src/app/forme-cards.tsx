"use client";

import { barPercent, dayTotals } from "@/lib/nutrition/food";
import { DEMO_FORME, DEMO_PHASE } from "@/lib/demo-data";
import { Bar, Card, DemoBanner, Label } from "./ui";

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
        <p className="mt-3 text-[14px] text-muted">Rien noté. Dis par exemple « j&apos;ai mangé 50 g de riz » à Majordome.</p>
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

/** Temps d'écran : APERÇU fictif (une PWA ne peut pas le lire ; la vraie saisie viendra plus tard, voir docs/temps-ecran.md). */
export function ScreenDemoCard() {
  return (
    <Card>
      <Label>Temps d&apos;écran</Label>
      <p className="mt-1 text-[28px] font-semibold tabular-nums tracking-tight">{DEMO_FORME.screenTime.today}</p>
      <p className="text-[13px] text-muted">{DEMO_FORME.screenTime.trend}</p>
      <div className="mt-3">
        <DemoBanner phase={DEMO_PHASE.forme} what="temps d'écran fictif" />
      </div>
    </Card>
  );
}
