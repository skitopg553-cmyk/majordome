// Créneaux : validation des jours et des heures décrits par l'IA, occurrences calculées à l'AFFICHAGE (jamais créées jour par jour),
// exceptions (supprimer / déplacer une seule fois) et récapitulatif écrit par le code. L'IA ne calcule jamais une date.
import { occursOn, type StoredRule } from "./recurrence";
import { addDays, parisDay, parisIso } from "./task-groups";
import { fold } from "./text";

type Res<T> = { ok: true; value: T } | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

export const DAY_NAMES = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
const ALL_DAYS = "1,2,3,4,5,6,7";
const dayIndex = (w: string) => DAY_NAMES.findIndex((d) => w === d || w === `${d}s`) + 1; // 1 = lundi … 7 = dimanche, 0 = inconnu

/**
 * Jours décrits en français → « 1,3,5 » (triés, sans doublon). Accepte une liste (["lundi", "mercredi"]), « lundi-vendredi », « du lundi au vendredi »,
 * « tous les jours ». Tout le reste est refusé avec un message que l'IA peut utiliser pour poser UNE question.
 */
export function parseDays(v: unknown): Res<string> {
  const parts = (Array.isArray(v) ? v : [v]).filter((x): x is string => typeof x === "string").map((x) => fold(x).replace(/[’']/g, " ").trim());
  if (!parts.length || parts.some((p) => !p)) return fail("days requis : liste de jours en français (ex. [\"lundi\", \"mercredi\"])");
  const set = new Set<number>();
  for (const p of parts) {
    if (/^(tous les jours|chaque jour|quotidien|7 ?j ?\/ ?7)$/.test(p)) {
      ALL_DAYS.split(",").forEach((d) => set.add(Number(d)));
      continue;
    }
    const range = p.match(/^(?:du )?([a-z]+)\s*(?:-|au|a|jusqu a)\s*([a-z]+)$/);
    if (range && dayIndex(range[1]) && dayIndex(range[2])) {
      const a = dayIndex(range[1]);
      const b = dayIndex(range[2]);
      if (a > b) return fail(`plage de jours « ${p} » à l'envers : donne les jours un par un`);
      for (let d = a; d <= b; d++) set.add(d);
      continue;
    }
    const d = dayIndex(p);
    if (!d) return fail(`jour non compris : « ${p} ». Jours possibles : ${DAY_NAMES.join(", ")}. Si Ruben n'a pas précisé les jours, pose UNE question courte.`);
    set.add(d);
  }
  return { ok: true, value: [...set].sort((a, b) => a - b).join(",") };
}

/** « 9h », « 9:30 », « 18h30 », « 09:00 » → « HH:MM ». */
export function parseHour(v: unknown): Res<string> {
  const m = typeof v === "string" ? v.trim().toLowerCase().match(/^([01]?\d|2[0-3])\s*(?:h|:)\s*([0-5]\d)?$/) : null;
  return m ? { ok: true, value: `${m[1].padStart(2, "0")}:${m[2] ?? "00"}` } : fail("heure invalide : format HH:MM (ex. 09:00, 18:30)");
}

export type SlotInput = { title: string; days: string; start: string; end: string | null; habit: boolean };

/** Arguments de l'outil « créneau récurrent » : titre, jours, début, fin facultative, habitude. */
export function parseSlot(a: Record<string, unknown>): Res<SlotInput> {
  const title = typeof a.title === "string" ? a.title.trim().slice(0, 200) : "";
  if (!title) return fail("title requis (texte non vide)");
  const days = parseDays(a.days);
  if (!days.ok) return days;
  const start = parseHour(a.start);
  if (!start.ok) return fail(`start : ${start.error}`);
  let end: string | null = null;
  if (a.end !== undefined && a.end !== null && a.end !== "") {
    const e = parseHour(a.end);
    if (!e.ok) return fail(`end : ${e.error}`);
    if (e.value <= start.value) return fail("la fin doit être après le début, le même jour (ex. 09:00 → 17:00)");
    end = e.value;
  }
  return { ok: true, value: { title, days: days.value, start: start.value, end, habit: a.habit === true } };
}

// ---------- Occurrences (calculées pour un jour donné) ----------

export type SlotException = { rule_id: number; day: string; action: "skip" | "move"; new_day: string | null; new_start: string | null; new_end: string | null };
export type Occurrence = { key: string; ruleId: number; originDay: string; title: string; start: string; end: string | null; habit: boolean; moved: boolean };

const at = (day: string, hhmm: string) => parisIso(day, Number(hhmm.slice(0, 2)), Number(hhmm.slice(3, 5)));
/** Une règle ne produit rien AVANT le jour où elle a été créée (sinon les semaines passées se rempliraient d'un coup). */
const startsOn = (r: StoredRule) => (r.created_at ? parisDay(new Date(r.created_at)) : "0000-00-00");

/** Les occurrences d'un jour : règles AVEC heure qui tombent ce jour-là, sans les occurrences supprimées ou déplacées, plus celles déplacées VERS ce jour. */
export function occurrencesOn(rules: StoredRule[], exceptions: SlotException[], day: string): Occurrence[] {
  const exc = (id: number, d: string) => exceptions.find((e) => e.rule_id === id && e.day === d);
  const out: Occurrence[] = [];
  for (const r of rules) {
    if (!r.at_time) continue; // sans heure : c'est un pense-bête récurrent (copié dans les tâches), pas un créneau
    if (day >= startsOn(r) && occursOn(r, day) && !exc(r.id, day)) {
      out.push({ key: `${r.id}:${day}`, ruleId: r.id, originDay: day, title: r.title, start: at(day, r.at_time), end: r.end_time ? at(day, r.end_time) : null, habit: !!r.habit, moved: false });
    }
    for (const e of exceptions) {
      if (e.rule_id !== r.id || e.action !== "move" || e.new_day !== day) continue;
      const s = e.new_start ?? r.at_time;
      const en = e.new_end ?? (r.end_time && !e.new_start ? r.end_time : null);
      out.push({ key: `${r.id}:${e.day}`, ruleId: r.id, originDay: e.day, title: r.title, start: at(day, s), end: en ? at(day, en) : null, habit: !!r.habit, moved: true });
    }
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}

// ---------- Récapitulatif (écrit par le code) ----------

const hourWords = (hhmm: string) => (hhmm.slice(3) === "00" ? `${Number(hhmm.slice(0, 2))} h` : `${Number(hhmm.slice(0, 2))} h ${hhmm.slice(3)}`);
const hoursText = (start: string, end: string | null) => (end ? `${hourWords(start)}-${hourWords(end)}` : hourWords(start));

/** « lundi-vendredi », « tous les jours », « lundi, mercredi, vendredi », « mardi ». */
export function daysLabel(days: string): string {
  const n = days.split(",").map(Number);
  if (n.length === 7) return "tous les jours";
  const run = n.length >= 3 && n.every((d, i) => i === 0 || d === n[i - 1] + 1);
  return run ? `${DAY_NAMES[n[0] - 1]}-${DAY_NAMES[n[n.length - 1] - 1]}` : n.map((d) => DAY_NAMES[d - 1]).join(", ");
}

export const slotRecap = (s: SlotInput) => `${s.title} ${daysLabel(s.days)} ${hoursText(s.start, s.end)}${s.habit ? " (habitude à confirmer)" : ""}`;

/** Créneau ponctuel : « Dîner avec Arthur lundi 19 octobre 20 h, une seule fois ». */
export function oneOffRecap(title: string, startIso: string, endIso: string | null) {
  const hm = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const date = new Date(startIso).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", weekday: "long", day: "numeric", month: "long" });
  return `${title} ${date} ${hoursText(hm(startIso), endIso ? hm(endIso) : null)}, une seule fois`;
}

/** Même activité ? (titre équivalent, mêmes jours, même heure de début) : sert à refuser un doublon. */
export const sameSlot = (a: { title: string; days: string | null; at_time: string | null }, b: { title: string; days: string; start: string }) => {
  const n = (s: string) => fold(s).replace(/[^a-z0-9]+/g, " ").trim();
  return a.at_time === b.start && (a.days ?? "") === b.days && n(a.title) === n(b.title);
};

// ---------- Nouveau jour de la semaine (reprogrammer une habitude manquée) ----------

/** Le dimanche de la semaine du jour donné (ou le jour même si c'est dimanche). */
export const endOfWeek = (day: string) => addDays(day, 7 - (((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7) + 1));

/** Message final écrit par le CODE (lu à voix haute) : ce que les outils ont réellement fait. Vide si rien. */
export function recapText(lines: string[]) {
  const uniq = [...new Set(lines)];
  if (!uniq.length) return "";
  return uniq.length === 1 ? `Fait : ${uniq[0]}` : `Fait :\n${uniq.map((l) => `- ${l}`).join("\n")}`;
}

// ---------- Actions de l'écran (supprimer / déplacer une occurrence, répondre au bilan d'une habitude) ----------

export type SlotAction =
  | { action: "skip"; rule_id: number; day: string }
  | { action: "move"; rule_id: number; day: string; new_day: string; new_start: string; new_end: string | null }
  | { action: "habit"; rule_id: number; day: string; status: "done" | "missed"; then: "tomorrow" | "week" | null };

const isDay = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(`${s}T12:00:00Z`).toISOString().slice(0, 10) === s;

/** Valide ce que l'écran envoie. Un bilan ne peut concerner qu'un jour passé ou le jour même. */
export function parseSlotAction(b: Record<string, unknown>, today: string): Res<SlotAction> {
  const rule_id = b.rule_id;
  if (typeof rule_id !== "number" || !Number.isSafeInteger(rule_id) || rule_id < 1) return fail("rule_id invalide");
  if (!isDay(b.day)) return fail("day invalide (AAAA-MM-JJ)");
  if (b.action === "skip") return { ok: true, value: { action: "skip", rule_id, day: b.day } };
  if (b.action === "move") {
    const start = parseHour(b.new_start);
    if (!isDay(b.new_day) || !start.ok) return fail("new_day (AAAA-MM-JJ) et new_start (HH:MM) requis");
    let end: string | null = null;
    if (b.new_end) {
      const e = parseHour(b.new_end);
      if (!e.ok || e.value <= start.value) return fail("new_end invalide : après le début, le même jour");
      end = e.value;
    }
    return { ok: true, value: { action: "move", rule_id, day: b.day, new_day: b.new_day, new_start: start.value, new_end: end } };
  }
  if (b.action === "habit") {
    if (b.status !== "done" && b.status !== "missed") return fail("status doit être done ou missed");
    if (b.day > today) return fail("on ne répond pas pour un jour à venir");
    const then = b.then === "tomorrow" || b.then === "week" ? b.then : null;
    return { ok: true, value: { action: "habit", rule_id, day: b.day, status: b.status, then: b.status === "missed" ? then : null } };
  }
  return fail("action inconnue : skip, move ou habit");
}

/**
 * Affichage d'une réponse : le « OK » de l'IA devant « Fait : … » n'apporte rien (la phrase du code dit tout), et une heure ne doit pas être
 * coupée en fin de ligne (« 20 h » puis « 30 ») : espaces et tiret insécables autour des heures. La lecture vocale n'est pas touchée.
 */
export function displayReply(text: string) {
  return text
    .replace(/^\s*(?:ok|d'accord|c'est fait|très bien)[ .!]*\n+(?=Fait\s?:)/i, "")
    .replace(/(\d) h\b/g, "$1\u00a0h")
    .replace(/\bh (\d{2})\b/g, "h\u00a0$1")
    .replace(/(\d|h)-(\d)/g, "$1\u2011$2");
}
