// Orchestration Google (lecture seule) côté serveur : jeton, agenda, détection du sport, mails → rendez-vous proposés.
// Chaque appel à Haiku passe par runAgent, donc est journalisé dans ai_calls. Sans la table (migration 0006) : état « no-table », rien ne casse.
import { runAgent } from "./ai";
import { GoogleAuthError, getMailBody, getMailHead, listEvents, listUnreadIds, refreshAccessToken, type AgendaEvent, type MailHead } from "./google-api";
import { googleEnabled } from "./google";
import { isWorkoutTitle } from "./forme";
import { DAILY_CAP, alreadyInAgenda, extractionPrompt, parseExtraction, selectCandidates } from "./mail-rdv";
import { isMissingTable, supabaseAdmin } from "./supabase";
import { parisDay, parisIso } from "./task-groups";
import { fold } from "./text";

type Db = ReturnType<typeof supabaseAdmin>;
export type GoogleState = "off" | "no-table" | "not-connected" | "reconnect" | "ok";

// Jeton d'accès gardé en mémoire de l'instance (valable 1 h) : évite un aller-retour vers Google à chaque appel.
let cached: { token: string; until: number } | null = null;

/** Un jeton d'accès valide, ou l'état qui explique pourquoi on n'en a pas. */
export async function accessToken(db: Db, now = Date.now()): Promise<{ state: "ok"; token: string } | { state: Exclude<GoogleState, "ok"> }> {
  if (!googleEnabled()) return { state: "off" };
  if (cached && cached.until > now) return { state: "ok", token: cached.token };
  const r = await db.from("google_tokens").select("refresh_token").order("id", { ascending: false }).limit(1).maybeSingle();
  if (isMissingTable(r.error)) return { state: "no-table" };
  if (r.error) throw new Error(r.error.message);
  if (!r.data) return { state: "not-connected" };
  try {
    const token = await refreshAccessToken(r.data.refresh_token);
    cached = { token, until: now + 50 * 60_000 };
    return { state: "ok", token };
  } catch (e) {
    cached = null;
    if (e instanceof GoogleAuthError) return { state: "reconnect" }; // invalid_grant : une carte « Reconnecter Google », jamais un écran cassé
    throw e;
  }
}
export const forgetToken = () => (cached = null);

/** Détecte les séances de sport dans les événements PASSÉS (14 derniers jours) et les ajoute à Forme (source « agenda »), sans doublon. */
export async function detectWorkouts(db: Db, events: AgendaEvent[], now: Date) {
  const past = events.filter((e) => !e.allDay && new Date(e.end) <= now && isWorkoutTitle(e.title));
  if (!past.length) return 0;
  const since = parisDay(new Date(past.map((e) => e.start).sort()[0]));
  const existing = await db.from("workouts").select("date,kind").gte("date", since);
  if (existing.error) return 0; // table Forme absente : pas de détection
  const seen = new Set((existing.data ?? []).map((w) => `${w.date}|${fold(w.kind)}`));
  let added = 0;
  for (const e of past) {
    const date = parisDay(new Date(e.start));
    const kind = e.title.replace(/\s+/g, " ").trim().slice(0, 60);
    if (seen.has(`${date}|${fold(kind)}`)) continue;
    const min = Math.round((new Date(e.end).getTime() - new Date(e.start).getTime()) / 60_000);
    const r = await db.from("workouts").insert({ date, kind, minutes: min >= 1 && min <= 600 ? min : null, source: "agenda" });
    if (!r.error) {
      seen.add(`${date}|${fold(kind)}`);
      added++;
    }
  }
  return added;
}

/** Lit les mails non lus des 48 h, pré-filtre en code, interroge Haiku sur les candidats (plafond 20/jour) et enregistre les rendez-vous proposés. */
export async function scanMails(db: Db, token: string, events: AgendaEvent[], now: Date) {
  const today = parisDay(now);
  const quota = await db.from("mail_suggestions").select("id", { count: "exact", head: true }).gte("created_at", parisIso(today, 0, 0));
  if (isMissingTable(quota.error)) return { proposed: 0, noTable: true };
  const remaining = DAILY_CAP - (quota.count ?? 0);
  if (remaining <= 0) return { proposed: 0, noTable: false };

  const ids = await listUnreadIds(token);
  if (!ids.length) return { proposed: 0, noTable: false };
  const known = await db.from("mail_suggestions").select("message_id").in("message_id", ids); // ids Gmail : hexadécimaux, sans caractère spécial
  const knownIds = new Set((known.data ?? []).map((r) => r.message_id as string));
  const heads: MailHead[] = [];
  for (const id of ids.filter((i) => !knownIds.has(i)).slice(0, 40)) heads.push(await getMailHead(token, id));
  let proposed = 0;
  for (const mail of selectCandidates(heads, knownIds, remaining)) {
    const body = await getMailBody(token, mail.id);
    const prompt = extractionPrompt({ from: mail.from, subject: mail.subject, body: body || mail.snippet }, today);
    let text: string;
    try {
      text = await runAgent({ tier: "haiku", purpose: "mail-rdv", system: prompt.system, messages: [{ role: "user", content: prompt.user }], maxTokens: 200 });
    } catch (e) {
      console.error("Haiku (mail → rendez-vous) :", e instanceof Error ? e.message : e);
      break; // l'IA est indisponible : on réessaiera au prochain passage, sans dépenser
    }
    const x = parseExtraction(text, today);
    if (x.ok && !alreadyInAgenda(x.value.start, events)) {
      await db.from("mail_suggestions").insert({ message_id: mail.id, status: "new", title: x.value.title, start_at: x.value.start, place: x.value.place });
      proposed++;
    } else await db.from("mail_suggestions").insert({ message_id: mail.id, status: "none" });
  }
  return { proposed, noTable: false };
}

/** Passage complet : sport détecté dans l'agenda + mails → propositions. Limité à un passage toutes les 20 minutes par instance. */
let lastSync = 0;
export async function syncGoogle(db: Db, now = new Date()) {
  const a = await accessToken(db, now.getTime());
  if (a.state !== "ok") return { state: a.state, workouts: 0, proposed: 0, skipped: false };
  if (now.getTime() - lastSync < 20 * 60_000) return { state: "ok" as const, workouts: 0, proposed: 0, skipped: true };
  lastSync = now.getTime();
  try {
    const events = await listEvents(a.token, new Date(now.getTime() - 14 * 86_400_000), new Date(now.getTime() + 14 * 86_400_000));
    const workouts = await detectWorkouts(db, events, now);
    const { proposed } = await scanMails(db, a.token, events, now);
    return { state: "ok" as const, workouts, proposed, skipped: false };
  } catch (e) {
    if (e instanceof GoogleAuthError) {
      forgetToken();
      return { state: "reconnect" as const, workouts: 0, proposed: 0, skipped: false };
    }
    throw e;
  }
}
