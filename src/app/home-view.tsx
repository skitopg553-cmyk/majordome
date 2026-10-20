"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { goalProgress, monthTotals, spendingByCategory, type Budget, type Tx } from "@/lib/finance/stats";
import { hoursLabel, weekStats, type Sleep, type Workout } from "@/lib/forme";
import { dayBriefing } from "@/lib/rituals";
import { briefing } from "@/lib/briefing";
import { habitQuestions } from "@/lib/habits";
import { homeTasks, isAgenda } from "@/lib/planning";
import { occurrencesOn } from "@/lib/slots";
import { addDays, parisDay } from "@/lib/task-groups";
import Majordome from "./majordome";
import RitualDeck from "./rituals-deck";
import TaskRow from "./task-row";
import TaskSheet from "./task-sheet";
import { Avatar, Bar, Card, euro, greeting, Label, SkeletonRows, Wordmark } from "./ui";
import type { GoogleApi } from "./use-google";
import type { SlotsApi } from "./use-slots";
import type { TasksApi } from "./use-tasks";

type Go = (tab: "planning" | "finances" | "forme") => void;

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;

type Fin = { ready: false } | { ready: true; snapshot?: { balance: number; asOf: string } | null; bank?: { ready: boolean; connection?: { bankName: string; balance: number | null } | null }; transactions: Tx[]; budgets?: Budget[]; savings?: { capacity: { months: number; free: number } }; goals: { label: string; target: number; saved: number; image_url: string | null }[] };
type Forme = { ready: false } | { ready: true; sleeps: (Sleep & { bed_time?: string | null; wake_time?: string | null })[]; workouts: Workout[]; nutrition?: { meals: { kcal: number; created_at?: string }[] } | null };

