"use client";

import { useCallback, useEffect, useState } from "react";
import { GROUPS, groupOf } from "@/lib/task-groups";

type Task = { id: number; title: string; due_at: string | null; priority: number; notes: string | null; status: "todo" | "done" };

const fmtDue = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", { timeZone: "Europe/Paris", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function TasksView({ accessCode, hidden, onUnauthorized }: { accessCode: string; hidden: boolean; onUnauthorized: () => void }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<Set<number>>(new Set()); // cochées, en train de partir (animation)
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState(2);
  const [showOptions, setShowOptions] = useState(false);

  const api = useCallback(
    async (method: string, body?: unknown) => {
      const res = await fetch("/api/tasks", {
        method,
        headers: { "Content-Type": "application/json", "x-access-code": accessCode },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (res.status === 401) onUnauthorized();
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Erreur serveur (${res.status})`);
      return data;
    },
    [accessCode, onUnauthorized],
  );

  const load = useCallback(() => {
    api("GET")
      .then((d) => {
        setTasks(d.tasks);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, [api]);

  // Rechargé à chaque ouverture de l'onglet (l'IA a pu créer des tâches entre-temps).
  useEffect(() => {
    if (!hidden) load();
  }, [hidden, load]);

  // Mise à jour optimiste : l'écran change tout de suite, on annule si le serveur refuse.
  function toggle(t: Task) {
    const done = t.status === "todo";
    const apply = (status: Task["status"]) => setTasks((cur) => cur.map((x) => (x.id === t.id ? { ...x, status } : x)));
    if (done) {
      setLeaving((s) => new Set(s).add(t.id));
      setTimeout(() => {
        apply("done");
        setLeaving((s) => {
          const n = new Set(s);
          n.delete(t.id);
          return n;
        });
      }, 350);
    } else apply("todo");
    api("PATCH", { id: t.id, done }).catch((e) => {
      apply(t.status);
      setError(e.message);
    });
  }

  function add() {
    const clean = title.trim();
    if (!clean) return;
    const tempId = -Date.now(); // id provisoire, remplacé par celui du serveur
    const due_at = due ? new Date(due).toISOString() : null;
    setTasks((cur) => [...cur, { id: tempId, title: clean, due_at, priority, notes: null, status: "todo" }]);
    setTitle("");
    setDue("");
    setPriority(2);
    setShowOptions(false);
    setError(null);
    api("POST", { title: clean, due_at, priority })
      .then((d) => setTasks((cur) => cur.map((x) => (x.id === tempId ? d.task : x))))
      .catch((e) => {
        setTasks((cur) => cur.filter((x) => x.id !== tempId));
        setError(e.message);
      });
  }

  const now = new Date();
  const todo = tasks
    .filter((t) => t.status === "todo")
    .sort((a, b) => (a.due_at ?? "9").localeCompare(b.due_at ?? "9") || a.priority - b.priority);
  const done = tasks.filter((t) => t.status === "done");

  const row = (t: Task) => {
    const isDone = t.status === "done" || leaving.has(t.id);
    return (
      <li key={t.id} className="rise">
        <button
          onClick={() => toggle(t)}
          disabled={t.id < 0}
          className="flex min-h-12 w-full items-start gap-3 py-2.5 text-left"
          aria-pressed={isDone}
        >
          <span
            className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border transition-all duration-300 ${
              isDone ? "scale-110 border-brass bg-brass text-ink" : "border-faint"
            }`}
          >
            {isDone && (
              <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
                <path d="M5 12l5 5 9-10" />
              </svg>
            )}
          </span>
          <span className={`min-w-0 flex-1 transition-opacity duration-300 ${isDone ? "text-faint line-through opacity-60" : ""}`}>
            <span className="flex items-center gap-2 text-[15px] leading-snug">
              {t.priority === 1 && <span className="size-1.5 shrink-0 rounded-full bg-brass" title="Priorité haute" />}
              <span className={t.priority === 3 && !isDone ? "text-muted" : ""}>{t.title}</span>
            </span>
            {t.due_at && <span className="mt-0.5 block text-xs text-faint">{fmtDue(t.due_at)}</span>}
          </span>
        </button>
      </li>
    );
  };

  return (
    <section className={`${hidden ? "hidden" : "flex"} min-h-0 flex-1 flex-col`}>
      <header className="flex h-14 items-center px-5">
        <h1 className="font-serif text-2xl font-medium tracking-wide">Tâches</h1>
      </header>

      {/* Ajout rapide : sans IA, gratuit et instantané */}
      <div className="border-b border-line px-4 pb-3">
        <div className="flex gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Nouvelle tâche…"
            aria-label="Nouvelle tâche"
            className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-4 text-[15px] outline-none placeholder:text-faint focus:border-brass/60"
          />
          <button
            onClick={() => setShowOptions((v) => !v)}
            aria-label="Date et priorité"
            aria-expanded={showOptions}
            className={`flex size-11 shrink-0 items-center justify-center rounded-xl border ${showOptions || due ? "border-brass/60 text-brass" : "border-line text-faint"}`}
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
              <rect x="4" y="5" width="16" height="15" rx="2" />
              <path d="M4 10h16M9 3v4M15 3v4" />
            </svg>
          </button>
          <button
            onClick={add}
            disabled={!title.trim()}
            aria-label="Ajouter"
            className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brass text-ink disabled:opacity-30"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
        {showOptions && (
          <div className="rise mt-2 flex gap-2">
            <input
              type="datetime-local"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              aria-label="Échéance"
              className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-sm text-muted outline-none [color-scheme:dark] focus:border-brass/60"
            />
            <select
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
              aria-label="Priorité"
              className="h-11 rounded-xl border border-line bg-surface px-3 text-sm text-muted outline-none focus:border-brass/60"
            >
              <option value={1}>Haute</option>
              <option value={2}>Normale</option>
              <option value={3}>Basse</option>
            </select>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
        {error && <p className="pt-3 text-sm text-red-300">{error}</p>}
        {GROUPS.map((g) => {
          const items = todo.filter((t) => groupOf(t.due_at, now) === g);
          if (!items.length) return null;
          return (
            <div key={g} className="pt-5">
              <h2 className={`mb-1 text-[11px] uppercase tracking-[0.14em] ${g === "En retard" ? "text-brass" : "text-faint"}`}>{g}</h2>
              <ul className="divide-y divide-line/60">{items.map(row)}</ul>
            </div>
          );
        })}
        {todo.length === 0 && !error && <p className="pt-16 text-center font-serif text-xl text-muted">Rien à faire. Profitez-en.</p>}
        {done.length > 0 && (
          <div className="pt-8">
            <h2 className="mb-1 text-[11px] uppercase tracking-[0.14em] text-faint">Terminées récemment</h2>
            <ul className="divide-y divide-line/60">{done.map(row)}</ul>
          </div>
        )}
      </div>
    </section>
  );
}
