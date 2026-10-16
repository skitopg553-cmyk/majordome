import { describe, expect, it } from "vitest";
import { drainQueue, enqueue, friendlyError, isNetworkError, QUEUE_KEY, readQueue } from "./offline";

const fakeStore = (initial?: string) => {
  const m = new Map<string, string>(initial ? [[QUEUE_KEY, initial]] : []);
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};
const t = (title: string) => ({ title, due_at: null, priority: 2 });

describe("messages d'erreur lisibles", () => {
  it("panne de réseau : un message qui rassure, jamais « Failed to fetch »", () => {
    expect(isNetworkError(new TypeError("Failed to fetch"))).toBe(true);
    expect(friendlyError(new TypeError("Failed to fetch"))).toContain("Pas de réseau");
    expect(friendlyError(new TypeError("Failed to fetch"))).not.toMatch(/fetch/i);
  });
  it("IA surchargée, serveur en panne, message du serveur conservé, repli", () => {
    expect(friendlyError(new Error("Anthropic 529 overloaded"))).toContain("très sollicitée");
    expect(friendlyError(new Error("Erreur serveur (502)"))).toContain("serveur");
    expect(friendlyError(new Error("Déjà dans la liste : « Pain »"))).toBe("Déjà dans la liste : « Pain »");
    expect(friendlyError(new Error("Failed to fetch"))).toMatch(/Réessaie/);
    expect(friendlyError("bizarre")).toMatch(/Réessaie/);
  });
});

describe("file d'attente de tâches", () => {
  it("garde dans l'ordre, borne à 50, ignore un contenu abîmé", () => {
    const s = fakeStore();
    enqueue(s, t("a"));
    enqueue(s, t("b"));
    expect(readQueue(s).map((x) => x.title)).toEqual(["a", "b"]);
    for (let i = 0; i < 60; i++) enqueue(s, t("x" + i));
    expect(readQueue(s)).toHaveLength(50);
    expect(readQueue(fakeStore("pas du json"))).toEqual([]);
    expect(readQueue(fakeStore('[{"title":""},{"nope":1},{"title":"ok"}]')).map((x) => x.title)).toEqual(["ok"]);
  });
  it("rejoue dans l'ordre ; réseau coupé → on s'arrête et on garde le reste", async () => {
    const s = fakeStore();
    ["a", "b", "c"].forEach((x) => enqueue(s, t(x)));
    const seen: string[] = [];
    const sent = await drainQueue(s, async (task) => (seen.push(task.title), task.title === "b" ? "retry" : "ok"));
    expect(sent).toBe(1);
    expect(seen).toEqual(["a", "b"]);
    expect(readQueue(s).map((x) => x.title)).toEqual(["b", "c"]);
  });
  it("une tâche refusée par le serveur est jetée (elle ne bloque pas les suivantes)", async () => {
    const s = fakeStore();
    ["mauvaise", "bonne"].forEach((x) => enqueue(s, t(x)));
    const sent = await drainQueue(s, async (task) => (task.title === "mauvaise" ? "drop" : "ok"));
    expect(sent).toBe(1);
    expect(readQueue(s)).toEqual([]);
  });
});
