"use client";

import { useCallback, useEffect, useState } from "react";
import type { OneOff } from "@/lib/habits";
import { hoursLabel, weekStats, type Sleep, type Workout } from "@/lib/forme";
import type { StoredRule } from "@/lib/recurrence";
import type { SlotException } from "@/lib/slots";
import { plannedSessions } from "@/lib/sports";
import type { ScreenRow } from "@/lib/screen-time";
import { addDays, parisDay } from "@/lib/task-groups";
import { callApi } from "./api-client";
import { confirmDelete, deleteEntry, type DeleteTarget } from "./delete-entry";
import { NutritionCard, ScreenCard, type NutritionData } from "./forme-cards";
import { SportStats, Upcoming, WeekStrip } from "./forme-sport";
import { Bar, Card, Header, Label } from "./ui";

const DAYS = ["L", "M", "M", "J", "V", "S", "D"];
const KINDS = ["Musculation", "Boxe anglaise", "Course à pied", "Vélo", "Natation", "Football", "Yoga"];
type Slots = { rules: StoredRule[]; exceptions: SlotException[]; logs: { rule_id: number; day: string; status: "done" | "missed" }[]; oneoffs: OneOff[] };
type Data = { ready: false } | { ready: true; sleeps: Sleep[]; workouts: (Workout & { id?: number })[]; steps?: { date: string; steps: number }[]; nutrition?: NutritionData | null; screen?: ScreenRow[] };

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

