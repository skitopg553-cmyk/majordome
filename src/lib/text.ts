/** Minuscules sans accents : « Médecin » → « medecin ». Base commune de toutes les comparaisons de texte (tâches, CSV, mails, sport). */
export const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Caractères de Windows-1252 qui ne sont pas dans Latin-1 (0x80–0x9F) : quand un texte UTF-8 est lu à tort en Windows-1252, « É » (C3 89) devient « Ã‰ ».
const CP1252: Record<string, number> = {
  "€": 0x80, "‚": 0x82, "ƒ": 0x83, "„": 0x84, "…": 0x85, "†": 0x86, "‡": 0x87, "ˆ": 0x88, "‰": 0x89, "Š": 0x8a, "‹": 0x8b, "Œ": 0x8c, "Ž": 0x8e,
  "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97, "˜": 0x98, "™": 0x99, "š": 0x9a, "›": 0x9b, "œ": 0x9c, "ž": 0x9e, "Ÿ": 0x9f,
};

/**
 * Répare un texte UTF-8 lu à tort comme Windows-1252 ou Latin-1 (« TerminÃ© » → « Terminé », « Ã‰tat » → « État »).
 * Prudent : sans « Ã » ou « Â », ou si la réparation n'est pas de l'UTF-8 valide, le texte est rendu tel quel.
 */
export function fixMojibake(s: string): string {
  if (!/[ÃÂ]/.test(s)) return s;
  const bytes: number[] = [];
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (c <= 0xff) bytes.push(c);
    else if (CP1252[ch] !== undefined) bytes.push(CP1252[ch]);
    else return s; // un vrai caractère hors Latin-1 : ce n'est pas du texte mal décodé
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bytes));
  } catch {
    return s;
  }
}
