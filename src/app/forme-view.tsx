"use client";

import { useCallback, useEffect, useState } from "react";
import { DEMO_FORME as S, DEMO_PHASE } from "@/lib/demo-data";
import { hoursLabel, weekStats, type Sleep, type Workout } from "@/lib/forme";
import { addDays, parisDay } from "@/lib/task-groups";
import { Bar, Card, DemoBanner, Header, Label } from "./ui";

const DAYS = ["L", "M", "M", "J", "V", "S", "D"];
const KINDS = ["Salle", "Course à pied", "Vélo", "Natation", "Foot", "Yoga"];
type Data = { ready: false } | { ready: true; sleeps: Sleep[]; workouts: Workout[]; steps?: { date: string; steps: number }[] };

/** Anneau de progression (pas, score). */
function Ring({ value, max, children }: { value: number; max: number; children: React.ReactNode }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative size-24 shrink-0">
      <svg viewBox="0 0 80 80" className="size-full -rotate-90" aria-hidden>
        <circle cx="40" cy="40" r={r} fill="none" stroke="var(--color-raised)" strokeWidth="6" />
        <circle cx="40" cy="40" r={r} fill="none" stroke="var(--color-accent)" strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, value / max))} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

/** Barres de sommeil (une par nuit). */
function SleepBars({ nights }: { nights: { label: string; hours: number | null; current: boolean }[] }) {
  const max = Math.max(9, ...nights.map((n) => n.hours ?? 0));
  return (
    <div className="mt-4 flex h-24 gap-2" aria-label="Sommeil des 7 dernières nuits">
      {nights.map((n, i) => (
        <div key={i} className="flex h-full flex-1 flex-col items-center gap-1.5">
          <div className="flex w-full flex-1 items-end">
            {n.hours !== null ? (
              <div className={`w-full rounded-md ${n.current ? "bg-accent" : "bg-raised"}`} style={{ height: `${(n.hours / max) * 100}%` }} title={hoursLabel(n.hours)} />
            ) : (
              <div className="h-1 w-full rounded-md bg-raised/60" title="Pas noté" />
            )}
          </div>
          <span className="text-[10px] text-faint">{n.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Cartes encore sans source de données (pas, temps d'écran) : toujours fictives, avec bandeau. */
function DemoExtras() {
  return (
    <>
      <Card className="flex items-center gap-5">
        <Ring value={S.steps.count} max={S.steps.goal}>
          <span className="text-lg font-semibold tabular-nums">{(S.steps.count / 1000).toFixed(1).replace(".", ",")}k</span>
          <span className="text-[10px] text-faint">/ {S.steps.goal / 1000}k pas</span>
        </Ring>
        <dl className="min-w-0 flex-1 space-y-3 text-[15px]">
          <div>
            <dt className="text-xs text-faint">Temps d&apos;écran aujourd&apos;hui</dt>
            <dd>{S.screenTime.today}</dd>
          </div>
          <div>
            <dt className="text-xs text-faint">Série en cours</dt>
            <dd>{S.discipline.streak} jours</dd>
          </div>
        </dl>
      </Card>
      <div className="px-1">
        <DemoBanner phase={DEMO_PHASE.forme} what="pas et temps d'écran fictifs" />
      </div>
    </>
  );
}

export default function FormeView({ accessCode, onUnauthorized, onAvatar }: { accessCode: string; onUnauthorized: () => void; onAvatar: () => void }) {
  const [data, setData] = useState<Data | null>(null);
  const [form, setForm] = useState<"sleep" | "workout" | null>(null);
  const [hours, setHours] = useState(7.5);
  const [kind, setKind] = useState(KINDS[0]);
  const [minutes, setMinutes] = useState(60);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/forme", { headers: { "x-access-code": accessCode } })
      .then(async (r) => {
        if (r.status === 401) return onUnauthorized();
        setData(r.ok ? await r.json() : { ready: false });
      })
      .catch(() => setData({ ready: false }));
  }, [accessCode, onUnauthorized]);

  useEffect(load, [load]);

  async function save(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/forme", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-access-code": accessCode },
        body: JSON.stringify({ date: parisDay(new Date()), ...body }),
      });
      if (res.status === 401) return onUnauthorized();
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? `Erreur serveur (${res.status})`);
      setForm(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enregistrement impossible");
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return (
      <div className="space-y-3 px-4 pb-6">
        <Header title="Forme" subtitle="Santé, sport et productivité" onAvatar={onAvatar} />
        {[150, 190, 130].map((h) => (
          <div key={h} className="animate-pulse rounded-[22px] bg-surface" style={{ height: h }} />
        ))}
      </div>
    );
  }

  /* ---------- Données réelles (saisie manuelle) ---------- */
  if (data.ready) {
    const now = new Date();
    const week = weekStats(data.workouts, data.sleeps, now);
    const today = parisDay(now);
    const last7 = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
    const lastNight = data.sleeps.find((s) => s.date === today);
    const todaySteps = data.steps?.find((s) => s.date === today)?.steps;
    const chip = (active: boolean) => `min-h-10 rounded-full px-3.5 text-[13px] font-medium transition-colors ${active ? "bg-accent text-ink" : "bg-raised text-muted"}`;

    return (
      <div className="space-y-3 px-4 pb-6">
        <Header title="Forme" subtitle="Santé, sport et productivité" onAvatar={onAvatar} />

        {/* Sport : régularité de la semaine */}
        <Card>
          <div className="flex items-center justify-between">
            <Label>Ta semaine de sport</Label>
            <button onClick={() => setForm(form === "workout" ? null : "workout")} className="-my-2 -mr-2 min-h-11 px-2 text-[13px] font-medium text-accent">
              + Séance
            </button>
          </div>
          <div className="mt-3 flex justify-between">
            {week.days.map((d, i) => (
              <div key={d} className="flex flex-col items-center gap-1.5">
                <span className={`size-8 rounded-full transition-colors duration-200 ${week.active[i] ? "glow bg-accent" : d === today ? "ring-1 ring-muted" : "bg-raised"}`} />
                <span className={`text-[11px] ${d === today ? "text-fg" : "text-faint"}`}>{DAYS[i]}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[14px] text-muted">
            {week.sessions === 0
              ? "Aucune séance cette semaine pour l'instant."
              : `${week.activeDays} jour${week.activeDays > 1 ? "s" : ""} actif${week.activeDays > 1 ? "s" : ""} · ${week.sessions} séance${week.sessions > 1 ? "s" : ""}`}
          </p>
          {form === "workout" && (
            <div className="rise mt-4 space-y-3 border-t border-line pt-4">
              <div className="flex flex-wrap gap-2">
                {KINDS.map((k) => (
                  <button key={k} onClick={() => setKind(k)} className={chip(kind === k)}>
                    {k}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                {[30, 45, 60, 90].map((m) => (
                  <button key={m} onClick={() => setMinutes(m)} className={chip(minutes === m)}>
                    {m} min
                  </button>
                ))}
              </div>
              <button onClick={() => save({ type: "workout", kind, minutes })} disabled={busy} className="min-h-11 w-full rounded-full bg-accent text-[14px] font-semibold text-ink disabled:opacity-50">
                Ajouter la séance d&apos;aujourd&apos;hui
              </button>
            </div>
          )}
        </Card>

        {/* Sommeil */}
        <Card>
          <div className="flex items-center justify-between">
            <Label>Sommeil</Label>
            <button onClick={() => setForm(form === "sleep" ? null : "sleep")} className="-my-2 -mr-2 min-h-11 px-2 text-[13px] font-medium text-accent">
              {lastNight ? "Modifier" : "Noter ma nuit"}
            </button>
          </div>
          {lastNight ? (
            <p className="mt-1 text-[28px] font-semibold tabular-nums tracking-tight">{hoursLabel(lastNight.hours)}</p>
          ) : (
            <p className="mt-1 text-[15px] text-muted">Tu n&apos;as pas encore noté ta nuit.</p>
          )}
          {week.avgSleep !== null && <p className="text-[13px] text-faint">Moyenne de la semaine : {hoursLabel(week.avgSleep)}</p>}
          {form === "sleep" && (
            <div className="rise mt-4 flex items-center gap-3 border-t border-line pt-4">
              <button onClick={() => setHours((h) => Math.max(1, h - 0.25))} aria-label="Moins" className="flex size-11 items-center justify-center rounded-full bg-raised text-xl">
                −
              </button>
              <span className="flex-1 text-center text-[22px] font-semibold tabular-nums">{hoursLabel(hours)}</span>
              <button onClick={() => setHours((h) => Math.min(16, h + 0.25))} aria-label="Plus" className="flex size-11 items-center justify-center rounded-full bg-raised text-xl">
                +
              </button>
              <button onClick={() => save({ type: "sleep", hours })} disabled={busy} className="min-h-11 rounded-full bg-accent px-5 text-[14px] font-semibold text-ink disabled:opacity-50">
                OK
              </button>
            </div>
          )}
          <SleepBars
            nights={last7.map((d) => ({
              label: DAYS[(new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7],
              hours: data.sleeps.find((s) => s.date === d)?.hours ?? null,
              current: d === today,
            }))}
          />
        </Card>
        {error && <p className="px-1 text-[13px] text-neg">{error}</p>}

        {/* Pas : réels (notés par toi ou par Majordome). Rien d'inventé en mode réel. */}
        <Card>
          <Label>Pas aujourd&apos;hui</Label>
          {todaySteps !== undefined ? (
            <>
              <p className="mt-1 text-[28px] font-semibold tabular-nums tracking-tight">{todaySteps.toLocaleString("fr-FR")}</p>
              <div className="mt-2">
                <Bar value={todaySteps} max={10000} />
              </div>
              <p className="mt-1.5 text-[12px] text-faint">Objectif indicatif : 10 000</p>
            </>
          ) : (
            <p className="mt-1 text-[15px] text-muted">Pas encore notés. Dis à Majordome combien tu en as faits.</p>
          )}
        </Card>
      </div>
    );
  }

  /* ---------- Aperçu FICTIF (phase 5 : tables pas encore créées) ---------- */
  return (
    <div className="space-y-3 px-4 pb-6">
      <Header title="Forme" subtitle="Santé, sport et productivité" onAvatar={onAvatar} />
      <div className="px-1">
        <DemoBanner phase={DEMO_PHASE.forme} />
      </div>

      <Card>
        <div className="flex items-baseline justify-between">
          <Label>Sommeil</Label>
          <p className="text-xs text-faint">Coucher {S.sleep.bedtime}</p>
        </div>
        <p className="mt-1 text-3xl font-semibold tabular-nums">{hoursLabel(S.sleep.hours)}</p>
        <SleepBars nights={S.sleep.week.map((h, i) => ({ label: DAYS[i], hours: h, current: i === S.sleep.week.length - 1 }))} />
      </Card>

      <Card>
        <Label>Séances</Label>
        <p className="mt-2 text-3xl font-semibold tabular-nums">
          {S.workouts.done}
          <span className="text-base text-faint"> / {S.workouts.goal} cette semaine</span>
        </p>
        <div className="mt-3">
          <Bar value={S.workouts.done} max={S.workouts.goal} />
        </div>
        <p className="mt-3 text-xs text-muted">{S.workouts.last}</p>
      </Card>

      <DemoExtras />
    </div>
  );
}
