import { runAgent } from "../lib/ai";
import { agendaText } from "../lib/calendar-tools";
import { INSTRUCTIONS } from "../lib/instructions";
import { recapText } from "../lib/slots";
import { addDays } from "../lib/task-groups";
import { TOOLS } from "../lib/tools";
import { NOW, NOW_TEXT } from "./cases";
import { itemsOf, memoryTools, seedState } from "./memory-tools";
import { scoreCase, type Case } from "./score";

/**
 * Fait passer UN cas par le vrai modèle, avec les vraies consignes et les vrais outils, sur une base en mémoire.
 * Plusieurs messages (`say` en liste) = une conversation. Le contexte montre le calendrier comme en production.
 */
export async function runCase(c: Case) {
  const initial = seedState(c.seed, NOW);
  const before = itemsOf(initial);
  const mem = memoryTools(NOW, initial);
  const turns = Array.isArray(c.say) ? c.say : [c.say];
  const messages: { role: "user" | "assistant"; content: string }[] = [];
  const texts: string[] = [];
  for (const say of turns) {
    messages.push({ role: "user", content: say });
    const from = mem.recaps.length;
    const context = `Maintenant : ${NOW_TEXT}.\n\n## Ce que tu sais de Ruben\n(rien pour l'instant)\n\n## Pense-bêtes à faire (sans heure)\n(voir le calendrier)\n\n## Calendrier des 7 prochains jours (déjà enregistré : ne le recrée pas)\n${agendaText(mem.state(), "2026-10-19", addDays("2026-10-19", 6), "2026-10-19")}`;
    const reply = await runAgent({ tier: "sonnet", system: `${INSTRUCTIONS}\n\n${context}`, messages: [...messages], purpose: "eval:ia", tools: TOOLS, executeTool: mem.exec });
    const text = [reply, recapText(mem.recaps.slice(from)), mem.bulkDone()].filter(Boolean).join("\n\n");
    messages.push({ role: "assistant", content: text });
    texts.push(text);
  }
  const items = mem.items();
  const r = scoreCase(c, items, texts.join("\n\n"), before);
  return { id: c.id, say: turns.join(" ⏎ "), ...r, items, reply: texts.join(" ⏎ ") };
}
