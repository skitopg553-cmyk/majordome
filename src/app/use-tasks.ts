"use client";

import { useCallback, useState } from "react";
import { postponeToTomorrow } from "@/lib/task-groups";

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
    const stopLeaving = () =>
      setLeaving((s) => {
        const n = new Set(s);
        n.delete(t.id);
        return n;
      });
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (done) {
      setLeaving((s) => new Set(s).add(t.id));
      timer = setTimeout(() => {
        apply("done");
        stopLeaving();
      }, 350);
    } else apply("todo");
    api("PATCH", { id: t.id, done }).catch((e) => {
      clearTimeout(timer); // sinon le minuteur remettrait « faite » après l'annulation
      stopLeaving();
      apply(t.status);
      setError(e.message);
    });
  }

  // « Reporter à demain » en un geste : même heure demain, ou demain 9 h.
  function postpone(t: Task) {
    const due_at = postponeToTomorrow(t.due_at, new Date());
    setTasks((cur) => cur.map((x) => (x.id === t.id ? { ...x, due_at } : x)));
    api("PATCH", { id: t.id, due_at }).catch((e) => {
      setTasks((cur) => cur.map((x) => (x.id === t.id ? { ...x, due_at: t.due_at } : x)));
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

  return { tasks, loaded, error, leaving, load, toggle, add, postpone };
}

export type TasksApi = ReturnType<typeof useTasks>;
