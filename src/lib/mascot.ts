// La mascotte « majordome. » : deux yeux blancs sur fond noir. Tout ce qui se calcule (émotions, interpolation, balise d'humeur) est ici, en code pur et testé.
// Le dessin (CSS) est dans src/app/majordome.tsx, l'animation continue dans src/app/mascot-engine.ts.

export type Mood = "neutral" | "blink" | "happy" | "angry" | "sad" | "surprised" | "sleepy" | "focus";
/** w, h, r : largeur / hauteur / arrondi de l'œil en fraction de S. ta : angle de la paupière haute (miroir sur l'œil droit). tc / bc : part couverte par la paupière haute / basse. */
export type EmoParams = { w: number; h: number; r: number; ta: number; tc: number; bc: number };

export const EMO: Record<Mood, EmoParams> = {
  neutral: { w: 0.5, h: 1, r: 0.25, ta: 0, tc: 0, bc: 0 },
  blink: { w: 0.54, h: 0.07, r: 0.035, ta: 0, tc: 0, bc: 0 },
  happy: { w: 0.52, h: 0.92, r: 0.26, ta: 0, tc: 0, bc: 0.56 },
  angry: { w: 0.52, h: 0.86, r: 0.22, ta: 24, tc: 0.4, bc: 0.06 },
  sad: { w: 0.5, h: 0.86, r: 0.24, ta: -20, tc: 0.32, bc: 0 },
  surprised: { w: 0.64, h: 1.12, r: 0.32, ta: 0, tc: 0, bc: 0 },
  sleepy: { w: 0.54, h: 0.8, r: 0.22, ta: 0, tc: 0.56, bc: 0.04 },
  focus: { w: 0.52, h: 0.88, r: 0.2, ta: 6, tc: 0.3, bc: 0.18 },
};

/** Écart entre les yeux (fraction de S) et amplitude du regard. */
export const EYE_GAP = 0.28;
export const GAZE_X = 0.3;
export const GAZE_Y = 0.2;

/** Humeurs que le modèle a le droit de demander (les autres sont réservées au code : clignement, sommeil). */
export const AI_MOODS = ["neutral", "happy", "sad", "angry", "surprised", "focus"] as const;
export type AiMood = (typeof AI_MOODS)[number];
export const parseMood = (s: unknown): AiMood => {
  const m = typeof s === "string" ? s.trim().toLowerCase() : "";
  return (AI_MOODS as readonly string[]).includes(m) ? (m as AiMood) : "neutral";
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Mélange de deux émotions : t = 0 → a, t = 1 → b. */
export const blend = (a: EmoParams, b: EmoParams, t: number): EmoParams => ({
  w: lerp(a.w, b.w, t), h: lerp(a.h, b.h, t), r: lerp(a.r, b.r, t), ta: lerp(a.ta, b.ta, t), tc: lerp(a.tc, b.tc, t), bc: lerp(a.bc, b.bc, t),
});

/** Un pas d'animation vers la cible : ease-out exponentiel indépendant du nombre d'images par seconde (~120 ms pour presque tout parcourir avec tau = 40 ms). */
export function stepParams(cur: EmoParams, target: EmoParams, dtMs: number, tauMs = 40): EmoParams {
  return blend(cur, target, 1 - Math.exp(-Math.max(0, dtMs) / tauMs));
}

/** Style d'un œil (i = 0 gauche, 1 droit) pour une taille de référence S en pixels. */
export function eyeStyle(p: EmoParams, S: number, i: 0 | 1) {
  return {
    width: p.w * S,
    height: p.h * S,
    borderRadius: p.r * S,
    topLidTop: (p.tc - 1) * 100, // en %
    topLidRotate: (i ? -1 : 1) * p.ta, // en degrés
    bottomLidTop: (1 - p.bc) * 100, // en %
  };
}

// ---------- Balise d'humeur « @mood:happy » en première ligne de la réponse ----------

const TAG = "@mood:";

/**
 * Retire les balises « @mood:xxx » (une par ligne) d'un texte reçu morceau par morceau. Une balise coupée entre deux morceaux est retenue
 * jusqu'à ce qu'on sache ce que c'est ; si ce n'est finalement pas une balise, le texte retenu est rendu tel quel.
 */
export class MoodStripper {
  private atLineStart = true;
  private pending = ""; // début de balise possible (« @mo »)
  private body: string | null = null; // contenu après « @mood: » quand la balise est reconnue
  private moods: AiMood[] = [];

  feed(chunk: string): { text: string; moods: AiMood[] } {
    let out = "";
    for (const c of chunk) {
      if (this.body !== null) {
        if (c === "\n") {
          this.moods.push(parseMood(this.body));
          this.body = null;
          this.atLineStart = true; // la fin de ligne de la balise est avalée avec elle
        } else this.body += c;
      } else if (this.pending || (this.atLineStart && c === "@")) {
        this.pending += c;
        if (this.pending === TAG) {
          this.pending = "";
          this.body = "";
        } else if (!TAG.startsWith(this.pending)) {
          out += this.pending; // ce n'était pas une balise
          this.atLineStart = this.pending.endsWith("\n");
          this.pending = "";
        }
      } else {
        out += c;
        this.atLineStart = c === "\n";
      }
    }
    const moods = this.moods;
    this.moods = [];
    return { text: out, moods };
  }

  /** Fin du flux : rend ce qui était retenu (sauf une balise sans fin de ligne, dont on garde l'humeur). */
  finish(): { text: string; moods: AiMood[] } {
    let text = "";
    if (this.body !== null) this.moods.push(parseMood(this.body));
    else text = this.pending;
    this.pending = "";
    this.body = null;
    const moods = this.moods;
    this.moods = [];
    return { text, moods };
  }
}

/** Version d'un seul coup (texte complet) : texte sans balises + première humeur trouvée. */
export function stripMood(full: string): { text: string; mood: AiMood | null } {
  const s = new MoodStripper();
  const a = s.feed(full);
  const b = s.finish();
  return { text: (a.text + b.text).replace(/^\s+/, ""), mood: [...a.moods, ...b.moods][0] ?? null };
}

/** L'humeur voyage en tête du flux, entre deux U+001F : « ␟happy␟Bonjour… ». */
export const MOOD_MARK = "\u001f";
export const moodPrefix = (m: AiMood) => `${MOOD_MARK}${m}${MOOD_MARK}`;
export function splitMood(raw: string): { mood: AiMood | null; rest: string } {
  if (!raw.startsWith(MOOD_MARK)) return { mood: null, rest: raw };
  const end = raw.indexOf(MOOD_MARK, 1);
  if (end === -1) return { mood: null, rest: "" }; // préfixe pas encore complet : rien à afficher
  return { mood: parseMood(raw.slice(1, end)), rest: raw.slice(end + 1) };
}
