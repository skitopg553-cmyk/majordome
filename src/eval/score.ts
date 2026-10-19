// Évaluation de l'IA (npm run eval:ia) : ce que l'IA a créé, comparé à ce qui était attendu. Pur et testé ; l'appel au vrai modèle est dans run.eval.ts.

export type Kind = "pensebete" | "creneau" | "creneau_recurrent" | "pensebete_recurrent";
/** Un élément créé par l'IA, tel que le code l'a validé et enregistré (en mémoire pour l'évaluation). */
export type Item = { kind: Kind; title: string; date?: string | null; days?: string | null; start?: string | null; end?: string | null; habit?: boolean };
/** Un élément attendu : seuls les champs donnés sont vérifiés. */
export type Expect = { kind: Kind; title: RegExp; date?: string; days?: string; start?: string; end?: string; habit?: boolean };
/** Un résultat acceptable : une liste d'éléments (dans n'importe quel ordre) ou « une question, rien créé ». */
export type Outcome = { items: Expect[]; extra?: "allow" } | { question: true };
export type Case = { id: string; say: string; outcomes: Outcome[]; note?: string };

const matches = (it: Item, e: Expect) =>
  it.kind === e.kind && e.title.test(it.title) && (e.date === undefined || it.date === e.date) && (e.days === undefined || it.days === e.days) && (e.start === undefined || it.start === e.start) && (e.end === undefined || it.end === e.end) && (e.habit === undefined || !!it.habit === e.habit);

/** Chaque attendu est trouvé (un élément ne sert qu'une fois) ; sans `extra: "allow"`, rien d'autre ne doit avoir été créé. */
function matchAll(items: Item[], o: { items: Expect[]; extra?: "allow" }): string | null {
  const left = [...items];
  for (const e of o.items) {
    const i = left.findIndex((it) => matches(it, e));
    if (i < 0) return `manque : ${e.kind} « ${e.title.source} »${e.days ? ` jours ${e.days}` : ""}${e.start ? ` ${e.start}` : ""}${e.end ? `-${e.end}` : ""}${e.date ? ` le ${e.date}` : ""}`;
    left.splice(i, 1);
  }
  return left.length && o.extra !== "allow" ? `en trop : ${left.map((l) => `${l.kind} « ${l.title} »`).join(", ")}` : null;
}

/** Le cas réussit si UN des résultats acceptables est atteint. Sinon, la raison du plus proche (le premier). */
export function scoreCase(c: Case, items: Item[], reply: string): { pass: boolean; why: string } {
  let first = "";
  for (const o of c.outcomes) {
    if ("question" in o) {
      if (!items.length && /\?/.test(reply)) return { pass: true, why: "" };
      first ||= items.length ? `devait poser une question, a créé ${items.length} élément(s)` : "devait poser une question (pas de « ? » dans la réponse)";
      continue;
    }
    const why = matchAll(items, o);
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
