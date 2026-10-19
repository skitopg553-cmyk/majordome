import { NextResponse, after } from "next/server";
import { denied } from "@/lib/access";
import { runAgent } from "@/lib/ai";
import { sanitizeMessages } from "@/lib/chat-input";
import { INSTRUCTIONS } from "@/lib/instructions";
import { applyIntents, claimsActionWithoutTool, FALSE_CLAIM_WARNING } from "@/lib/intents";
import { supabaseAdmin } from "@/lib/supabase";
import { alarmWebText, timerWebText } from "@/lib/alarm-speech";
import { detectAlarmIntent } from "@/lib/alarm-intent";
import { CARDS_MARK, extractCard, type Card } from "@/lib/alarm";
import { moodPrefix, MoodStripper, stripMood } from "@/lib/mascot";
import { ACTIONS_MARK, extractSetting, extractUndo, SETTINGS_MARK, type DeviceSetting, type Undo } from "@/lib/undo";
import { recapText } from "@/lib/slots";
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
  const cards: Card[] = []; // réveils / minuteurs préparés : l'écran affiche un bouton qui ouvre l'app Horloge
  const recaps: string[] = []; // une ligne par élément créé (écrite par l'outil, donc par le code) : récapitulatif exact en fin de réponse
  const settings: DeviceSetting[] = []; // réglages de l'appareil demandés (lecture à voix haute) : appliqués par l'écran

  // Humeur de la mascotte : le modèle commence sa réponse par « @mood:happy » ; on retire la balise du flux (affichage, lecture vocale, historique)
  // et on envoie l'humeur en tête du flux (voir src/lib/mascot.ts). Une humeur trouvée après le début du texte est ignorée.
  const stripper = new MoodStripper();
  let moodSent = false;
  let bytesSent = false;
  const emit = (r: { text: string; moods: ReturnType<MoodStripper["feed"]>["moods"] }) => {
    if (r.moods.length && !moodSent && !bytesSent) {
      ctrl.enqueue(enc.encode(moodPrefix(r.moods[0])));
      bytesSent = moodSent = true;
    }
    if (r.text) {
      ctrl.enqueue(enc.encode(r.text));
      bytesSent = true;
    }
  };
  let toolCalls = 0; // outils appelés dans ce message (par le système ou par le modèle) : sert à repérer un faux « c'est noté »
  const last = messages[messages.length - 1];
  const executeAndCollect = async (name: string, args: Record<string, unknown>) => {
    toolCalls++;
    const { result, undo } = extractUndo(await executeTool(name, args));
    if (undo) actions.push(undo);
    const { setting } = extractSetting(result);
    if (setting) settings.push(setting);
    const { result: clean, card } = extractCard(result);
    if (card) cards.push(card);
    try {
      const recap = (JSON.parse(clean) as { recap?: unknown }).recap;
      if (typeof recap === "string") recaps.push(recap);
    } catch {
      /* résultat non JSON : pas de récapitulatif */
    }
    return clean;
  };

  const run = (async () => {
    // Réveil / minuteur dit clairement (« mets un réveil à 7 h demain ») : le CODE prépare la carte et écrit la phrase, sans appeler le modèle.
    // Avant, le modèle écrivait « Touche le bouton » sans toujours appeler l'outil (constat du 18/10) : la carte manquait une fois sur deux.
    const alarm = last?.role === "user" && typeof last.content === "string" ? detectAlarmIntent(last.content) : null;
    if (alarm) {
      const ok = (JSON.parse(await executeAndCollect(alarm.tool, alarm.args)) as { ok?: boolean }).ok === true;
      const p = cards[cards.length - 1]?.params;
      if (ok && p) {
        const text = p.kind === "alarm" ? alarmWebText(p.hour, p.minutes, p.when) : timerWebText(p.seconds);
        time("alarme_code", Date.now() - t0);
        sent = true;
        emit({ text, moods: ["happy"] });
        firstText();
        return text;
      }
      cards.length = 0; // l'outil a refusé : on laisse le modèle répondre, sans carte fantôme
    }
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
        emit(stripper.feed(d));
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
      emit(stripper.finish()); // texte éventuellement retenu à la fin du flux
      reply = stripMood(reply).text; // l'historique ne garde jamais la balise
      persisted = reply;
      const recap = recapText(recaps); // plusieurs éléments d'un coup : la liste exacte de ce qui a été créé
      if (recap) {
        ctrl.enqueue(enc.encode(`\n\n${recap}`));
        persisted = reply = `${reply}\n\n${recap}`;
      }
      // Jamais de promesse d'un bouton absent : la phrase parle d'un bouton mais aucune carte n'est envoyée.
      if (!cards.length && /\bbouton\b/i.test(reply)) {
        const warn = "\n\n⚠️ Je n'ai pas pu préparer ce réveil ou ce minuteur. Redis-le-moi avec l'heure, par exemple « réveil à 7 h ».";
        ctrl.enqueue(enc.encode(warn));
        reply += warn;
      }
      if (claimsActionWithoutTool(reply, toolCalls)) {
        console.warn("[faux-enregistrement] la réponse affirme avoir noté quelque chose sans appeler d'outil");
        ctrl.enqueue(enc.encode(FALSE_CLAIM_WARNING));
        persisted = reply + FALSE_CLAIM_WARNING;
      }
      if (actions.length) ctrl.enqueue(enc.encode(ACTIONS_MARK + JSON.stringify(actions)));
      if (settings.length) ctrl.enqueue(enc.encode(SETTINGS_MARK + JSON.stringify(settings)));
      if (cards.length) ctrl.enqueue(enc.encode(CARDS_MARK + JSON.stringify(cards)));
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
