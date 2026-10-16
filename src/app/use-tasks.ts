"use client";

import { useCallback, useState } from "react";
import { postponeToTomorrow } from "@/lib/task-groups";
import { confirmDelete, deleteEntry } from "./delete-entry";

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
      }, 450);
    } else apply("todo");
    api("PATCH", { id: t.id, done }).catch((e) => {
      clearTimeout(timer); // sinon le minuteur remettrait « faite » après l'annulation
      stopLeaving();
      apply(t.status);
      setError(e.message);
    });
  }

  // Suppression définitive (après confirmation) : la tâche disparaît tout de suite, et revient si le serveur refuse.
  function remove(t: Task) {
    if (!confirmDelete(`la tâche « ${t.title} »`)) return;
    setTasks((cur) => cur.filter((x) => x.id !== t.id));
    deleteEntry(accessCode, { table: "tasks", id: t.id }, onUnauthorized).catch((e) => {
      setTasks((cur) => (cur.some((x) => x.id === t.id) ? cur : [...cur, t]));
      setError(e.message);
    });
  }

  // Modification depuis la fiche (titre, échéance, priorité, notes) : l'écran change tout de suite, et revient en arrière si le serveur refuse.
  function update(t: Task, fields: Partial<Pick<Task, "title" | "due_at" | "priority" | "notes">>) {
    setTasks((cur) => cur.map((x) => (x.id === t.id ? { ...x, ...fields, notes: "notes" in fields ? fields.notes || null : x.notes } : x)));
    return api("PATCH", { id: t.id, ...fields }).catch((e) => {
      setTasks((cur) => cur.map((x) => (x.id === t.id ? t : x)));
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

  return { tasks, loaded, error, leaving, load, toggle, add, postpone, remove, update };
}

export type TasksApi = ReturnType<typeof useTasks>;
