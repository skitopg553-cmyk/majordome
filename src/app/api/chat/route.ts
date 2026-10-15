import { NextResponse } from "next/server";
import { runAgent } from "@/lib/ai";
import { TOOLS, executeTool, buildContext } from "@/lib/tools";

const INSTRUCTIONS = `Tu es Majordome, l'assistant personnel de Ruben : secrétaire, coach et conseiller.
Tu réponds en français, de façon directe et concise.

Tu gères ses tâches et sa mémoire avec tes outils :
- Dès que Ruben mentionne quelque chose à faire, crée une tâche (add_task). Convertis les dates relatives ("demain 10h", "vendredi") en ISO 8601 avec le fuseau indiqué ci-dessous. Sans heure précise, mets 09:00.
- S'il dit qu'une chose est faite, utilise complete_task. S'il la décale ou la modifie, update_task.
- S'il t'apprend un fait durable sur lui (objectif, préférence, habitude, contrainte), utilise remember. Ne mémorise ni les tâches, ni les détails passagers.
- Après une action, confirme-la en une phrase.
- Pour "qu'est-ce que j'ai à faire ?", appuie-toi sur la liste des tâches ci-dessous, triée par urgence.
Tu n'as pas encore accès à ses mails, son agenda ni ses finances : dis-le simplement si on te le demande.`;

export async function POST(req: Request) {
  // Protection : seul quelqu'un qui connaît le code d'accès peut utiliser l'API
  // (sinon n'importe qui ayant l'URL pourrait dépenser tes crédits).
  const accessCode = process.env.MAJORDOME_ACCESS_CODE;
  if (!accessCode || req.headers.get("x-access-code") !== accessCode) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const messages = body?.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "Aucun message" }, { status: 400 });
  }

  // Chronométrage : visible dans les logs Vercel ("[timing]") et dans l'en-tête Server-Timing.
  const t0 = Date.now();
  const timings: [string, number][] = [];
  const time = (label: string, ms: number) => timings.push([label, ms]);

  try {
    const context = await buildContext();
    time("contexte", Date.now() - t0);
    const reply = await runAgent({
      tier: "sonnet",
      system: `${INSTRUCTIONS}\n\n${context}`,
      messages: messages.slice(-20), // on limite l'historique envoyé pour maîtriser les coûts
      purpose: "chat",
      tools: TOOLS,
      executeTool,
      onTiming: time,
    });
    time("total", Date.now() - t0);
    console.log("[timing]", timings.map(([l, ms]) => `${l}=${ms}ms`).join(" "));
    return NextResponse.json(
      { reply },
      { headers: { "Server-Timing": timings.map(([l, ms], i) => `${l.replace(/\W/g, "_")}_${i};dur=${ms}`).join(", ") } },
    );
  } catch (err) {
    console.error(err);
    // Le détail de l'erreur est renvoyé car l'app est protégée par le code d'accès (usage perso) :
    // ça permet de diagnostiquer sans ouvrir les logs. À retirer si l'app devient publique.
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Erreur IA : ${detail}`.slice(0, 400) }, { status: 500 });
  }
}
