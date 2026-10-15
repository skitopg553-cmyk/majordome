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

  // La réponse est streamée : le texte part vers le navigateur dès que l'IA l'écrit.
  const enc = new TextEncoder();
  let ctrl!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({ start: (c) => void (ctrl = c) });
  let sent = false;
  let firstText!: () => void;
  const first = new Promise<void>((r) => (firstText = r));
  const report = () => console.log("[timing]", timings.map(([l, ms]) => `${l}=${ms}ms`).join(" "));

  const run = (async () => {
    const context = await buildContext();
    time("contexte", Date.now() - t0);
    await runAgent({
      tier: "sonnet",
      system: `${INSTRUCTIONS}\n\n${context}`,
      messages: messages.slice(-20), // on limite l'historique envoyé pour maîtriser les coûts
      purpose: "chat",
      tools: TOOLS,
      executeTool,
      onTiming: time,
      onText: (d) => {
        if (!sent) time("premier_mot", Date.now() - t0);
        sent = true;
        ctrl.enqueue(enc.encode(d));
        firstText();
      },
    });
  })();
  run.then(
    () => {
      time("total", Date.now() - t0);
      report();
      ctrl.close();
    },
    (err) => {
      // Erreur après le début du texte : on la signale à la fin de la bulle.
      if (!sent) return;
      console.error(err);
      ctrl.enqueue(enc.encode(`\n\n⚠️ Erreur IA : ${err instanceof Error ? err.message : String(err)}`.slice(0, 400)));
      ctrl.close();
    },
  );

  try {
    await Promise.race([first, run]); // attend le premier mot (ou la fin, ou une erreur)
    return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  } catch (err) {
    console.error(err);
    // Le détail de l'erreur est renvoyé car l'app est protégée par le code d'accès (usage perso) :
    // ça permet de diagnostiquer sans ouvrir les logs. À retirer si l'app devient publique.
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Erreur IA : ${detail}`.slice(0, 400) }, { status: 500 });
  }
}
