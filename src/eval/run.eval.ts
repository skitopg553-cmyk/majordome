// npm run eval:ia : fait passer les phrases de src/eval/cases.ts par le VRAI modèle (coûte quelques centimes, jamais lancé par `npm test`).
// Aucune écriture en base pour les tâches : tout se passe en mémoire. Seul l'usage de l'IA est journalisé dans ai_calls (purpose « eval:ia »).
import { describe, it } from "vitest";
import { CASES } from "./cases";
import { runCase } from "./run-case";
import { summarize } from "./score";

const hasKey = (process.env.AI_PROVIDER ?? "anthropic").toLowerCase() === "openai" ? !!process.env.OPENAI_API_KEY : !!process.env.ANTHROPIC_API_KEY;

describe.skipIf(!hasKey)("évaluation de l'IA (vrai modèle)", () => {
  it("score sur les phrases d'évaluation", { timeout: 900_000 }, async () => {
    const results: Awaited<ReturnType<typeof runCase>>[] = [];
    for (let i = 0; i < CASES.length; i += 4) results.push(...(await Promise.all(CASES.slice(i, i + 4).map((c) => runCase(c).catch((e) => ({ id: c.id, say: c.say, pass: false, why: `erreur : ${e instanceof Error ? e.message : e}`, items: [], reply: "", recap: "" }))))));
    const s = summarize(results);
    console.log(`\n=== SCORE : ${s.passed} / ${s.total} (${Math.round((100 * s.passed) / s.total)} %) ===`);
    for (const f of s.failed) {
      const r = results.find((x) => x.id === f.id)!;
      console.log(`\n✗ ${r.id} : « ${r.say} »\n   ${r.why}\n   créé : ${r.items.map((i) => `${i.kind} ${i.title} ${i.days ?? i.date ?? ""} ${i.start ?? ""}${i.end ? "-" + i.end : ""}`).join(" | ") || "rien"}\n   réponse : ${r.reply.replace(/\s+/g, " ").slice(0, 160)}`);
    }
  });
});
if (!hasKey) console.log("Évaluation ignorée : ajoute OPENAI_API_KEY (ou ANTHROPIC_API_KEY) dans .env.local, puis relance npm run eval:ia.");
