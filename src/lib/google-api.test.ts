import { describe, expect, it, vi } from "vitest";
import { bodyText, calendarTemplateUrl, getMailHead, GoogleAuthError, listEvents, listUnreadIds, normalizeEvent, refreshAccessToken } from "./google-api";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64url");

describe("jeton d'accès", () => {
  it("renvoie le jeton d'accès", async () => {
    const f = vi.fn(async () => json(200, { access_token: "tok", expires_in: 3600 }));
    expect(await refreshAccessToken("refresh", f as never)).toBe("tok");
    const body = String((f.mock.calls[0] as unknown as [string, RequestInit])[1].body);
    expect(body).toContain("grant_type=refresh_token");
  });
  it("invalid_grant → GoogleAuthError (il faut reconnecter), autre erreur → message lisible", async () => {
    await expect(refreshAccessToken("r", (async () => json(400, { error: "invalid_grant" })) as never)).rejects.toBeInstanceOf(GoogleAuthError);
    await expect(refreshAccessToken("r", (async () => json(500, { error: "boom" })) as never)).rejects.toThrow(/Google 500/);
  });
});

describe("Agenda", () => {
  it("événement avec heure, toute la journée, annulé, sans fin", () => {
    expect(normalizeEvent({ id: "a", summary: "Dentiste", location: "Paris 9e", start: { dateTime: "2026-10-20T14:00:00+02:00" }, end: { dateTime: "2026-10-20T15:00:00+02:00" } })).toEqual({
      id: "a", title: "Dentiste", start: "2026-10-20T14:00:00+02:00", end: "2026-10-20T15:00:00+02:00", allDay: false, place: "Paris 9e",
    });
    expect(normalizeEvent({ id: "b", summary: "Férié", start: { date: "2026-11-01" }, end: { date: "2026-11-02" } })).toMatchObject({ allDay: true, start: "2026-10-31T23:00:00.000Z" });
    expect(normalizeEvent({ id: "c", status: "cancelled", start: { dateTime: "2026-10-20T14:00:00Z" }, end: { dateTime: "2026-10-20T15:00:00Z" } })).toBeNull();
    expect(normalizeEvent({ id: "d", start: { dateTime: "2026-10-20T14:00:00Z" } })).toBeNull();
    expect(normalizeEvent({ id: "e", start: { dateTime: "2026-10-20T14:00:00Z" }, end: { dateTime: "2026-10-20T15:00:00Z" } })?.title).toBe("(sans titre)");
  });
  it("listEvents : lecture seule (GET, jeton en en-tête), événements triés et nettoyés", async () => {
    const f = vi.fn(async () => json(200, { items: [{ id: "a", summary: "X", start: { dateTime: "2026-10-20T10:00:00Z" }, end: { dateTime: "2026-10-20T11:00:00Z" } }, { id: "z", status: "cancelled" }] }));
    const ev = await listEvents("tok", new Date("2026-10-19T00:00:00Z"), new Date("2026-10-26T00:00:00Z"), f as never);
    expect(ev.map((e) => e.id)).toEqual(["a"]);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("calendar/v3/calendars/primary/events");
    expect(init.method).toBeUndefined(); // GET
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });
  it("401 de Google → il faut reconnecter", async () => {
    await expect(listEvents("tok", new Date(), new Date(), (async () => json(401, { error: { message: "x" } })) as never)).rejects.toBeInstanceOf(GoogleAuthError);
  });
});

describe("Gmail (lecture seule)", () => {
  it("mails non lus des 48 h, importants si demandé", async () => {
    const f = vi.fn(async () => json(200, { messages: [{ id: "1" }, { id: "2" }] }));
    expect(await listUnreadIds("tok", { important: true }, f as never)).toEqual(["1", "2"]);
    const url = decodeURIComponent(String((f.mock.calls[0] as unknown as [string])[0]).replace(/\+/g, " "));
    expect(url).toContain("is:unread newer_than:2d is:important");
    expect(await listUnreadIds("tok", {}, (async () => json(200, {})) as never)).toEqual([]);
  });
  it("en-têtes : expéditeur, objet, extrait", async () => {
    const f = async () => json(200, { id: "1", snippet: "Votre RDV", payload: { headers: [{ name: "From", value: "Doctolib <x@doctolib.fr>" }, { name: "Subject", value: "Rendez-vous confirmé" }] } });
    expect(await getMailHead("tok", "1", f as never)).toEqual({ id: "1", from: "Doctolib <x@doctolib.fr>", subject: "Rendez-vous confirmé", snippet: "Votre RDV" });
  });
  it("corps : text/plain d'abord, sinon HTML dépouillé, coupé", () => {
    const plain = { id: "1", payload: { mimeType: "multipart/alternative", parts: [{ mimeType: "text/html", body: { data: b64("<p>html</p>") } }, { mimeType: "text/plain", body: { data: b64("Bonjour,\n\nRDV mardi 14 h.") } }] } };
    expect(bodyText(plain)).toBe("Bonjour, RDV mardi 14 h.");
    const html = { id: "2", payload: { mimeType: "text/html", body: { data: b64("<style>x{}</style><p>RDV <b>jeudi</b></p>") } } };
    expect(bodyText(html)).toBe("RDV jeudi");
    expect(bodyText({ id: "3", payload: { mimeType: "text/plain", body: { data: b64("a".repeat(5000)) } } })).toHaveLength(2000);
    expect(bodyText({ id: "4" })).toBe("");
  });
});

describe("lien « Ajouter à Google Agenda »", () => {
  it("heure de Paris, 1 h par défaut, titre et lieu encodés", () => {
    const url = new URL(calendarTemplateUrl({ title: "Dentiste & co", start: "2026-10-20T12:00:00.000Z", place: "12 rue X, Paris" }));
    expect(url.origin + url.pathname).toBe("https://calendar.google.com/calendar/render");
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("text")).toBe("Dentiste & co");
    expect(url.searchParams.get("dates")).toBe("20261020T140000/20261020T150000"); // 12:00 UTC = 14:00 à Paris (été)
    expect(url.searchParams.get("location")).toBe("12 rue X, Paris");
    expect(url.searchParams.get("ctz")).toBe("Europe/Paris");
  });
});
