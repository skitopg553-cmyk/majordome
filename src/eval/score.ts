// Évaluation de l'IA (npm run eval:ia) : l'état final du calendrier, comparé à ce qui était attendu. Pur et testé ; l'appel au vrai modèle est dans run.eval.ts.

export type Kind = "pensebete" | "creneau" | "creneau_recurrent" | "pensebete_recurrent" | "exception";
/** Un élément de l'état final (en mémoire), tel que le code l'a validé et enregistré. */
export type Item = { kind: Kind; title: string; date?: string | null; days?: string | null; start?: string | null; end?: string | null; habit?: boolean; action?: string };
/** Un élément attendu : seuls les champs donnés sont vérifiés. */
export type Expect = { kind: Kind; title: RegExp; date?: string; days?: string; start?: string; end?: string; habit?: boolean; action?: string };
/**
 * Un résultat acceptable : l'état final exact (n'importe quel ordre ; `extra: "allow"` tolère d'autres éléments), ou « une question, rien de nouveau ».
 * `say` : ce que le message final (réponse + texte écrit par le code) doit contenir.
 */
export type Outcome = { items: Expect[]; extra?: "allow"; say?: RegExp } | { question: true };
export type Case = { id: string; say: string | string[]; outcomes: Outcome[]; seed?: "week" | "week+reminders"; note?: string };

const matches = (it: Item, e: Expect) =>
  it.kind === e.kind && e.title.test(it.title) && (e.date === undefined || it.date === e.date) && (e.days === undefined || it.days === e.days) && (e.start === undefined || it.start === e.start) && (e.end === undefined || it.end === e.end) && (e.habit === undefined || !!it.habit === e.habit) && (e.action === undefined || it.action === e.action);

function matchAll(items: Item[], o: { items: Expect[]; extra?: "allow" }): string | null {
  const left = [...items];
  for (const e of o.items) {
    const i = left.findIndex((it) => matches(it, e));
    if (i < 0) return `manque : ${e.kind} « ${e.title.source} »${e.days ? ` jours ${e.days}` : ""}${e.start ? ` ${e.start}` : ""}${e.end ? `-${e.end}` : ""}${e.date ? ` le ${e.date}` : ""}`;
    left.splice(i, 1);
  }
  return left.length && o.extra !== "allow" ? `en trop : ${left.map((l) => `${l.kind} « ${l.title} »${l.days ? ` ${l.days}` : l.date ? ` ${l.date}` : ""} ${l.start ?? ""}${l.end ? `-${l.end}` : ""}`).join(", ")}` : null;
}

/**
 * Le cas réussit si UN des résultats acceptables est atteint. `before` = l'état de départ (une question ne doit rien avoir changé).
 * `text` = tout ce que Ruben lit : la réponse de l'IA et les phrases écrites par le code.
 */
export function scoreCase(c: Case, items: Item[], text: string, before: Item[] = []): { pass: boolean; why: string } {
  let first = "";
  for (const o of c.outcomes) {
    if ("question" in o) {
      const unchanged = items.length === before.length && JSON.stringify(items) === JSON.stringify(before);
      if (unchanged && /\?/.test(text)) return { pass: true, why: "" };
      first ||= !unchanged ? "devait poser une question sans rien changer, a modifié le calendrier" : "devait poser une question (pas de « ? » dans la réponse)";
      continue;
    }
    const why = matchAll(items, o) ?? (o.say && !o.say.test(text) ? `message attendu ${o.say} absent` : null);
    if (!why) return { pass: true, why: "" };
    first ||= why;
  }
  return { pass: false, why: first };
}

export const summarize = (results: { id: string; pass: boolean; why: string }[]) => ({
  passed: results.filter((r) => r.pass).length,
  total: results.length,
  failed: results.filter((r) => !r.pass),
});
