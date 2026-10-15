import { NextResponse } from "next/server";
import { callAI } from "@/lib/ai";

const SYSTEM_PROMPT = `Tu es Majordome, l'assistant personnel de Ruben.
Tu es à la fois secrétaire, coach et conseiller. Tu réponds en français, de façon directe et concise.
Phase actuelle : prototype. Tu n'as encore ni mémoire, ni accès aux tâches, mails ou agenda.
Si on te demande quelque chose qui nécessite ces accès, dis-le simplement.`;

export async function POST(req: Request) {
  // Protection phase 0 : seul quelqu'un qui connaît le code d'accès peut utiliser l'API
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

  try {
    const reply = await callAI({
      tier: "sonnet",
      system: SYSTEM_PROMPT,
      messages: messages.slice(-20), // on limite l'historique envoyé pour maîtriser les coûts
      purpose: "chat",
    });
    return NextResponse.json({ reply });
  } catch (err) {
    console.error(err);
    // Le détail de l'erreur est renvoyé car l'app est protégée par le code d'accès (usage perso) :
    // ça permet de diagnostiquer sans ouvrir les logs. À retirer si l'app devient publique.
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Erreur IA : ${detail}`.slice(0, 400) }, { status: 500 });
  }
}
