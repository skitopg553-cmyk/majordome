import { NextResponse } from "next/server";
import { denied } from "@/lib/access";
import { runAgent } from "@/lib/ai";
import { parseScreenTime, validImage } from "@/lib/screen-time";
import { addDays, parisDay } from "@/lib/task-groups";
import type { ToolDef } from "@/lib/tools";

export const maxDuration = 30;

const TOOL: ToolDef = {
  name: "report_screen_time",
  description: "Rapporter le temps d'écran TOTAL lu sur la capture. Si le total n'est pas lisible, ne l'appelle pas.",
  parameters: {
    type: "object",
    properties: {
      hours: { type: "number", description: "Heures du total (ex. 4 pour « 4 h 12 min »)" },
      minutes: { type: "number", description: "Minutes restantes du total (ex. 12)" },
      day: { type: "string", enum: ["today", "yesterday"], description: "Jour affiché sur la capture (« aujourd'hui » par défaut)" },
    },
    required: ["hours", "minutes"],
  },
};

// Lit une capture d'écran « Bien-être numérique » par vision. NE SAUVEGARDE RIEN : renvoie une proposition,
// l'écran demande confirmation puis appelle POST /api/screen-time. Chaque appel IA est journalisé (runAgent → ai_calls).
export async function POST(req: Request) {
  if (denied(req)) return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  const image = validImage(((await req.json().catch(() => ({}))) as { image?: unknown }).image);
  if (!image) return NextResponse.json({ error: "Image invalide : png, jpeg ou webp, 3 Mo maximum." }, { status: 400 });

  const got: { args?: Record<string, unknown> } = {}; // rempli par l'outil (une variable simple serait réduite à null par TypeScript)
  try {
    await runAgent({
      tier: "haiku",
      purpose: "temps-ecran-vision",
      system: "Tu lis une capture d'écran de « Bien-être numérique » (Android) ou « Temps d'écran » (iPhone). Trouve le temps d'écran TOTAL du jour affiché et appelle report_screen_time. N'invente rien : si tu ne vois pas de total clair, réponds seulement « illisible ».",
      messages: [{ role: "user", content: "Quel est le temps d'écran total sur cette capture ?", images: [image] }],
      tools: [TOOL],
      maxTokens: 300,
      executeTool: async (_name, args) => {
        got.args = args;
        return JSON.stringify({ ok: true });
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Lecture impossible" }, { status: 502 });
  }
  if (!got.args) return NextResponse.json({ error: "Je n'arrive pas à lire le temps total sur cette capture." }, { status: 422 });

  const args = got.args;
  const today = parisDay(new Date());
  const p = parseScreenTime({ hours: args.hours, minutes: args.minutes, date: args.day === "yesterday" ? addDays(today, -1) : today }, new Date());
  if (!p.ok) return NextResponse.json({ error: `Valeur lue incohérente (${p.error}). Saisis-la à la main.` }, { status: 422 });
  return NextResponse.json({ ok: true, ...p.value });
}
