"use client";

import { useCallback, useEffect, useState } from "react";
import { drainQueue, enqueue, friendlyError, isNetworkError } from "@/lib/offline";
import { postponeToTomorrow } from "@/lib/task-groups";
import { callApi } from "./api-client";
import { mascotApi } from "./mascot-engine";
import { confirmDelete, deleteEntry } from "./delete-entry";

/** `recurring` : pense-bête qui revient (calculé par le serveur, id « virtuel »). Coché = fait pour aujourd'hui ; il revient au prochain jour prévu. */
export type Task = { id: number; title: string; due_at: string | null; end_at?: string | null; priority: number; notes: string | null; status: "todo" | "done"; recurring?: { ruleId: number; label: string; progress: { done: number; of: number } | null } };

/** Tâches réelles (table tasks), partagées par l'Accueil et le Planning. Mises à jour optimistes. */
export function useTasks(accessCode: string, onUnauthorized: () => void) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<Set<number>>(new Set()); // cochées, en train de partir (animation)

  const api = useCallback(
    (method: string, body?: unknown) => callApi<any>(accessCode, "/api/tasks", { method, body, onUnauthorized }), // eslint-disable-line @typescript-eslint/no-explicit-any
    [accessCode, onUnauthorized],
  );

  const load = useCallback(() => {
    api("GET")
      .then((d) => {
        setTasks(d.tasks);
        setError(null);
      })
      .catch((e) => setError(friendlyError(e)))
      .finally(() => setLoaded(true));
  }, [api]);

  // L'écran change tout de suite ; on annule si le serveur refuse.
  function toggle(t: Task) {
    const done = t.status === "todo";
    if (done) mascotApi.react("happy", 2000); // la mascotte sourit quand on coche
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
    const send = t.recurring ? callApi(accessCode, "/api/reminders", { method: "POST", body: { rule_id: t.recurring.ruleId, done }, onUnauthorized }) : api("PATCH", { id: t.id, done });
    send.catch((e) => {
      clearTimeout(timer); // sinon le minuteur remettrait « faite » après l'annulation
      stopLeaving();
      apply(t.status);
      setError(friendlyError(e));
    });
  }

  // Suppression définitive (après confirmation) : la tâche disparaît tout de suite, et revient si le serveur refuse.
  function remove(t: Task) {
    if (!confirmDelete(`la tâche « ${t.title} »`)) return;
    setTasks((cur) => cur.filter((x) => x.id !== t.id));
    deleteEntry(accessCode, { table: "tasks", id: t.id }, onUnauthorized).catch((e) => {
      setTasks((cur) => (cur.some((x) => x.id === t.id) ? cur : [...cur, t]));
      setError(friendlyError(e));
    });
  }

  // Modification depuis la fiche (titre, échéance, priorité, notes) : l'écran change tout de suite, et revient en arrière si le serveur refuse.
  function update(t: Task, fields: Partial<Pick<Task, "title" | "due_at" | "priority" | "notes">>) {
    setTasks((cur) => cur.map((x) => (x.id === t.id ? { ...x, ...fields, notes: "notes" in fields ? fields.notes || null : x.notes } : x)));
    return api("PATCH", { id: t.id, ...fields }).catch((e) => {
      setTasks((cur) => cur.map((x) => (x.id === t.id ? t : x)));
      setError(friendlyError(e));
    });
  }

  // « Reporter à demain » en un geste : même heure demain, ou demain 9 h.
  function postpone(t: Task) {
    const due_at = postponeToTomorrow(t.due_at, new Date());
    setTasks((cur) => cur.map((x) => (x.id === t.id ? { ...x, due_at } : x)));
    api("PATCH", { id: t.id, due_at }).catch((e) => {
      setTasks((cur) => cur.map((x) => (x.id === t.id ? { ...x, due_at: t.due_at } : x)));
      setError(friendlyError(e));
    });
  }

  function add(title: string, due_at: string | null, priority: number) {
    const tempId = -Date.now(); // id provisoire, remplacé par celui du serveur
    setTasks((cur) => [...cur, { id: tempId, title, due_at, priority, notes: null, status: "todo" }]);
    setError(null);
    api("POST", { title, due_at, priority })
      .then((d) => setTasks((cur) => cur.map((x) => (x.id === tempId ? d.task : x))))
      .catch((e) => {
        if (isNetworkError(e)) {
          mascotApi.react("sad", 2000);
          // Hors ligne : la tâche reste affichée et part au retour du réseau (file en mémoire du téléphone).
          enqueue(localStorage, { title, due_at, priority });
          setError("Hors ligne : votre tâche sera ajoutée dès le retour du réseau.");
          return;
        }
        setTasks((cur) => cur.filter((x) => x.id !== tempId));
        setError(friendlyError(e));
      });
  }

  // Rejoue les ajouts faits hors ligne : au démarrage et à chaque retour du réseau.
  useEffect(() => {
    const replay = async () => {
      const sent = await drainQueue(localStorage, async (t) => {
        try {
          const res = await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json", "x-access-code": accessCode }, body: JSON.stringify(t) });
          if (res.ok) return "ok";
          return res.status === 401 || res.status >= 500 ? "retry" : "drop"; // 400 / 409 : refusée pour de bon
        } catch {
          return "retry";
        }
      });
      if (sent) {
        setError(null);
        load();
      }
    };
    void replay();
    window.addEventListener("online", replay);
    return () => window.removeEventListener("online", replay);
  }, [accessCode, load]);

  return { tasks, loaded, error, leaving, load, toggle, add, postpone, remove, update };
}

export type TasksApi = ReturnType<typeof useTasks>;
