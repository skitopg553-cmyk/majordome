// Nutrition : le modèle comprend la phrase (aliment + quantité + unité), le CODE calcule kcal et macros.
// Source des valeurs (pour 100 g) : table Ciqual 2020 de l'ANSES (licence ouverte). ~260 aliments courants dans foods.json ; ceux qui ont un code Ciqual (7e valeur)
// sont lus dans le fichier officiel (scripts/ciqual-build.mjs), les autres gardent des valeurs approximatives à vérifier.
import foods from "./foods.json";
import { fold } from "../text";
import { resolveDate } from "../life";

type Res<T> = { ok: true; value: T } | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

export type Macros = { kcal: number; protein: number; carbs: number; fat: number };
export type Food = { name: string; aliases: string[]; per100: Macros; pieceG: number; ciqual?: number }; // ciqual : code de la table officielle, si la valeur en vient

const STOP = new Set(["de", "du", "des", "d", "la", "le", "les", "l", "un", "une", "au", "aux", "a", "en", "et"]);
const tokens = (s: string) =>
  fold(s.replace(/œ/g, "oe").replace(/æ/g, "ae"))
    .split(/[^a-z0-9%]+/)
    .filter((w) => w && !STOP.has(w))
    .map((w) => (w.length > 3 && /[sx]$/.test(w) ? w.slice(0, -1) : w)); // pluriel simple : « pommes » = « pomme »

export const FOODS: Food[] = (foods as unknown as [string, number, number, number, number, number, number?][]).map(([names, kcal, protein, carbs, fat, pieceG, ciqual]) => {
  const all = names.split("|");
  return { name: all[0], aliases: all, per100: { kcal, protein, carbs, fat }, pieceG, ciqual };
});
const INDEX = FOODS.map((f) => ({ food: f, aliases: f.aliases.map(tokens) }));

// Mots qui précisent un aliment sans le changer : « riz cuit », « tomate bio ». Tout autre mot en plus = on ne devine pas (→ estimation).
const MODIFIERS = new Set(["cuit", "cru", "nature", "frais", "bio", "maison", "grille", "roti", "vapeur", "entier", "petit", "gros", "grand", "blanc", "chaud", "froid", "sec"]);

/** Retrouve un aliment de la table. Exact > aliment contenu dans la demande avec seulement des précisions > demande contenue dans un aliment. Sinon null. */
export function lookupFood(query: string): Food | null {
  const q = tokens(query);
  if (!q.length) return null;
  let best: { food: Food; score: number } | null = null;
  const consider = (food: Food, score: number) => {
    if (!best || score > best.score) best = { food, score };
  };
  for (const { food, aliases } of INDEX) {
    for (const a of aliases) {
      if (!a.length) continue;
      if (a.join(" ") === q.join(" ")) consider(food, 100);
      else if (a.every((w) => q.includes(w)) && q.filter((w) => !a.includes(w)).every((w) => MODIFIERS.has(w))) consider(food, 70 + a.length);
      else if (q.every((w) => a.includes(w)) && q.some((w) => w.length >= 3)) consider(food, 50 - (a.length - q.length));
    }
  }
  return (best as { food: Food; score: number } | null)?.food ?? null;
}

const SPOON: Record<string, number> = { cuillere_soupe: 15, cuillere_cafe: 5 };
const UNIT_ALIASES: Record<string, string> = {
  g: "g", gr: "g", gramme: "g", grammes: "g", kg: "kg", kilo: "kg", kilos: "kg", ml: "ml", cl: "cl", l: "l", litre: "l", litres: "l",
  piece: "piece", pieces: "piece", unite: "piece", unites: "piece", tranche: "piece", tranches: "piece", portion: "piece", canette: "piece", verre: "piece",
  cuillere_soupe: "cuillere_soupe", cuillere_cafe: "cuillere_cafe", "c.s.": "cuillere_soupe", cs: "cuillere_soupe", "c.c.": "cuillere_cafe", cc: "cuillere_cafe",
};

/** Quantité → grammes. 1 ml = 1 g (approximation pour les boissons ; l'écart est faible). « Pièce » demande que la table connaisse le poids d'une pièce. */
export function toGrams(quantity: number, unit: unknown, food: Food | null): Res<number> {
  if (!(typeof quantity === "number" && Number.isFinite(quantity) && quantity > 0)) return fail("quantity invalide : nombre supérieur à 0");
  const u = UNIT_ALIASES[fold(typeof unit === "string" && unit.trim() ? unit.trim() : "g")];
  if (!u) return fail("unit inconnue : utilise g, kg, ml, cl, l, piece, cuillere_soupe ou cuillere_cafe");
  let g: number;
  if (u === "g" || u === "ml") g = quantity;
  else if (u === "kg" || u === "l") g = quantity * 1000;
  else if (u === "cl") g = quantity * 10;
  else if (u in SPOON) g = quantity * SPOON[u];
  else {
    if (!food || !food.pieceG) return fail("poids d'une pièce inconnu pour cet aliment : demande la quantité en grammes");
    g = quantity * food.pieceG;
  }
  g = Math.round(g * 10) / 10;
  return g > 0 && g <= 5000 ? { ok: true, value: g } : fail("quantité hors limites (0 à 5000 g)");
}

