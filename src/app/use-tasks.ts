"use client";

import { useCallback, useState } from "react";

export type Task = { id: number; title: string; due_at: string | null; priority: number; notes: string | null; status: "todo" | "done" };

/** Tâches réelles (table tasks), partagées par l'Accueil et le Planning. Mises à jour optimistes. */
export function useTasks(accessCode: string, onUnauthorized: () => void) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<Set<number>>(new Set()); // cochées, en train de partir (animation)

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
      .catch((e) => setError(e.message))
      .finally(() => setLoaded(true));
  }, [api]);

  // L'écran change tout de suite ; on annule si le serveur refuse.
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

  function add(title: string, due_at: string | null, priority: number) {
    const tempId = -Date.now(); // id provisoire, remplacé par celui du serveur
    setTasks((cur) => [...cur, { id: tempId, title, due_at, priority, notes: null, status: "todo" }]);
    setError(null);
    api("POST", { title, due_at, priority })
      .then((d) => setTasks((cur) => cur.map((x) => (x.id === tempId ? d.task : x))))
      .catch((e) => {
        setTasks((cur) => cur.filter((x) => x.id !== tempId));
        setError(e.message);
      });
  }

  return { tasks, loaded, error, leaving, load, toggle, add };
}

export type TasksApi = ReturnType<typeof useTasks>;
