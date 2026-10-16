"use client";

import { useRef, useState } from "react";
import { barPercent, dayTotals } from "@/lib/nutrition/food";
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

/** Réduit une capture avant envoi (limite de requête Vercel) : 1280 px max, JPEG. */
async function shrink(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.8);
}

/** Temps d'écran : saisie, capture lue par l'IA (avec confirmation) et tendance. Moins, c'est mieux : jamais de rouge. */
export function ScreenCard({ rows, accessCode, onUnauthorized, onSaved, onDelete }: { rows: ScreenRow[]; accessCode: string; onUnauthorized: () => void; onSaved: () => void; onDelete: (date: string) => void }) {
  const today = parisDay(new Date());
  const todayRow = rows.find((r) => r.date === today);
  const trend = screenTrend(rows, today);
  const [open, setOpen] = useState(false);
  const [hours, setHours] = useState(3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<{ minutes: number; date: string } | null>(null);
  const file = useRef<HTMLInputElement>(null);

  async function post(url: string, body: unknown) {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "x-access-code": accessCode }, body: JSON.stringify(body) });
    if (res.status === 401) {
      onUnauthorized();
      throw new Error("Code d'accès incorrect");
    }
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error ?? `Erreur serveur (${res.status})`);
    return d as { minutes: number; date: string };
  }
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Opération impossible");
    } finally {
      setBusy(false);
    }
  }
  const save = (minutes: number, date?: string) =>
    run(async () => {
      await post("/api/screen-time", { minutes, date });
      setOpen(false);
      setProposal(null);
      onSaved();
    });
  const readImage = (f: File) =>
    run(async () => {
      setProposal(await post("/api/screen-time/read", { image: await shrink(f) }));
    });

  return (
    <Card>
      <div className="flex items-center justify-between">
        <Label>Temps d&apos;écran</Label>
        <button onClick={() => setOpen(!open)} className="-my-2 -mr-2 min-h-11 px-2 text-[13px] font-medium text-accent">
          {todayRow ? "Modifier" : "Saisir"}
        </button>
      </div>
      {todayRow ? <p className="mt-1 text-[28px] font-semibold tabular-nums tracking-tight">{minutesLabel(todayRow.minutes)}</p> : <p className="mt-1 text-[15px] text-muted">Pas encore noté aujourd&apos;hui.</p>}
      {trend && <p className={`text-[13px] tabular-nums ${trend.direction === "down" ? "text-accent" : "text-muted"}`}>{trend.direction === "down" ? "↓" : trend.direction === "up" ? "↑" : "→"} {trend.label}</p>}

      {proposal && (
        <div className="rise mt-4 space-y-2 border-t border-line pt-4">
          <p className="text-[15px]">
            Lu sur la capture : <strong className="tabular-nums">{minutesLabel(proposal.minutes)}</strong> {proposal.date === today ? "aujourd'hui" : `le ${proposal.date}`}
          </p>
          <div className="flex gap-2">
            <button onClick={() => save(proposal.minutes, proposal.date)} disabled={busy} className="min-h-11 flex-1 rounded-full bg-accent text-[14px] font-semibold text-ink disabled:opacity-50">
              Enregistrer
            </button>
            <button onClick={() => setProposal(null)} className="min-h-11 flex-1 rounded-full bg-raised text-[14px] font-medium text-muted">
              Annuler
            </button>
          </div>
        </div>
      )}

      {open && !proposal && (
        <div className="rise mt-4 space-y-3 border-t border-line pt-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setHours((h) => Math.max(0, h - 0.25))} aria-label="Moins" className="flex size-11 items-center justify-center rounded-full bg-raised text-xl">
              −
            </button>
            <span className="flex-1 text-center text-[22px] font-semibold tabular-nums">{minutesLabel(Math.round(hours * 60))}</span>
            <button onClick={() => setHours((h) => Math.min(24, h + 0.25))} aria-label="Plus" className="flex size-11 items-center justify-center rounded-full bg-raised text-xl">
              +
            </button>
            <button onClick={() => save(Math.round(hours * 60))} disabled={busy} className="min-h-11 rounded-full bg-accent px-5 text-[14px] font-semibold text-ink disabled:opacity-50">
              OK
            </button>
          </div>
          <input ref={file} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && readImage(e.target.files[0])} />
          <button onClick={() => file.current?.click()} disabled={busy} className="min-h-11 text-[13px] font-medium text-muted disabled:opacity-50">
            {busy ? "Lecture…" : "Lire une capture « Bien-être numérique »"}
          </button>
          {todayRow && (
            <button onClick={() => onDelete(today)} className="block min-h-11 text-[13px] font-medium text-muted active:text-neg">
              Supprimer aujourd&apos;hui
            </button>
          )}
        </div>
      )}
      {error && <p className="mt-2 text-[13px] text-neg">{error}</p>}
    </Card>
  );
}
