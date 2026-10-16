import { NextResponse, after } from "next/server";
import { denied } from "@/lib/access";
import { runAgent } from "@/lib/ai";
import { sanitizeMessages } from "@/lib/chat-input";
import { INSTRUCTIONS } from "@/lib/instructions";
import { applyIntents, claimsActionWithoutTool, FALSE_CLAIM_WARNING } from "@/lib/intents";
import { supabaseAdmin } from "@/lib/supabase";
import { ACTIONS_MARK, extractSetting, extractUndo, SETTINGS_MARK, type DeviceSetting, type Undo } from "@/lib/undo";
import { TOOLS, executeTool, buildContext } from "@/lib/tools";

export async function POST(req: Request) {
  if (denied(req)) return NextResponse.json({ error: "Accès refusé" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const messages = sanitizeMessages(body?.messages); // rôles et tailles contrôlés (voir src/lib/chat-input.ts)
  if (!messages) return NextResponse.json({ error: "Message invalide" }, { status: 400 });

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

  // Actions annulables : chaque outil qui écrit renvoie « undo » ; on le retire avant de répondre au modèle (inutile pour lui)
  // et on l'envoie à l'écran après le texte, qui affiche un bouton « Annuler » quelques secondes.
  const actions: Undo[] = [];
  const settings: DeviceSetting[] = []; // réglages de l'appareil demandés (lecture à voix haute) : appliqués par l'écran

  let toolCalls = 0; // outils appelés dans ce message (par le système ou par le modèle) : sert à repérer un faux « c'est noté »
  const last = messages[messages.length - 1];
  const executeAndCollect = async (name: string, args: Record<string, unknown>) => {
    toolCalls++;
    const { result, undo } = extractUndo(await executeTool(name, args));
    if (undo) actions.push(undo);
    const { setting } = extractSetting(result);
    if (setting) settings.push(setting);
    return result;
  };

  const run = (async () => {
    const context = await buildContext();
    time("contexte", Date.now() - t0);
    // Ordres explicites (« retiens que… », « objectif 3000 € pour… ») : exécutés par le code, avant le modèle (voir src/lib/intents.ts).
    const done = last?.role === "user" && typeof last.content === "string" ? await applyIntents(last.content, executeAndCollect) : [];
    const doneNote = done.length ? `\n\n## Déjà fait pour Ruben dans ce message (par le système)\n${done.map((n) => `- ${n}`).join("\n")}` : "";
    return runAgent({
      tier: "sonnet",
      system: `${INSTRUCTIONS}\n\n${context}${doneNote}`,
      messages, // déjà limité aux 20 derniers messages (maîtrise des coûts)
      purpose: "chat",
      tools: TOOLS,
      executeTool: executeAndCollect,
      onTiming: time,
      onText: (d) => {
        if (!sent) time("premier_mot", Date.now() - t0);
        sent = true;
        ctrl.enqueue(enc.encode(d));
        firstText();
      },
    });
  })();
  let persisted: string | null = null; // ce qui sera gardé dans l'historique (la réponse, avec l'alerte éventuelle)
  run.then(
    (reply) => {
      time("total", Date.now() - t0);
      report();
      // Faux « c'est noté » : on le dit tout de suite, et on le garde dans l'historique pour que le modèle ne le croie pas la fois suivante.
      persisted = reply;
      if (claimsActionWithoutTool(reply, toolCalls)) {
        console.warn("[faux-enregistrement] la réponse affirme avoir noté quelque chose sans appeler d'outil");
        ctrl.enqueue(enc.encode(FALSE_CLAIM_WARNING));
        persisted = reply + FALSE_CLAIM_WARNING;
      }
      if (actions.length) ctrl.enqueue(enc.encode(ACTIONS_MARK + JSON.stringify(actions)));
      if (settings.length) ctrl.enqueue(enc.encode(SETTINGS_MARK + JSON.stringify(settings)));
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

  // Historique : le message de Ruben puis la réponse sont enregistrés après l'envoi (dans l'ordre).
  after(async () => {
    const ran = await run.catch(() => "");
    const reply = ran && (persisted ?? ran);
    const rows = [
      ...(last?.role === "user" && typeof last.content === "string" ? [{ role: "user", content: last.content }] : []),
      ...(reply ? [{ role: "assistant", content: reply }] : []),
    ];
    for (const row of rows) {
      const { error } = await supabaseAdmin().from("messages").insert(row);
      if (error) console.error("Enregistrement du message échoué :", error.message);
    }
  });

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
