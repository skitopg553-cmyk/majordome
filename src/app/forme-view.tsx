import { DEMO_FORME as S, DEMO_PHASE } from "@/lib/demo-data";
import { Bar, Card, DemoBanner, Header } from "./ui";

const hm = (h: number) => `${Math.floor(h)} h ${String(Math.round((h % 1) * 60)).padStart(2, "0")}`;
const DAYS = ["L", "M", "M", "J", "V", "S", "D"];

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

// Coquille FICTIVE (phase 5) : santé + sport + productivité, données de src/lib/demo-data.ts.
export default function FormeView({ onAvatar }: { onAvatar: () => void }) {
  const maxSleep = Math.max(...S.sleep.week, 9);
  return (
    <div className="space-y-3 px-4 pb-6">
      <Header title="Forme" subtitle="Santé, sport et productivité" onAvatar={onAvatar} />
      <div className="px-1">
        <DemoBanner phase={DEMO_PHASE.forme} />
      </div>

      <Card>
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium text-muted">Sommeil</h2>
          <p className="text-xs text-faint">Coucher {S.sleep.bedtime}</p>
        </div>
        <p className="mt-1 text-3xl font-semibold tabular-nums">{hm(S.sleep.hours)}</p>
        <p className="text-xs text-faint">Score {S.sleep.score}/100</p>
        <div className="mt-4 flex h-24 gap-2" aria-label="Sommeil des 7 derniers jours">
          {S.sleep.week.map((h, i) => (
            <div key={i} className="flex h-full flex-1 flex-col items-center gap-1.5">
              <div className="flex w-full flex-1 items-end">
                <div className={`w-full rounded-md ${i === S.sleep.week.length - 1 ? "bg-accent" : "bg-raised"}`} style={{ height: `${(h / maxSleep) * 100}%` }} title={hm(h)} />
              </div>
              <span className="text-[10px] text-faint">{DAYS[i]}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card className="flex flex-col items-center p-4 text-center">
          <h2 className="mb-3 self-start text-sm font-medium text-muted">Pas</h2>
          <Ring value={S.steps.count} max={S.steps.goal}>
            <span className="text-lg font-semibold tabular-nums">{(S.steps.count / 1000).toFixed(1).replace(".", ",")}k</span>
            <span className="text-[10px] text-faint">/ {S.steps.goal / 1000}k</span>
          </Ring>
        </Card>
        <Card className="flex flex-col p-4">
          <h2 className="text-sm font-medium text-muted">Séances</h2>
          <p className="mt-3 text-3xl font-semibold tabular-nums">
            {S.workouts.done}
            <span className="text-base text-faint"> / {S.workouts.goal}</span>
          </p>
          <p className="mb-3 text-xs text-faint">cette semaine</p>
          <Bar value={S.workouts.done} max={S.workouts.goal} />
          <p className="mt-auto pt-3 text-xs text-muted">{S.workouts.last}</p>
        </Card>
      </div>

      <Card>
        <h2 className="mb-3 text-sm font-medium text-muted">Productivité</h2>
        <div className="flex items-center gap-5">
          <Ring value={S.discipline.score} max={100}>
            <span className="text-xl font-semibold tabular-nums">{S.discipline.score}</span>
            <span className="text-[10px] text-faint">discipline</span>
          </Ring>
          <dl className="min-w-0 flex-1 space-y-3 text-[15px]">
            <div>
              <dt className="text-xs text-faint">Série en cours</dt>
              <dd>{S.discipline.streak} jours</dd>
            </div>
            <div>
              <dt className="text-xs text-faint">Temps d&apos;écran aujourd&apos;hui</dt>
              <dd>
                {S.screenTime.today} <span className="text-xs text-accent">{S.screenTime.trend}</span>
              </dd>
            </div>
          </dl>
        </div>
      </Card>
    </div>
  );
}
