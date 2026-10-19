// Lecture seule de Google (Agenda + Gmail). Aucune écriture chez Google, jamais : seuls des GET et l'échange de jeton.
// Les fonctions prennent `fetchFn` pour être testées sans réseau. Les jetons et le contenu des mails ne sont jamais écrits dans les logs.
import { parisDay, parisIso } from "./task-groups";
import { parisHM } from "./planning";

type FetchFn = typeof fetch;

/** Le jeton de Google est refusé (invalid_grant : jeton expiré ou révoqué, fréquent en mode « Test » après ~7 jours) : il faut reconnecter. */
export class GoogleAuthError extends Error {
  constructor(message = "Connexion Google expirée") {
    super(message);
    this.name = "GoogleAuthError";
  }
}

/** Jeton d'accès (1 h) à partir du refresh token gardé côté serveur. */
export async function refreshAccessToken(refreshToken: string, fetchFn: FetchFn = fetch): Promise<string> {
  const res = await fetchFn("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (data?.error === "invalid_grant") throw new GoogleAuthError();
    throw new Error(`Google ${res.status} : ${data?.error_description ?? data?.error ?? "jeton refusé"}`);
  }
  return data.access_token as string;
}

async function get<T>(url: string, accessToken: string, fetchFn: FetchFn): Promise<T> {
  const res = await fetchFn(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) throw new GoogleAuthError();
  if (!res.ok) throw new Error(`Google ${res.status} : ${data?.error?.message ?? "erreur"}`);
  return data as T;
}

// ---------- Agenda ----------

export type AgendaEvent = { id: string; title: string; start: string; end: string; allDay: boolean; place: string | null; link: string | null };

type RawEvent = { id?: string; htmlLink?: string; summary?: string; location?: string; status?: string; start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string } };

/** Événement Google → format de l'app. Les événements annulés sont ignorés ; un événement « toute la journée » commence à minuit (heure de Paris). */
export function normalizeEvent(e: RawEvent): AgendaEvent | null {
  if (!e.id || e.status === "cancelled" || !e.start || !e.end) return null;
  const allDay = !e.start.dateTime;
  const start = e.start.dateTime ?? (e.start.date ? parisIso(e.start.date, 0, 0) : "");
  const end = e.end.dateTime ?? (e.end.date ? parisIso(e.end.date, 0, 0) : "");
  if (!start || !end || Number.isNaN(Date.parse(start))) return null;
  return { id: e.id, title: (e.summary ?? "(sans titre)").slice(0, 120), start, end, allDay, place: e.location ? e.location.slice(0, 120) : null, link: e.htmlLink?.startsWith("https://") ? e.htmlLink : null };
}

export async function listEvents(accessToken: string, from: Date, to: Date, fetchFn: FetchFn = fetch): Promise<AgendaEvent[]> {
  const p = new URLSearchParams({ singleEvents: "true", orderBy: "startTime", maxResults: "250", timeMin: from.toISOString(), timeMax: to.toISOString() });
  const data = await get<{ items?: RawEvent[] }>(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${p}`, accessToken, fetchFn);
  return (data.items ?? []).map(normalizeEvent).filter((e): e is AgendaEvent => e !== null);
}

// ---------- Gmail ----------

export type MailHead = { id: string; from: string; subject: string; snippet: string };
type RawMessage = { id: string; snippet?: string; payload?: { headers?: { name: string; value: string }[]; mimeType?: string; body?: { data?: string }; parts?: RawPart[] } };
type RawPart = { mimeType?: string; filename?: string; body?: { data?: string }; parts?: RawPart[] };

const header = (m: RawMessage, name: string) => m.payload?.headers?.find((h) => h.name.toLowerCase() === name)?.value ?? "";

/** Mails non lus des dernières 48 h (liste d'identifiants). `important` = seulement ceux que Gmail marque importants. */
export async function listUnreadIds(accessToken: string, opts: { important?: boolean; max?: number } = {}, fetchFn: FetchFn = fetch): Promise<string[]> {
  const q = `is:unread newer_than:2d${opts.important ? " is:important" : ""}`;
  const p = new URLSearchParams({ q, maxResults: String(opts.max ?? 50) });
  const data = await get<{ messages?: { id: string }[] }>(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${p}`, accessToken, fetchFn);
  return (data.messages ?? []).map((m) => m.id);
}

/** En-têtes (expéditeur, objet) + extrait : pas le corps. Suffit au pré-filtre et au briefing. */
export async function getMailHead(accessToken: string, id: string, fetchFn: FetchFn = fetch): Promise<MailHead> {
  const p = new URLSearchParams({ format: "metadata" });
  p.append("metadataHeaders", "From");
  p.append("metadataHeaders", "Subject");
  const m = await get<RawMessage>(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}?${p}`, accessToken, fetchFn);
  return { id, from: header(m, "from"), subject: header(m, "subject"), snippet: m.snippet ?? "" };
}

const decode = (b64url: string) => Buffer.from(b64url.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");

/** Texte brut d'un message (partie text/plain, à défaut le HTML dépouillé de ses balises), coupé à `max` caractères. Jamais stocké. */
export function bodyText(m: RawMessage, max = 2000): string {
  const found: { plain?: string; html?: string } = {};
  const walk = (part: RawPart | RawMessage["payload"]) => {
    if (!part) return;
    const data = part.body?.data;
    if (data && part.mimeType === "text/plain" && !found.plain) found.plain = decode(data);
    else if (data && part.mimeType === "text/html" && !found.html) found.html = decode(data);
    for (const sub of part.parts ?? []) walk(sub);
  };
  walk(m.payload);
  const raw = found.plain ?? (found.html ? found.html.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ") : "");
  return raw.replace(/\s+/g, " ").trim().slice(0, max);
}

export async function getMailBody(accessToken: string, id: string, fetchFn: FetchFn = fetch): Promise<string> {
  const m = await get<RawMessage>(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=full`, accessToken, fetchFn);
  return bodyText(m);
}

// ---------- Lien « Ajouter à Google Agenda » (c'est Google qui écrit, après le tap de Ruben) ----------

const stamp = (iso: string) => {
  const { h, m } = parisHM(iso);
  return `${parisDay(new Date(iso)).replace(/-/g, "")}T${String(h).padStart(2, "0")}${String(m).padStart(2, "0")}00`;
};

export function calendarTemplateUrl(e: { title: string; start: string; end?: string; place?: string | null }) {
  const end = e.end ?? new Date(new Date(e.start).getTime() + 3_600_000).toISOString(); // une heure par défaut
  const p = new URLSearchParams({ action: "TEMPLATE", text: e.title, dates: `${stamp(e.start)}/${stamp(end)}`, ctz: "Europe/Paris" });
  if (e.place) p.set("location", e.place);
  return `https://calendar.google.com/calendar/render?${p}`;
}
