// Sport inconnu du dictionnaire (sports.ts) : une seule petite question au petit modèle. Jamais appelée pour un sport connu ; toute erreur = « pas du sport ».
import { runAgent } from "./ai";

const asked = new Map<string, string | null>(); // mémoire de l'instance : un titre n'est demandé qu'une fois

/** « Kung-fu » → « Kung-fu » ; « Jardiner » → null. */
export async function askSportAI(title: string): Promise<string | null> {
  const key = title.trim().toLowerCase();
  if (asked.has(key)) return asked.get(key) ?? null;
  let sport: string | null = null;
  try {
    const raw = await runAgent({
      tier: "haiku",
      purpose: "sport-inconnu",
      system: 'Tu classes le titre d\'une habitude. Réponds UNIQUEMENT par un objet JSON : {"sport":"Nom du sport en français (1 à 3 mots, majuscule initiale)"} si c\'est une activité sportive ou physique, sinon {"sport":null}. Méditation, lecture, ménage, courses : null.',
      messages: [{ role: "user", content: title.slice(0, 80) }],
      maxTokens: 40,
    });
    const v = (JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? "{}") as { sport?: unknown }).sport;
    sport = typeof v === "string" && v.trim() && v.length <= 40 ? v.trim() : null;
  } catch {
    sport = null;
  }
  asked.set(key, sport);
  return sport;
}
