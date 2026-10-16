/** Minuscules sans accents : « Médecin » → « medecin ». Base commune de toutes les comparaisons de texte (tâches, CSV, mails, sport). */
export const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
