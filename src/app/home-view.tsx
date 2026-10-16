"use client";

import { useEffect, useState } from "react";
import { DEMO_FINANCES, DEMO_FORME, DEMO_PHASE, DEMO_PROPOSALS, demoEvents, type DemoProposal } from "@/lib/demo-data";
import { goalProgress, monthTotals, type Tx } from "@/lib/finance/stats";
import { hoursLabel, weekStats, type Sleep, type Workout } from "@/lib/forme";
import { daySummary } from "@/lib/summary";
import { dayLabel, groupOf, parisDay } from "@/lib/task-groups";
import TaskRow from "./task-row";
import { Avatar, Bar, Card, DemoBanner, euro, greeting, hhmm, Label, SkeletonRows, Wordmark } from "./ui";
import type { TasksApi } from "./use-tasks";

type Go = (tab: "planning" | "finances" | "forme") => void;

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;

/** « Dans 25 min », « Aujourd'hui à 17:30 », « Demain à 10:00 »… */
function when(startIso: string, now: Date) {
  const min = Math.round((new Date(startIso).getTime() - now.getTime()) / 60_000);
  if (min <= 0) return "En cours";
  if (min < 60) return `Dans ${min} min`;
  return `${dayLabel(parisDay(new Date(startIso)), now)} à ${hhmm(startIso)}`;
}

