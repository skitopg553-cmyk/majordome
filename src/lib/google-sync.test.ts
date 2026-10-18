import { beforeEach, describe, expect, it, vi } from "vitest";

// Faux Haiku et fausse API Google : aucun réseau, aucune clé.
const h = vi.hoisted(() => ({ refresh: vi.fn(), ai: vi.fn(), unread: [] as string[], heads: {} as Record<string, { id: string; from: string; subject: string; snippet: string }> }));
vi.mock("./ai", () => ({ runAgent: h.ai }));
vi.mock("./google-api", async (orig) => ({
  ...(await orig<typeof import("./google-api")>()),
  refreshAccessToken: (...a: unknown[]) => h.refresh(...a),
  listUnreadIds: async () => h.unread,
  getMailHead: async (_t: string, id: string) => h.heads[id],
  getMailBody: async () => "Bonjour, votre rendez-vous est mardi 20 octobre à 14h30 au 12 rue X.",
}));

import { GoogleAuthError } from "./google-api";
import { accessToken, detectWorkouts, forgetToken, scanMails } from "./google-sync";

type R = Record<string, unknown>;
const tables: Record<string, R[]> = {};
// Mini base en mémoire : assez pour select / insert / gte / in / count.
const db = {
  from(name: string) {
    const rows = (tables[name] ??= []);
    const q = { op: "select", filters: [] as ((r: R) => boolean)[], values: {} as R, count: false, single: false };
    const run = () => {
      if (q.op === "insert") {
        rows.push({ id: rows.length + 1, created_at: new Date().toISOString(), ...q.values });
        return { data: null, error: null };
      }
      const match = rows.filter((r) => q.filters.every((f) => f(r)));
      return { data: q.single ? (match.at(-1) ?? null) : match, error: null, count: q.count ? match.length : null };
    };
    const b: Record<string, unknown> = {
      select: (_c?: string, o?: { count?: string }) => ((q.count = !!o?.count), b),
      insert: (v: R) => ((q.op = "insert"), (q.values = v), b),
      gte: (k: string, v: string) => (q.filters.push((r) => String(r[k]) >= v), b),
      in: (k: string, vs: string[]) => (q.filters.push((r) => vs.includes(String(r[k]))), b),
      order: () => b,
      limit: () => b,
      maybeSingle: () => ((q.single = true), b),
      then: (res: (v: unknown) => unknown) => Promise.resolve(run()).then(res),
    };
    return b;
  },
} as never;

const ev = (id: string, title: string, start: string, end: string, allDay = false) => ({ id, title, start, end, allDay, place: null });
const now = new Date("2026-10-16T12:00:00+02:00");

beforeEach(() => {
  forgetToken();
  h.refresh.mockReset();
  process.env.GOOGLE_ENABLED = "true";
  for (const k of Object.keys(tables)) delete tables[k];
  h.ai.mockReset();
  h.unread = [];
  h.heads = {};
});

describe("détection du sport dans les vrais événements", () => {
  it("ajoute les séances passées à Forme (durée calculée), sans doublon, sans toucher au futur ni aux autres événements", async () => {
    tables.workouts = [{ date: "2026-10-14", kind: "Musculation" }]; // déjà noté à la main
    const events = [
      ev("1", "Musculation", "2026-10-14T18:00:00+02:00", "2026-10-14T19:00:00+02:00"), // doublon
      ev("2", "Course à pied", "2026-10-15T07:00:00+02:00", "2026-10-15T07:45:00+02:00"),
      ev("3", "Dentiste", "2026-10-15T10:00:00+02:00", "2026-10-15T11:00:00+02:00"), // pas du sport
      ev("4", "Yoga", "2026-10-17T18:00:00+02:00", "2026-10-17T19:00:00+02:00"), // futur
    ];
    expect(await detectWorkouts(db, events, now)).toBe(1);
    expect(tables.workouts).toHaveLength(2);
    expect(tables.workouts[1]).toMatchObject({ date: "2026-10-15", kind: "Course à pied", minutes: 45, source: "agenda" });
    expect(await detectWorkouts(db, events, now)).toBe(0); // idempotent
  });
});

