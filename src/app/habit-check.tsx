"use client";

import { useMemo, useState } from "react";
import { doneThisWeek, habitQuestions, type Question } from "@/lib/habits";
import { addDays, parisDay } from "@/lib/task-groups";
import Celebration from "./celebration";
import { mascotApi } from "./mascot-engine";
import { Card, hhmm, Label } from "./ui";
import type { SlotsApi } from "./use-slots";

const when = (day: string, today: string) => (day === today ? "aujourd'hui" : day === addDays(today, -1) ? "hier" : new Date(`${day}T12:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "UTC", weekday: "long" }));

const pill = "min-h-11 rounded-full px-4 text-[14px] font-semibold active:scale-95 disabled:opacity-50";

/**
 * Bilan des habitudes, à l'ouverture de l'Accueil : « Tu y es allé ? » pour les créneaux d'habitude terminés.
 * Au plus 2 questions, jamais une occurrence redemandée une fois répondue (voir src/lib/habits.ts). « Plus tard » : revient à la prochaine ouverture de l'appli.
 * Ton : sans jugement. Aucun compteur d'échecs ; seul un « Xe fois cette semaine » discret apparaît après un oui.
 */
export default function HabitCheck({ slots }: { slots: SlotsApi }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set()); // repoussées (« plus tard ») ou déjà répondues pendant cette ouverture
  const [missed, setMissed] = useState<Question | null>(null); // « Non » : on propose de reprogrammer
  const [celebrate, setCelebrate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const today = parisDay(new Date());

  const questions = useMemo(
    () => habitQuestions({ rules: slots.rules, exceptions: slots.exceptions, logs: slots.logs, now: new Date(), snoozed: hidden }),
    [slots.rules, slots.exceptions, slots.logs, hidden],
  );
  const hide = (key: string) => setHidden((h) => new Set(h).add(key));

  async function answer(q: Question, status: "done" | "missed", then?: "tomorrow" | "week") {
    setError(null);
    try {
      await slots.act({ action: "habit", rule_id: q.ruleId, day: q.day, status, then });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible d'enregistrer pour le moment");
    }
  }

  function yes(q: Question) {
    hide(q.key);
    const n = doneThisWeek(slots.logs, q.ruleId, today) + 1;
    setCelebrate(n > 1 ? `${n}ᵉ fois cette semaine` : "");
    void answer(q, "done");
  }
  function no(q: Question) {
    hide(q.key);
    mascotApi.react("sad", 3000);
    setMissed(q);
    void answer(q, "missed");
  }
  function reprogram(q: Question, then: "tomorrow" | "week") {
    setMissed(null);
    void answer(q, "missed", then);
  }

  return (
    <>
      {celebrate !== null && <Celebration note={celebrate || undefined} onDone={() => setCelebrate(null)} />}
      {missed && (
        <Card>
          <Label>{missed.title}</Label>
          <p className="mt-1 text-[16px] font-semibold leading-snug tracking-tight">Pas grave. On le reprogramme ?</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => reprogram(missed, "tomorrow")} className={`${pill} bg-accent text-ink`}>
              Demain
            </button>
            <button onClick={() => reprogram(missed, "week")} className={`${pill} bg-raised text-fg ring-1 ring-line`}>
              Cette semaine
            </button>
            <button onClick={() => setMissed(null)} className={`${pill} text-muted active:bg-raised`}>
              Laisser tomber
            </button>
          </div>
        </Card>
      )}
      {questions.map((q) => (
        <Card key={q.key}>
          <Label>Habitude</Label>
          <p className="mt-1 break-words text-[17px] font-semibold leading-snug tracking-tight">Tu y es allé ? {q.title}</p>
          <p className="text-[13px] text-muted">
            {when(q.day, today)} · {hhmm(q.start)}–{hhmm(q.end)}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => yes(q)} className={`${pill} bg-accent text-ink`}>
              Oui
            </button>
            <button onClick={() => no(q)} className={`${pill} bg-raised text-fg ring-1 ring-line`}>
              Non
            </button>
            <button onClick={() => hide(q.key)} className={`${pill} text-muted active:bg-raised`}>
              Plus tard
            </button>
          </div>
        </Card>
      ))}
      {error && <p className="px-1 text-[13px] text-neg">{error}</p>}
    </>
  );
}
