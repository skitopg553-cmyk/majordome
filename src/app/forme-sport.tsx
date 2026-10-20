"use client";

import { distribution, regularity, streak, type Planned, type WorkoutRow } from "@/lib/sports";
import { addDays } from "@/lib/task-groups";
import { Bar, Card, Label } from "./ui";

const DAYS = ["L", "M", "M", "J", "V", "S", "D"];
const dayName = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "UTC", weekday: "long" });

/** La semaine en cours : un rond plein par jour avec séance faite, un anneau pour une séance prévue encore à faire, le jour actuel cerclé. */
export function WeekStrip({ days, today, planned, workouts }: { days: string[]; today: string; planned: Planned[]; workouts: WorkoutRow[] }) {
  return (
    <div className="mt-3 flex justify-between">
      {days.map((d, i) => {
        const done = workouts.some((w) => w.date === d);
        const todo = planned.some((p) => p.day === d && p.status !== "done" && p.status !== "missed");
        return (
          <div key={d} className="flex flex-col items-center gap-1.5">
            <span
              aria-label={`${dayName(d)} : ${done ? "séance faite" : todo ? "séance prévue" : "rien"}`}
              className={`size-8 rounded-full transition-colors duration-200 ${done ? "glow bg-accent" : todo ? "ring-2 ring-accent/70" : d === today ? "ring-1 ring-muted" : "bg-raised"}`}
            />
            <span className={`text-[11px] ${d === today ? "text-fg" : "text-faint"}`}>{DAYS[i]}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Séances prévues encore à venir cette semaine (3 au plus) : « Boxe anglaise · mardi 18 h 30 ». */
export function Upcoming({ planned, week }: { planned: Planned[]; week: string[] }) {
  const next = planned.filter((p) => p.status === "upcoming" && p.day >= week[0] && p.day <= week[6]).slice(0, 3);
  if (!next.length) return null;
  const hm = (iso: string) => new Date(iso).toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" }).replace(":", " h ").replace(/ h 00$/, " h");
  return (
    <p className="mt-1 text-[13px] text-faint">
      À venir : {next.map((p) => `${p.sport} ${dayName(p.day)} ${hm(p.start)}`).join(" · ")}
    </p>
  );
}

/** Régularité par sport, série positive et répartition. Rien d'inventé : sans séance ni créneau, une invitation honnête. */
export function SportStats({ planned, workouts, since }: { planned: Planned[]; workouts: WorkoutRow[]; since: string }) {
  const reg = regularity(planned);
  const dist = distribution(workouts, since);
  const run = streak(planned);
  if (!reg.length && !dist.length) {
    return (
      <Card>
        <Label>Régularité</Label>
        <p className="mt-1 text-[15px] text-muted">Dites à Majordome quand vous vous entraînez, par exemple « boxe le mardi de 18 h 30 à 20 h » : votre régularité apparaîtra ici.</p>
      </Card>
    );
  }
  return (
    <>
      {reg.length > 0 && (
        <Card>
          <Label>Régularité · 4 dernières semaines</Label>
          <ul className="mt-2 space-y-3">
            {reg.map((r) => (
              <li key={r.sport}>
                <div className="flex items-baseline justify-between text-[14px]">
                  <span>{r.sport}</span>
                  <span className="tabular-nums text-muted">
                    {r.done} / {r.planned} · {r.pct} %
                  </span>
                </div>
                <div className="mt-1.5">
                  <Bar value={r.done} max={r.planned} />
                </div>
              </li>
            ))}
          </ul>
          {run >= 2 && <p className="mt-3 text-[13px] text-accent">{run} séances prévues tenues d&apos;affilée, Monsieur.</p>}
        </Card>
      )}
      {dist.length > 0 && (
        <Card>
          <Label>Répartition par sport</Label>
          <div className="mt-3 flex h-2.5 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={dist.map((d) => `${d.sport} ${d.pct} %`).join(", ")}>
            {dist.map((d, i) => (
              <div key={d.sport} className="h-full" style={{ width: `${d.pct}%`, background: "#6CF2FF", opacity: Math.max(0.25, 1 - i * 0.22) }} />
            ))}
          </div>
          <ul className="mt-3 space-y-1">
            {dist.map((d) => (
              <li key={d.sport} className="flex justify-between text-[14px]">
                <span>{d.sport}</span>
                <span className="tabular-nums text-muted">
                  {d.n} séance{d.n > 1 ? "s" : ""} · {d.pct} %
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

export const weekDays = (monday: string) => Array.from({ length: 7 }, (_, i) => addDays(monday, i));