/** Mini-courbe du solde (SVG, pas de librairie). */
function Sparkline({ values }: { values: number[] }) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * 100, 26 - ((v - min) / (max - min || 1)) * 22]);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="mt-3 h-10 w-full" aria-hidden>
      <defs>
        <linearGradient id="spark" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--color-accent)" stopOpacity="0.22" />
          <stop offset="1" stopColor="var(--color-accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L100,28 L0,28 Z`} fill="url(#spark)" />
      <path d={line} fill="none" stroke="var(--color-accent)" strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

const KIND_ICON: Record<DemoProposal["kind"], string> = {
  agenda: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  mail: "M3 6h18v12H3zM3 7l9 6 9-6",
  task: "M5 12l4 4 10-10",
};

type Fin = { ready: false } | { ready: true; transactions: Tx[]; goals: { label: string; target: number; saved: number; image_url: string | null }[] };
type Forme = { ready: false } | { ready: true; sleeps: Sleep[]; workouts: Workout[] };

export default function HomeView({ accessCode, tasks: api, go, onAvatar, onWeek }: { accessCode: string; tasks: TasksApi; go: Go; onAvatar: () => void; onWeek: () => void }) {
  const [decided, setDecided] = useState<Record<string, "ok" | "no">>({}); // « À valider » : choix locaux, rien n'est exécuté
  const now = new Date();
  const todo = api.tasks.filter((t) => t.status === "todo" || api.leaving.has(t.id));
  const late = todo.filter((t) => groupOf(t.due_at, now) === "En retard");
  const today = todo.filter((t) => groupOf(t.due_at, now) === "Aujourd'hui");
  const focus = [...late, ...today].sort((a, b) => a.priority - b.priority || (a.due_at ?? "").localeCompare(b.due_at ?? ""));
  const next = demoEvents().find((e) => new Date(e.end) > now);
  const f = DEMO_FINANCES;
  const s = DEMO_FORME;
  const pending = DEMO_PROPOSALS.filter((p) => !decided[p.id]).length;

  // Vraies données Finances / Forme si les tables existent ; sinon (ou en cas d'erreur) l'aperçu fictif reste.
  const [fin, setFin] = useState<Fin | null>(null);
  const [forme, setForme] = useState<Forme | null>(null);
  useEffect(() => {
    const get = (url: string) => fetch(url, { headers: { "x-access-code": accessCode } }).then((r) => (r.ok ? r.json() : { ready: false })).catch(() => ({ ready: false }));
    get("/api/finances").then(setFin);
    get("/api/forme").then(setForme);
  }, [accessCode]);
  const realMonth = fin?.ready ? monthTotals(fin.transactions, parisDay(now).slice(0, 7)) : null;
  const realGoal = fin?.ready ? fin.goals[0] : undefined;
  const goal = realGoal ?? f.goals[0];
  const realForme = forme?.ready
    ? { lastNight: forme.sleeps.find((x) => x.date === parisDay(now))?.hours ?? null, week: weekStats(forme.workouts, forme.sleeps, now) }
    : null;

  // Résumé du jour calculé en code (pas par l'IA), uniquement à partir des vraies tâches.
  const summary = api.loaded ? daySummary(today.length, late.length) : " ";

  return (
    <div className="space-y-3 px-4 pb-8">
      <div className="flex h-14 items-center justify-between px-1">
        <Wordmark className="text-[19px]" />
        <Avatar onClick={onAvatar} />
      </div>

      <div className="px-1 pb-2 pt-1">
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight">{greeting(now)} Ruben</h1>
        <p className="mt-1 text-[15px] leading-snug text-muted">{summary}</p>
      </div>

      {/* Tâches du jour — RÉELLES */}
      <Card>
        <div className="flex items-center justify-between">
          <Label>Aujourd&apos;hui</Label>
          <button onClick={() => go("planning")} className="-my-3 -mr-2 min-h-11 px-2 text-[13px] font-medium text-accent">
            Tout voir
          </button>
        </div>
        {api.error && <p className="mt-2 text-sm text-neg">{api.error}</p>}
        {!api.loaded && <SkeletonRows />}
        {api.loaded && focus.length === 0 && !api.error && <p className="mt-1 text-[15px] text-muted">Aucune tâche pour aujourd&apos;hui.</p>}
        {focus.length > 0 && (
          <ul className="mt-1 divide-y divide-line">
            {focus.slice(0, 5).map((t) => (
              <TaskRow key={t.id} t={t} done={t.status === "done" || api.leaving.has(t.id)} onToggle={() => api.toggle(t)} />
            ))}
          </ul>
        )}
        {focus.length > 5 && <p className="pt-1 text-xs text-faint">+ {focus.length - 5} autres dans le Planning</p>}
      </Card>

      {/* Prochain rendez-vous — FICTIF (phase 2) */}
      {next && (
        <Card onClick={() => go("planning")}>
          <div className="flex items-center justify-between gap-2">
            <Label>Prochain rendez-vous</Label>
            <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-[11px] font-medium text-accent">{when(next.start, now)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[18px] font-semibold tracking-tight">{next.title}</p>
              <p className="truncate text-[13px] text-muted">
                {hhmm(next.start)} – {hhmm(next.end)}
                {next.place ? ` · ${next.place}` : ""}
              </p>
            </div>
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-raised text-fg" aria-hidden>
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </span>
          </div>
          <div className="mt-3">
            <DemoBanner phase={DEMO_PHASE.agenda} />
          </div>
        </Card>
      )}

      {/* Argent — RÉEL si des opérations sont importées, sinon aperçu FICTIF (phase 4) */}
      {fin?.ready && fin.transactions.length > 0 ? (
        <Card onClick={() => go("finances")}>
          <Label>Ce mois-ci</Label>
          <p className="mt-1 text-[30px] font-semibold leading-none tracking-tight tabular-nums">{euro(realMonth!.spent, false)}</p>
          <p className="mt-1.5 text-[13px] text-muted">
            dépensés{realMonth!.income ? ` · ${euro(realMonth!.income, false)} reçus` : ""}
          </p>
        </Card>
      ) : (
        <Card onClick={() => go("finances")}>
          <Label>Solde</Label>
          <p className="mt-1 text-[30px] font-semibold leading-none tracking-tight tabular-nums">{euro(f.balance, false)}</p>
          <p className="mt-1.5 text-[13px] text-muted">{euro(f.monthSpent, false)} dépensés ce mois-ci</p>
          <Sparkline values={f.balanceHistory} />
          <div className="mt-2">
            <DemoBanner phase={DEMO_PHASE.finances} />
          </div>
        </Card>
      )}

      {/* Ton objectif, avec photo — réel s'il existe, sinon FICTIF (phase 4) */}
      <button onClick={() => go("finances")} className="relative block h-48 w-full overflow-hidden rounded-[22px] bg-surface text-left transition-transform active:scale-[0.985]">
        {goal.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={goal.image_url} alt="" className="absolute inset-0 size-full object-cover brightness-[0.75]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/55 to-transparent" />
        {!realGoal && (
          <div className="absolute left-4 top-4 rounded-full bg-ink/70 px-2.5 py-1 backdrop-blur">
            <DemoBanner phase={DEMO_PHASE.finances} />
          </div>
        )}
        <div className="absolute inset-x-4 bottom-4">
          <p className="text-[13px] font-medium text-fg/80">Ton objectif</p>
          <p className="truncate text-[19px] font-semibold tracking-tight">{goal.label}</p>
          <p className="mt-0.5 text-[13px] tabular-nums text-fg/75">
            {euro(goal.saved, false)} / {euro(goal.target, false)} · {goalProgress(goal.saved, goal.target)} %
          </p>
          <div className="mt-2.5">
            <Bar value={goal.saved} max={goal.target} />
          </div>
        </div>
      </button>

      {/* Ta forme : 3 chiffres — RÉELS si la saisie existe, sinon FICTIFS (phase 5) */}
      <Card onClick={() => go("forme")}>
        <Label>Ta forme</Label>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {(realForme
            ? [
                ["Nuit", realForme.lastNight !== null ? hoursLabel(realForme.lastNight) : "—"],
                ["Séances", String(realForme.week.sessions)],
                ["Jours actifs", `${realForme.week.activeDays} / 7`],
              ]
            : [
                ["Sommeil", hoursLabel(s.sleep.hours)],
                ["Pas", s.steps.count.toLocaleString("fr-FR")],
                ["Sport", `${s.workouts.done} / ${s.workouts.goal}`],
              ]
          ).map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-raised px-2 py-3">
              <p className="text-[12px] text-muted">{k}</p>
              <p className="mt-0.5 text-[18px] font-semibold tabular-nums tracking-tight">{v}</p>
            </div>
          ))}
        </div>
        {!realForme && (
          <div className="mt-3">
            <DemoBanner phase={DEMO_PHASE.forme} />
          </div>
        )}
      </Card>

      {/* Ta semaine (miroir, phase 6) — APERÇU */}
      <Card onClick={onWeek} className="flex items-center justify-between gap-3">
        <span>
          <span className="block text-[15px] font-medium">Ta semaine</span>
          <span className="block text-[13px] text-muted">Le bilan du dimanche soir, en aperçu</span>
        </span>
        <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
          <path d="M9 6l6 6-6 6" />
        </svg>
      </Card>

      {/* À valider : propositions que Ruben accepte ou refuse d'un tap — FICTIF (phase 2) */}
      <Card>
        <div className="flex items-center justify-between">
          <Label>À valider</Label>
          {pending > 0 && <span className="text-[12px] text-faint">{plural(pending, "proposition")}</span>}
        </div>
        <ul className="mt-2 space-y-2">
          {DEMO_PROPOSALS.map((p) => {
            const d = decided[p.id];
            return (
              <li key={p.id} className={`rounded-2xl bg-raised p-3 transition-opacity ${d ? "opacity-50" : ""}`}>
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink text-accent" aria-hidden>
                    <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      <path d={KIND_ICON[p.kind]} />
                    </svg>
                  </span>
                  <span className="min-w-0 flex-1 pt-0.5">
                    <span className="block text-[14px] font-medium leading-snug">{p.title}</span>
                    <span className="block text-[12px] text-faint">{d ? (d === "ok" ? "Validé" : "Refusé") : p.detail}</span>
                  </span>
                </div>
                {!d && (
                  <div className="mt-2 flex justify-end gap-2">
                    <button
                      onClick={() => setDecided((m) => ({ ...m, [p.id]: "no" }))}
                      aria-label={`Refuser : ${p.title}`}
                      className="min-h-11 rounded-full px-4 text-[13px] font-medium text-muted active:bg-ink"
                    >
                      Refuser
                    </button>
                    <button
                      onClick={() => setDecided((m) => ({ ...m, [p.id]: "ok" }))}
                      aria-label={`Valider : ${p.title}`}
                      className="min-h-11 rounded-full bg-accent px-5 text-[13px] font-semibold text-ink active:scale-95"
                    >
                      Valider
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <div className="mt-3">
          <DemoBanner phase={DEMO_PHASE.agenda} what="propositions fictives" />
        </div>
      </Card>
    </div>
  );
}
