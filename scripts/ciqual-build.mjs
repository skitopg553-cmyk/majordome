// Remplace les valeurs de src/lib/nutrition/foods.json par celles de la table officielle Ciqual 2020 (ANSES, licence ouverte Etalab 2.0).
// Usage : télécharger https://ciqual.anses.fr/cms/sites/default/files/inline-files/XML_2020_07_07.zip, le dézipper dans .ciq/ (ignoré par git),
// puis `node scripts/ciqual-build.mjs`. Les aliments gardent leurs noms et alias ; kcal / protéines / glucides / lipides (pour 100 g) sont lus
// dans Ciqual, et le code Ciqual est ajouté en 7e valeur de la ligne.
// Appariement PAR CODE : scripts/ciqual-codes.txt (« nom de l'aliment=code Ciqual »), vérifié à la main un par un. Un appariement automatique
// par le nom donnait trop d'erreurs (« Frites » → langoustine frite, « Pomme » → jus de pomme…). Les aliments sans code gardent leurs anciennes valeurs.
import { readFileSync, writeFileSync } from "node:fs";

const DIR = ".ciq";
const dec = (f) => new TextDecoder("windows-1252").decode(readFileSync(`${DIR}/${f}`));

// Compositions : 328 = énergie (kcal, règlement UE 1169/2011), 25000 (ou 25003) = protéines, 31000 = glucides, 40000 = lipides.
const WANT = { 328: "kcal", 333: "kcal333", 25000: "protein", 25003: "protein625", 31000: "carbs", 40000: "fat" }; // protéines : facteur de Jones (25000), à défaut N × 6,25 (25003)
const num = (s) => {
  const t = s.trim().replace(",", ".");
  if (/^traces?$/i.test(t)) return 0;
  const v = Number(t.replace(/^[<>]\s*/, "")); // « < 0,5 » : on prend 0,5 (majorant, écart négligeable)
  return t && Number.isFinite(v) ? v : NaN;
};
const compo = new Map();
const re = /<alim_code>\s*(\d+)\s*<\/alim_code>\s*<const_code>\s*(\d+)\s*<\/const_code>\s*<teneur>\s*([^<]*?)\s*<\/teneur>/g;
for (const m of dec("compo_2020_07_07.xml").matchAll(re)) {
  const key = WANT[m[2]];
  if (!key) continue;
  const o = compo.get(m[1]) ?? {};
  o[key] = num(m[3]);
  compo.set(m[1], o);
}
for (const c of compo.values()) if (!Number.isFinite(c.kcal) && Number.isFinite(c.kcal333)) c.kcal = c.kcal333; // énergie : règlement UE (328), à défaut Jones avec fibres (333)
for (const c of compo.values()) if (!Number.isFinite(c.protein) && Number.isFinite(c.protein625)) c.protein = c.protein625;
// Ciqual ne renseigne pas toujours un macro quasi nul (ex. lipides de la banane) : un seul macro absent est mis à 0 si l'énergie colle (±20 %) sans lui.
for (const c of compo.values()) {
  const missing = ["protein", "carbs", "fat"].filter((k) => !Number.isFinite(c[k]));
  if (missing.length === 1 && Number.isFinite(c.kcal)) {
    const calc = 4 * (c.protein || 0) + 4 * (c.carbs || 0) + 9 * (c.fat || 0);
    if (Math.abs(calc - c.kcal) <= 0.2 * Math.max(c.kcal, 20)) c[missing[0]] = 0;
  }
}
// Énergie absente de Ciqual (fruits…) mais macros connus : calculée avec les facteurs d'Atwater (4 kcal/g protéines et glucides, 9 kcal/g lipides).
for (const c of compo.values()) if (!Number.isFinite(c.kcal) && [c.protein, c.carbs, c.fat].every(Number.isFinite)) c.kcal = Math.round((4 * c.protein + 4 * c.carbs + 9 * c.fat) * 10) / 10;
const complete = (c) => c && ["kcal", "protein", "carbs", "fat"].every((k) => Number.isFinite(c[k]));

const codes = new Map(
  readFileSync("scripts/ciqual-codes.txt", "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => l.split("=")),
);
const foods = JSON.parse(readFileSync("src/lib/nutrition/foods.json", "utf8"));
const kept = [];
const out = foods.map(([namesStr, kcal0, p0, g0, l0, piece]) => {
  const name = namesStr.split("|")[0];
  const code = codes.get(name);
  const c = code && compo.get(code);
  if (!complete(c)) {
    kept.push(name);
    return [namesStr, kcal0, p0, g0, l0, piece];
  }
  return [namesStr, Math.round(c.kcal * 10) / 10, c.protein, c.carbs, c.fat, piece, Number(code)];
});
writeFileSync("src/lib/nutrition/foods.json", "[\n" + out.map((r) => JSON.stringify(r)).join(",\n") + "\n]\n");
console.log(`Ciqual : ${foods.length - kept.length} aliments sur ${foods.length} remplacés par la valeur officielle.`);
console.log("Valeurs gardées (anciennes, à vérifier) :\n- " + kept.join("\n- "));