export default function HomeView({ accessCode, tasks: api, google, slots, googleNotice, go, onAsk, onListen, onAvatar, onWeek, onUnauthorized }: { accessCode: string; tasks: TasksApi; google: GoogleApi; slots: SlotsApi; googleNotice: string | null; go: Go; onAsk: (text: string) => void; onListen: (prefix: string) => void; onAvatar: () => void; onWeek: () => void; onUnauthorized: () => void }) {
  const gOk = google.state === "ok";
  const now = new Date();
  // Tâches = éléments SANS heure (les éléments avec une heure sont de l'agenda, dans le Planning). Celles qu'on vient de cocher restent le temps de l'animation.
  const list = homeTasks(api.tasks.map((t) => (api.leaving.has(t.id) ? { ...t, status: "todo" as const } : t)), now);
  const [expanded, setExpanded] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const shown = expanded ? list : list.slice(0, 5);
  const opened = openId !== null ? api.tasks.find((t) => t.id === openId) : undefined;

  // Vraies données Finances / Forme uniquement (rien de fictif).
  const [fin, setFin] = useState<Fin | null>(null);
  const [forme, setForme] = useState<Forme | null>(null);
  const get = useCallback((url: string) => fetch(url, { headers: { "x-access-code": accessCode } }).then((r) => (r.ok ? r.json() : { ready: false })).catch(() => ({ ready: false })), [accessCode]);
  const reloadForme = useCallback(() => void get("/api/forme").then(setForme), [get]);
  useEffect(() => {
    get("/api/finances").then(setFin);
    reloadForme();
  }, [get, reloadForme]);
  const speakBriefing = useRef<(() => void) | null>(null); // rempli par le paquet de rituels : un tap sur la mascotte lit « Votre journée »
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
  const realForme = forme?.ready
    ? { lastNight: forme.sleeps.find((x) => x.date === parisDay(now))?.hours ?? null, week: weekStats(forme.workouts, forme.sleeps, now), kcal: forme.nutrition?.meals.length ? Math.round(forme.nutrition.meals.reduce((a, m) => a + m.kcal, 0)) : null }
    : null;

  // Briefing du jour : 3 lignes calculées en code (pas par l'IA), à partir des vraies données.
  const over = fin?.ready ? spendingByCategory(fin.transactions, parisDay(now).slice(0, 7), fin.budgets ?? []).find((r) => r.over && r.limit !== null) : undefined;
  // Les créneaux qui reviennent (travail, salle…) comptent dans « Prochain » et « Demain » : on les calcule pour la semaine à venir.
  const slotEvents = Array.from({ length: 8 }, (_, i) => occurrencesOn(slots.rules, slots.exceptions, addDays(parisDay(now), i))).flat().map((o) => ({ title: o.title, start: o.start, allDay: false }));
  // « Votre journée, Monsieur » : créneaux du jour (règles + éléments datés), pense-bêtes, bilans en attente : assemblé en code.
  const todayIso = parisDay(now);
  const todaySlots = [
    ...occurrencesOn(slots.rules, slots.exceptions, todayIso).map((o) => ({ title: o.title, start: o.start, end: o.end })),
    ...api.tasks.filter((t) => t.status === "todo" && !t.recurring && isAgenda(t) && parisDay(new Date(t.due_at!)) === todayIso).map((t) => ({ title: t.title, start: t.due_at!, end: t.end_at ?? null })),
  ];
  const day = dayBriefing({ slots: todaySlots, reminders: list.map((t) => t.title), pendingChecks: habitQuestions({ rules: slots.rules, exceptions: slots.exceptions, logs: slots.logs, oneoffs: slots.oneoffs, now }).length });
  const lines = api.loaded
    ? briefing({
        tasks: api.tasks,
        events: [...(gOk ? google.events : []), ...slotEvents],
        mails: gOk ? google.mails : null,
        now,
        free: fin?.ready && fin.savings && fin.savings.capacity.months > 0 ? fin.savings.capacity.free : null,
        overBudget: over ? { category: over.category, over: over.spent - over.limit! } : null,
      })
    : [];

  return (
    <div className="space-y-3 px-4 pb-8">
      <div className="flex h-14 items-center justify-between px-1">
        <span className="flex items-center gap-2.5">
          <Wordmark className="text-[19px]" />
          <button onClick={() => speakBriefing.current?.()} aria-label="Écouter votre journée" className="flex size-11 items-center justify-center rounded-full bg-ink ring-1 ring-line/70 active:scale-95">
            <Majordome size={13} />
          </button>
        </span>
        <Avatar onClick={onAvatar} />
      </div>

      <div className="px-1 pb-2 pt-1">
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight">{greeting(now)}, Monsieur</h1>
        <ul className="mt-1 min-h-[4.5rem] space-y-0.5 text-[15px] leading-snug text-muted">
          {lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </div>

      {/* Rituels du moment (sommeil, bilans d'habitudes, briefing, repas) : 2 cartes au plus, choisies en code */}
      <RitualDeck
        accessCode={accessCode}
        onUnauthorized={onUnauthorized}
        slots={slots}
        forme={forme === null ? "loading" : forme.ready ? { sleeps: forme.sleeps, meals: forme.nutrition?.meals ?? [] } : "off"}
        onFormeChanged={reloadForme}
        day={day}
        onAsk={onAsk}
        onListen={onListen}
        speakRef={speakBriefing}
      />

      {/* Tâches (éléments sans heure) — RÉELLES. En retard, puis aujourd'hui, puis sans date ; 5 visibles, le reste se déplie. */}
      <Card>
        <Label>Pense-bêtes</Label>
        {api.error && <p className="mt-2 text-sm text-neg">{api.error}</p>}
        {!api.loaded && <SkeletonRows />}
        {api.loaded && list.length === 0 && !api.error && <p className="mt-1 text-[15px] text-muted">Rien à faire, Monsieur. Profitez-en.</p>}
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
          <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Nouveau pense-bête…" aria-label="Nouveau pense-bête" className="h-11 min-w-0 flex-1 rounded-full bg-raised px-4 text-[15px] outline-none placeholder:text-faint focus:ring-1 focus:ring-accent/50" />
        </form>
      </Card>
      {opened && <TaskSheet key={opened.id} t={opened} api={api} onClose={() => setOpenId(null)} />}

      {/* Google (lecture seule) : connecter, reconnecter (jeton expiré), ou résultat de la connexion */}
      {(google.state === "not-connected" || google.state === "reconnect" || googleNotice) && (
        <Card>
          <Label>Google</Label>
          <p className="mt-1 text-[14px] leading-snug text-muted">
            {googleNotice ?? (google.state === "reconnect" ? "Google n'est plus connecté (la connexion a expiré). Reconnectez-le pour retrouver votre agenda et vos mails." : "Connectez votre agenda et vos mails : Majordome les lit sans jamais rien écrire chez Google.")}
          </p>
          {(google.state === "not-connected" || google.state === "reconnect") && (
            <button onClick={() => void google.connect().catch(() => {})} className="mt-3 min-h-11 rounded-full bg-accent px-5 text-[14px] font-semibold text-ink active:scale-95">
              {google.state === "reconnect" ? "Reconnecter Google" : "Connecter Google"}
            </button>
          )}
        </Card>
      )}

      {/* Rendez-vous trouvés dans les mails : Ruben choisit, majordome n'écrit rien chez Google (le lien ouvre Google Agenda, qui écrit après son tap) */}
      {gOk &&
        google.suggestions.map((s) => (
          <Card key={s.id}>
            <Label>RDV trouvé dans un mail</Label>
            <p className="mt-1 text-[17px] font-semibold leading-snug tracking-tight">{s.title}</p>
            <p className="text-[13px] text-muted">
              {new Date(s.start).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", weekday: "long", day: "numeric", month: "long" })} · {new Date(s.start).toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" })}
              {s.place ? ` · ${s.place}` : ""}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => void google.answer(s.id, "task")} className="min-h-11 rounded-full bg-accent px-4 text-[13px] font-semibold text-ink active:scale-95">
                Ajouter à mon planning
              </button>
              <a href={s.calendarUrl} target="_blank" rel="noopener noreferrer" onClick={() => void google.answer(s.id, "added")} className="flex min-h-11 items-center rounded-full bg-raised px-4 text-[13px] font-medium text-fg ring-1 ring-line active:scale-95">
                Ajouter à Google Agenda
              </a>
              <button onClick={() => void google.answer(s.id, "dismissed")} className="min-h-11 rounded-full px-3 text-[13px] font-medium text-muted active:bg-raised">
                Ignorer
              </button>
            </div>
          </Card>
        ))}

      {/* Argent : RÉEL seulement. Rien d'inventé : sans relevé ni banque, une invitation. */}
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
      ) : fin?.ready ? (
        <Card onClick={() => go("finances")}>
          <Label>Argent</Label>
          <p className="mt-1 text-[17px] font-semibold tracking-tight">Votre solde apparaîtra ici</p>
          <p className="mt-0.5 text-[13px] leading-snug text-muted">Importez un relevé ou connectez votre banque dans Finances.</p>
        </Card>
      ) : null}

      {/* Ton objectif : le vrai (dégradé aux couleurs de l'app, sans photo), ou une invitation s'il n'y en a pas */}
      {noGoalYet ? (
        <Card onClick={() => go("finances")}>
          <Label>Votre objectif</Label>
          <p className="mt-1 text-[17px] font-semibold tracking-tight">Pas encore d&apos;objectif</p>
          <p className="mt-0.5 text-[13px] leading-snug text-muted">Dites à Majordome ce que vous souhaitez mettre de côté, ou créez-le dans Finances.</p>
        </Card>
      ) : realGoal ? (
        <button onClick={() => go("finances")} className={`relative block h-48 w-full overflow-hidden rounded-[22px] text-left transition-transform active:scale-[0.985] ${realGoal.image_url ? "bg-surface" : "goal-default"}`}>
          {realGoal.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={realGoal.image_url} alt="" className="absolute inset-0 size-full object-cover brightness-[0.75]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/55 to-transparent" />
          <div className="absolute inset-x-4 bottom-4">
            <p className="text-[13px] font-medium text-fg/80">Votre objectif</p>
            <p className="truncate text-[19px] font-semibold tracking-tight">{realGoal.label}</p>
            <p className="mt-0.5 text-[13px] tabular-nums text-fg/75">
              {euro(realGoal.saved, false)} / {euro(realGoal.target, false)} · {goalProgress(realGoal.saved, realGoal.target)} %
            </p>
            <div className="mt-2.5">
              <Bar value={realGoal.saved} max={realGoal.target} />
            </div>
          </div>
        </button>
      ) : null}

      {/* Ta forme : 3 chiffres RÉELS (rien tant qu'il n'y a pas de données) */}
      {realForme && (
        <Card onClick={() => go("forme")}>
          <Label>Votre forme</Label>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[
              ["Nuit", realForme.lastNight !== null ? hoursLabel(realForme.lastNight) : "—"],
              ["Séances", String(realForme.week.sessions)],
              realForme.kcal !== null ? ["Repas", `${realForme.kcal.toLocaleString("fr-FR")} kcal`] : ["Jours actifs", `${realForme.week.activeDays} / 7`], // les kcal du jour dès qu'un repas est noté
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-raised px-2 py-3">
                <p className="text-[12px] text-muted">{k}</p>
                <p className="mt-0.5 text-[18px] font-semibold tabular-nums tracking-tight">{v}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Ta semaine (miroir, phase 6) — APERÇU */}
      <Card onClick={onWeek} className="flex items-center justify-between gap-3">
        <span>
          <span className="block text-[15px] font-medium">Votre semaine</span>
          <span className="block text-[13px] text-muted">Vos chiffres et un mot de Majordome</span>
        </span>
        <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
          <path d="M9 6l6 6-6 6" />
        </svg>
      </Card>

    </div>
  );
}