export default function FormeView({ accessCode, onUnauthorized, onAvatar }: { accessCode: string; onUnauthorized: () => void; onAvatar: () => void }) {
  const [data, setData] = useState<Data | null>(null);
  const [slots, setSlots] = useState<Slots>({ rules: [], exceptions: [], logs: [], oneoffs: [] }); // créneaux prévus : pour « séances prévues » et la régularité
  const [form, setForm] = useState<"sleep" | "workout" | null>(null);
  const [hours, setHours] = useState(7.5);
  const [kind, setKind] = useState(KINDS[0]);
  const [minutes, setMinutes] = useState(60);
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<number | null>(null); // séance dont on règle la durée
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
  useEffect(() => {
    fetch("/api/slots", { headers: { "x-access-code": accessCode } })
      .then(async (r) => (r.ok ? await r.json() : null))
      .then((d) => d?.ready && setSlots({ rules: d.rules ?? [], exceptions: d.exceptions ?? [], logs: d.logs ?? [], oneoffs: d.oneoffs ?? [] }))
      .catch(() => {}); // sans créneaux : la semaine montre seulement ce qui est fait
  }, [accessCode]);

  // Suppression définitive (toujours après confirmation), puis rechargement de l'écran.
  async function remove(target: DeleteTarget, what: string) {
    if (!confirmDelete(what)) return;
    try {
      await deleteEntry(accessCode, target, onUnauthorized);
      setForm(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Suppression impossible");
    }
  }

  async function save(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      await callApi(accessCode, "/api/forme", { method: "POST", body: { date: parisDay(new Date()), ...body }, onUnauthorized });
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
    const planned = plannedSessions({ ...slots, workouts: data.workouts, now });
    const weekList = data.workouts.filter((w) => w.id && w.date >= week.days[0] && w.date <= week.days[6]).sort((a, b) => b.date.localeCompare(a.date));
    const chip = (active: boolean) => `min-h-10 rounded-full px-3.5 text-[13px] font-medium transition-colors ${active ? "bg-accent text-ink" : "bg-raised text-muted"}`;

    return (
      <div className="space-y-3 px-4 pb-6">
        <Header title="Forme" subtitle="Santé, sport et productivité" onAvatar={onAvatar} />

        {/* Sport : régularité de la semaine */}
        <Card>
          <div className="flex items-center justify-between">
            <Label>Votre semaine de sport</Label>
            <button onClick={() => setForm(form === "workout" ? null : "workout")} className="-my-2 -mr-2 min-h-11 px-2 text-[13px] font-medium text-accent">
              J&apos;ai fait une séance
            </button>
          </div>
          <WeekStrip days={week.days} today={today} planned={planned} workouts={data.workouts} />
          <p className="mt-3 text-[14px] text-muted">
            {week.sessions === 0
              ? "Aucune séance cette semaine pour l'instant."
              : `${week.sessions} séance${week.sessions > 1 ? "s" : ""} faite${week.sessions > 1 ? "s" : ""} · ${week.activeDays} jour${week.activeDays > 1 ? "s" : ""} actif${week.activeDays > 1 ? "s" : ""}`}
          </p>
          <Upcoming planned={planned} week={week.days} />
          {weekList.length > 0 && (
            <ul className="mt-1 divide-y divide-line/60">
              {weekList.map((w) => (
                <li key={w.id} className="flex items-center gap-3 py-1">
                  <span className="min-w-0 flex-1 truncate text-[14px]">
                    {w.kind}
                    <span> </span>
                    <button onClick={() => setEditId(editId === w.id ? null : w.id!)} aria-label="Modifier la durée" className="-my-3 min-h-11 text-faint active:text-fg">
                      · {w.minutes ? `${w.minutes} min` : "durée ?"}
                    </button>
                    <span className="text-faint"> · {new Date(`${w.date}T12:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "UTC", weekday: "short" })}</span>
                  </span>
                  {editId === w.id && (
                    <span className="flex items-center gap-1">
                      {[-15, 15].map((delta) => (
                        <button key={delta} disabled={busy} onClick={() => save({ type: "workout-minutes", id: w.id, minutes: Math.min(600, Math.max(5, (w.minutes ?? 60) + delta)) })} className="min-h-11 rounded-full bg-raised px-3 text-[13px] font-medium tabular-nums active:scale-95 disabled:opacity-50">
                          {delta > 0 ? "+" : "−"}15
                        </button>
                      ))}
                    </span>
                  )}
                  <button onClick={() => remove({ table: "workouts", id: w.id! }, `la séance « ${w.kind} » du ${w.date}`)} aria-label={`Supprimer la séance ${w.kind}`} className="-mr-2 flex size-11 shrink-0 items-center justify-center rounded-full text-muted active:bg-raised active:text-neg">
                    <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
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
                Noter la séance d&apos;aujourd&apos;hui
              </button>
            </div>
          )}
        </Card>

        <SportStats planned={planned} workouts={data.workouts} since={addDays(today, -27)} />

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
            <p className="mt-1 text-[15px] text-muted">Votre nuit n&apos;est pas encore notée, Monsieur.</p>
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
          {form === "sleep" && lastNight && (
            <button onClick={() => remove({ table: "sleep_logs", date: today }, "la nuit d'aujourd'hui")} className="mt-2 min-h-11 text-[13px] font-medium text-muted active:text-neg">
              Supprimer cette nuit
            </button>
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
          <div className="flex items-center justify-between">
            <Label>Pas aujourd&apos;hui</Label>
            {todaySteps !== undefined && (
              <button onClick={() => remove({ table: "steps_logs", date: today }, "les pas d'aujourd'hui")} className="-my-3 -mr-2 min-h-11 px-2 text-[13px] font-medium text-muted active:text-neg">
                Effacer
              </button>
            )}
          </div>
          {todaySteps !== undefined ? (
            <>
              <p className="mt-1 text-[28px] font-semibold tabular-nums tracking-tight">{todaySteps.toLocaleString("fr-FR")}</p>
              <div className="mt-2">
                <Bar value={todaySteps} max={10000} />
              </div>
              <p className="mt-1.5 text-[12px] text-faint">Objectif indicatif : 10 000</p>
            </>
          ) : (
            <p className="mt-1 text-[15px] text-muted">Pas encore notés. Dites à Majordome combien vous en avez faits.</p>
          )}
        </Card>
        {data.nutrition && <NutritionCard data={data.nutrition} onDelete={(m) => remove({ table: "food_logs", id: m.id }, `« ${m.label} » (${m.grams} g)`)} />}
        <ScreenCard rows={data.screen ?? []} accessCode={accessCode} onSynced={load} />
      </div>
    );
  }

  /* ---------- Base pas prête ou indisponible : aucun chiffre inventé ---------- */
  return (
    <div className="space-y-3 px-4 pb-6">
      <Header title="Forme" subtitle="Santé, sport et productivité" onAvatar={onAvatar} />
      <Card>
        <p className="text-[17px] font-semibold tracking-tight">Forme indisponible pour l&apos;instant</p>
        <p className="mt-1 text-[13px] leading-snug text-muted">Impossible de lire vos données. Vérifiez votre connexion puis rouvrez l&apos;onglet.</p>
        <button onClick={load} className="mt-3 min-h-11 rounded-full bg-raised px-4 text-[13px] font-medium ring-1 ring-line active:scale-95">
          Réessayer
        </button>
      </Card>
    </div>
  );
}
