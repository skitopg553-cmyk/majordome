"use client";

import { useCallback, useEffect, useState } from "react";

type Task = { id: number; title: string; due_at: string | null; priority: number; notes: string | null; status: "todo" | "done" };

const PRIO = ["", "haute", "normale", "basse"];

export default function TasksView({ accessCode }: { accessCode: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState<string | null>(null);
  const headers = { "Content-Type": "application/json", "x-access-code": accessCode };

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks", { headers: { "x-access-code": accessCode } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur inconnue");
      setTasks(data.tasks);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    }
  }, [accessCode]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(t: Task) {
    const res = await fetch("/api/tasks", {
      method: "PATCH",
      headers,
      body: JSON.stringify({ id: t.id, done: t.status === "todo" }),
    });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "Erreur inconnue");
    load();
  }

  const todo = tasks.filter((t) => t.status === "todo");
  const done = tasks.filter((t) => t.status === "done");

  const row = (t: Task) => (
    <li key={t.id}>
      <label className="flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-neutral-900">
        <input type="checkbox" checked={t.status === "done"} onChange={() => toggle(t)} className="mt-1.5 size-4" />
        <span className={t.status === "done" ? "text-neutral-500 line-through" : ""}>
          {t.title}
          <span className="block text-xs text-neutral-500">
            {t.due_at && new Date(t.due_at).toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "medium", timeStyle: "short" })}
            {t.due_at && " · "}priorité {PRIO[t.priority]}
          </span>
        </span>
      </label>
    </li>
  );

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
      <ul>{todo.map(row)}</ul>
      {todo.length === 0 && !error && <p className="pt-10 text-center text-neutral-500">Aucune tâche en cours.</p>}
      {done.length > 0 && (
        <>
          <h2 className="mb-1 mt-6 text-xs uppercase text-neutral-500">Terminées récemment</h2>
          <ul>{done.map(row)}</ul>
        </>
      )}
    </div>
  );
}
