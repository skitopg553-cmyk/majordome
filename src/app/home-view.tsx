"use client";

import { useEffect, useState } from "react";
import { DEMO_FINANCES, DEMO_FORME, DEMO_PHASE, DEMO_PROPOSALS, type DemoProposal } from "@/lib/demo-data";
import { goalProgress, monthTotals, type Tx } from "@/lib/finance/stats";
import { hoursLabel, weekStats, type Sleep, type Workout } from "@/lib/forme";
import { daySummary } from "@/lib/summary";
import { homeTasks } from "@/lib/planning";
import { parisDay } from "@/lib/task-groups";
import TaskRow from "./task-row";
import TaskSheet from "./task-sheet";
import { Avatar, Bar, Card, DemoBanner, euro, greeting, Label, SkeletonRows, Wordmark } from "./ui";
import type { TasksApi } from "./use-tasks";

type Go = (tab: "planning" | "finances" | "forme") => void;

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;

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

type Fin = { ready: false } | { ready: true; snapshot?: { balance: number; asOf: string } | null; bank?: { ready: boolean; connection?: { bankName: string; balance: number | null } | null }; transactions: Tx[]; goals: { label: string; target: number; saved: number; image_url: string | null }[] };
type Forme = { ready: false } | { ready: true; sleeps: Sleep[]; workouts: Workout[] };

export default function HomeView({ accessCode, tasks: api, go, onAvatar, onWeek }: { accessCode: string; tasks: TasksApi; go: Go; onAvatar: () => void; onWeek: () => void }) {
  const [decided, setDecided] = useState<Record<string, "ok" | "no">>({}); // « À valider » : choix locaux, rien n'est exécuté
  const now = new Date();
  // Tâches = éléments SANS heure (les éléments avec une heure sont de l'agenda, dans le Planning). Celles qu'on vient de cocher restent le temps de l'animation.
  const list = homeTasks(api.tasks.map((t) => (api.leaving.has(t.id) ? { ...t, status: "todo" as const } : t)), now);
  const late = list.filter((t) => t.due_at && parisDay(new Date(t.due_at)) < parisDay(now));
  const today = list.filter((t) => t.due_at && parisDay(new Date(t.due_at)) === parisDay(now));
  const [expanded, setExpanded] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const shown = expanded ? list : list.slice(0, 5);
  const opened = openId !== null ? api.tasks.find((t) => t.id === openId) : undefined;
  const f = DEMO_FINANCES;
  const s = DEMO_FORME;
  const proposals = DEMO_PROPOSALS.filter((p) => p.kind !== "agenda"); // pas d'agenda sur l'Accueil
  const pending = proposals.filter((p) => !decided[p.id]).length;

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
  const bankBalance = fin?.ready && fin.bank?.ready ? (fin.bank.connection?.balance ?? null) : null; // vrai solde de la banque connectée, sinon null
  // Solde affiché : celui de la banque connectée (le plus frais), sinon celui du dernier relevé importé (avec sa date), sinon rien de réel.
  const shownBalance =
    bankBalance !== null
      ? { label: `Solde ${fin?.ready ? fin.bank?.connection?.bankName : ""}`.trim(), amount: bankBalance }
      : fin?.ready && fin.snapshot
        ? { label: `Solde au ${new Date(fin.snapshot.asOf + "T12:00:00Z").toLocaleDateString("fr-FR", { timeZone: "UTC", day: "numeric", month: "short" })}`, amount: fin.snapshot.balance }
        : null;
  const noGoalYet = !!fin?.ready && !realGoal; // finances réelles mais aucun objectif : on invite à en créer un (pas d'exemple fictif)
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

      {/* Tâches (éléments sans heure) — RÉELLES. En retard, puis aujourd'hui, puis sans date ; 5 visibles, le reste se déplie. */}
      <Card>
        <Label>Tâches</Label>
        {api.error && <p className="mt-2 text-sm text-neg">{api.error}</p>}
        {!api.loaded && <SkeletonRows />}
        {api.loaded && list.length === 0 && !api.error && <p className="mt-1 text-[15px] text-muted">Rien à faire. Profites-en.</p>}
        {shown.length > 0 && (
          <ul className="mt-1">
            {shown.map((t) => (
              <TaskRow key={t.id} t={t} leaving={api.leaving.has(t.id)} onToggle={() => api.toggle(t)} onOpen={() => setOpenId(t.id)} />
            ))}
          </ul>
        )}
        {list.length > 5 && (
          <button onClick={() => setExpanded((v) => !v)} aria-expanded={expanded} className="-mb-2 min-h-11 text-[13px] font-medium text-accent">
            {expanded ? "Réduire" : `+${list.length - 5}`}
          </button>
        )}
        <form
          className="mt-1 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const title = newTitle.trim();
            if (!title) return;
            api.add(title, null, 2); // sans date ni heure : une tâche
            setNewTitle("");
          }}
        >
          <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Nouvelle tâche…" aria-label="Nouvelle tâche" className="h-11 min-w-0 flex-1 rounded-full bg-raised px-4 text-[15px] outline-none placeholder:text-faint focus:ring-1 focus:ring-accent/50" />
        </form>
      </Card>
      {opened && <TaskSheet key={opened.id} t={opened} api={api} onClose={() => setOpenId(null)} />}

      {/* Argent — RÉEL si des opérations sont importées, sinon aperçu FICTIF (phase 4) */}
      {fin?.ready && shownBalance ? (
        <Card onClick={() => go("finances")}>
          <Label>{shownBalance.label}</Label>
          <p className="mt-1 text-[30px] font-semibold leading-none tracking-tight tabular-nums">{euro(shownBalance.amount)}</p>
          <p className="mt-1.5 text-[13px] text-muted">{euro(realMonth!.spent, false)} dépensés ce mois-ci</p>
        </Card>
      ) : fin?.ready && fin.transactions.length > 0 ? (
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

      {/* Ton objectif — réel s'il existe (dégradé par défaut, sans photo), invitation si aucun, sinon FICTIF avec photo (phase 4) */}
      {noGoalYet ? (
        <Card onClick={() => go("finances")}>
          <Label>Ton objectif</Label>
          <p className="mt-1 text-[17px] font-semibold tracking-tight">Pas encore d&apos;objectif</p>
          <p className="mt-0.5 text-[13px] leading-snug text-muted">Dis à Majordome ce que tu veux mettre de côté, ou crée-le dans Finances.</p>
        </Card>
      ) : (
      <button onClick={() => go("finances")} className={`relative block h-48 w-full overflow-hidden rounded-[22px] text-left transition-transform active:scale-[0.985] ${goal.image_url ? "bg-surface" : "goal-default"}`}>
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
      )}

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
          {proposals.map((p) => {
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