describe("mails → rendez-vous", () => {
  const good = '{"found":true,"title":"Dentiste Dr Martin","date":"2026-10-20","time":"14:30","place":"12 rue X"}';
  beforeEach(() => {
    h.unread = ["a1", "b2", "c3"];
    h.heads = {
      a1: { id: "a1", from: "Doctolib <x@doctolib.fr>", subject: "Rendez-vous confirmé mardi 14h30", snippet: "" },
      b2: { id: "b2", from: "promo@shop.fr", subject: "Soldes -50 %", snippet: "" },
      c3: { id: "c3", from: "ami@x.fr", subject: "Salut", snippet: "" },
    };
  });
  it("seul le mail de RDV va à Haiku ; la date est vérifiée en code ; la proposition est enregistrée sans le contenu du mail", async () => {
    h.ai.mockResolvedValue(good);
    expect(await scanMails(db, "tok", [], now)).toEqual({ proposed: 1, noTable: false });
    expect(h.ai).toHaveBeenCalledTimes(1);
    expect(h.ai.mock.calls[0][0]).toMatchObject({ tier: "haiku", purpose: "mail-rdv" });
    expect(tables.mail_suggestions[0]).toMatchObject({ message_id: "a1", status: "new", title: "Dentiste Dr Martin", start_at: "2026-10-20T12:30:00.000Z", place: "12 rue X" });
    expect(JSON.stringify(tables.mail_suggestions)).not.toContain("Bonjour"); // jamais le contenu du mail
  });
  it("événement déjà dans l'agenda au même moment : rien proposé (mais le mail n'est pas relu demain)", async () => {
    h.ai.mockResolvedValue(good);
    const r = await scanMails(db, "tok", [ev("e", "Dentiste", "2026-10-20T14:30:00+02:00", "2026-10-20T15:30:00+02:00")], now);
    expect(r.proposed).toBe(0);
    expect(tables.mail_suggestions[0]).toMatchObject({ message_id: "a1", status: "none" });
  });
  it("réponse de Haiku inutilisable ou date passée : status none, pas de proposition", async () => {
    h.ai.mockResolvedValue('{"found":true,"title":"x","date":"2026-10-01","time":"10:00"}');
    expect((await scanMails(db, "tok", [], now)).proposed).toBe(0);
    expect(tables.mail_suggestions[0].status).toBe("none");
  });
  it("mails déjà traités ignorés ; plafond de 20 par jour respecté", async () => {
    tables.mail_suggestions = [{ id: 1, message_id: "a1", status: "none", created_at: now.toISOString() }];
    await scanMails(db, "tok", [], now);
    expect(h.ai).not.toHaveBeenCalled();
    tables.mail_suggestions = Array.from({ length: 20 }, (_, i) => ({ id: i + 1, message_id: "old" + i, status: "none", created_at: new Date().toISOString() }));
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
    expect((await scanMails(db, "tok", [], new Date())).proposed).toBe(0);
    vi.useRealTimers();
    expect(h.ai).not.toHaveBeenCalled();
  });
  it("Haiku indisponible : on s'arrête sans rien enregistrer (réessai au prochain passage)", async () => {
    h.ai.mockRejectedValue(new Error("529 overloaded"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await scanMails(db, "tok", [], now)).proposed).toBe(0);
    expect(tables.mail_suggestions ?? []).toHaveLength(0);
    spy.mockRestore();
  });
});

describe("état de la connexion Google", () => {
  it("désactivée, pas connectée, connectée : jeton d'accès renvoyé", async () => {
    process.env.GOOGLE_ENABLED = "false";
    expect(await accessToken(db)).toEqual({ state: "off" });
    process.env.GOOGLE_ENABLED = "true";
    expect(await accessToken(db)).toEqual({ state: "not-connected" });
    tables.google_tokens = [{ id: 1, refresh_token: "r1" }, { id: 2, refresh_token: "r2" }];
    h.refresh.mockResolvedValue("access");
    expect(await accessToken(db)).toEqual({ state: "ok", token: "access" });
    expect(h.refresh).toHaveBeenCalledWith("r2"); // le jeton le plus récent
  });
  it("invalid_grant (jeton expiré, fréquent en mode Test) → « reconnect », jamais une erreur qui casse l'écran", async () => {
    tables.google_tokens = [{ id: 1, refresh_token: "r1" }];
    h.refresh.mockRejectedValue(new GoogleAuthError());
    expect(await accessToken(db)).toEqual({ state: "reconnect" });
  });
  it("une autre panne de Google remonte (l'écran affiche une erreur lisible, pas « reconnecter »)", async () => {
    tables.google_tokens = [{ id: 1, refresh_token: "r1" }];
    h.refresh.mockRejectedValue(new Error("Google 500"));
    await expect(accessToken(db)).rejects.toThrow("Google 500");
  });
});
