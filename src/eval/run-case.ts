import { runAgent } from "../lib/ai";
import { INSTRUCTIONS } from "../lib/instructions";
import { recapText } from "../lib/slots";
import { TOOLS } from "../lib/tools";
import { NOW_TEXT } from "./cases";
import { memoryTools } from "./memory-tools";
import { scoreCase, type Case } from "./score";

const CONTEXT = `Maintenant : ${NOW_TEXT}.\n\n## Ce que tu sais de Ruben\n(rien pour l'instant)\n\n## Tâches en cours\n(aucune)\n\n## Vie de Ruben (déjà noté dans l'app)\n(rien)`;

/** Fait passer UNE phrase par le vrai modèle, avec les vraies consignes et les vrais outils, sur une base en mémoire. */
export async function runCase(c: Case) {
  const mem = memoryTools();
  const reply = await runAgent({ tier: "sonnet", system: `${INSTRUCTIONS}\n\n${CONTEXT}`, messages: [{ role: "user", content: c.say }], purpose: "eval:ia", tools: TOOLS, executeTool: mem.exec });
  const r = scoreCase(c, mem.items, reply);
  return { id: c.id, say: c.say, ...r, items: mem.items, reply, recap: recapText(mem.recaps) };
}