const r1 = (n: number) => Math.round(n * 10) / 10;
export const computeMacros = (per100: Macros, grams: number): Macros => ({
  kcal: r1((per100.kcal * grams) / 100),
  protein: r1((per100.protein * grams) / 100),
  carbs: r1((per100.carbs * grams) / 100),
  fat: r1((per100.fat * grams) / 100),
});

/** Estimation du modèle pour 100 g : refusée si elle est absurde (kcal > 900, macros > 100 g, kcal très éloignées de 4·P + 4·G + 9·L). */
export function checkEstimate(e: unknown): Res<Macros> {
  if (!e || typeof e !== "object") return fail("estimation absente");
  const o = e as Record<string, unknown>;
  const n = (k: string) => (typeof o[k] === "number" && Number.isFinite(o[k]) ? (o[k] as number) : NaN);
  const m = { kcal: n("kcal"), protein: n("protein"), carbs: n("carbs"), fat: n("fat") };
  if (Object.values(m).some((v) => Number.isNaN(v) || v < 0)) return fail("estimation invalide : kcal, protein, carbs, fat (pour 100 g) requis, positifs");
  if (m.kcal > 900 || m.protein + m.carbs + m.fat > 105) return fail("estimation absurde pour 100 g (kcal > 900 ou macros > 100 g)");
  const calc = 4 * m.protein + 4 * m.carbs + 9 * m.fat;
  if (m.kcal > 30 && Math.abs(calc - m.kcal) > 0.4 * Math.max(calc, m.kcal)) return fail("estimation incohérente : les kcal ne correspondent pas aux macros (4·protéines + 4·glucides + 9·lipides)");
  return { ok: true, value: m };
}

export type FoodEntry = { date: string; label: string; grams: number; macros: Macros; estimated: 0 | 1 };

/** Un repas dit à la voix → une ligne prête à enregistrer. L'aliment connu l'emporte toujours sur l'estimation du modèle. */
export function parseFood(a: Record<string, unknown>, now: Date): Res<FoodEntry> {
  const name = typeof a.food === "string" ? a.food.trim().replace(/\s+/g, " ").slice(0, 80) : "";
  if (!name) return fail("food requis : le nom de l'aliment (ex. « riz »)");
  const date = resolveDate(a.date, now);
  if (!date.ok) return date;
  const known = lookupFood(name);
  const grams = toGrams(a.quantity as number, a.unit, known);
  if (!grams.ok) return grams;
  if (known) return { ok: true, value: { date: date.value, label: known.name, grams: grams.value, macros: computeMacros(known.per100, grams.value), estimated: 0 } };
  if (a.estimate_per_100g == null) return fail(`« ${name} » n'est pas dans la table : redonne l'appel avec estimate_per_100g {kcal, protein, carbs, fat} pour 100 g (ce sera marqué « estimé »)`);
  const est = checkEstimate(a.estimate_per_100g);
  if (!est.ok) return est;
  return { ok: true, value: { date: date.value, label: name, grams: grams.value, macros: computeMacros(est.value, grams.value), estimated: 1 } };
}

export type NutritionGoals = { kcal: number | null; protein: number | null; carbs: number | null; fat: number | null };
const LIMITS: Record<keyof NutritionGoals, [number, number]> = { kcal: [800, 6000], protein: [0, 500], carbs: [0, 1000], fat: [0, 500] };

/** Objectif du jour : seuls les champs donnés changent (null = pas touché). Au moins un champ. */
export function parseNutritionGoals(a: Record<string, unknown>): Res<Partial<Record<keyof NutritionGoals, number>>> {
  const out: Partial<Record<keyof NutritionGoals, number>> = {};
  for (const k of Object.keys(LIMITS) as (keyof NutritionGoals)[]) {
    if (a[k] === undefined || a[k] === null) continue;
    const v = typeof a[k] === "number" ? Math.round(a[k] as number) : NaN;
    if (!(v >= LIMITS[k][0] && v <= LIMITS[k][1])) return fail(`${k} invalide : entier entre ${LIMITS[k][0]} et ${LIMITS[k][1]}`);
    out[k] = v;
  }
  return Object.keys(out).length ? { ok: true, value: out } : fail("donne au moins un objectif : kcal, protein, carbs ou fat");
}

export type FoodRow = { kcal: number; protein: number; carbs: number; fat: number; estimated?: number };
export function dayTotals(rows: FoodRow[]) {
  const t = rows.reduce((s, r) => ({ kcal: s.kcal + r.kcal, protein: s.protein + r.protein, carbs: s.carbs + r.carbs, fat: s.fat + r.fat, estimated: s.estimated || !!r.estimated }), { kcal: 0, protein: 0, carbs: 0, fat: 0, estimated: false });
  return { kcal: Math.round(t.kcal), protein: Math.round(t.protein), carbs: Math.round(t.carbs), fat: Math.round(t.fat), estimated: t.estimated };
}

/** Remplissage d'une barre : 0–100 % (la barre ne dépasse jamais) ; null sans objectif. */
export const barPercent = (value: number, goal: number | null) => (goal && goal > 0 ? Math.max(0, Math.min(100, Math.round((value / goal) * 100))) : null);
