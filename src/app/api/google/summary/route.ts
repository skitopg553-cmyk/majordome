import { NextResponse } from "next/server";
import { denied } from "@/lib/access";
import { calendarTemplateUrl, getMailHead, GoogleAuthError, listUnreadIds } from "@/lib/google-api";
import { accessToken, forgetToken } from "@/lib/google-sync";
import { isMissingTable, supabaseAdmin } from "@/lib/supabase";

// Pour l'Accueil : nombre de mails importants non lus (3 objets au plus, lus dans les en-têtes seulement) + rendez-vous trouvés dans les mails à proposer.
// Mis en mémoire 5 minutes : l'Accueil s'ouvre souvent.
let cache: { at: number; mails: { count: number; subjects: string[] } } | null = null;

export async function GET(req: Request) {
  if (denied(req)) return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  const db = supabaseAdmin();
  try {
    const t = await accessToken(db);
    if (t.state !== "ok") return NextResponse.json({ state: t.state });
    if (!cache || Date.now() - cache.at > 5 * 60_000) {
      const ids = await listUnreadIds(t.token, { important: true, max: 50 });
      const heads = await Promise.all(ids.slice(0, 3).map((id) => getMailHead(t.token, id)));
      cache = { at: Date.now(), mails: { count: ids.length, subjects: heads.map((h) => h.subject.replace(/\s+/g, " ").trim().slice(0, 60)) } };
    }
    const s = await db.from("mail_suggestions").select("id,title,start_at,place").eq("status", "new").order("start_at");
    const suggestions = isMissingTable(s.error) || s.error ? [] : (s.data ?? []).map((r) => ({ id: r.id, title: r.title, start: r.start_at, place: r.place, calendarUrl: calendarTemplateUrl({ title: r.title, start: r.start_at, place: r.place }) }));
    return NextResponse.json({ state: "ok", mails: cache.mails, suggestions });
  } catch (e) {
    if (e instanceof GoogleAuthError) {
      forgetToken();
      cache = null;
      return NextResponse.json({ state: "reconnect" });
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erreur Google" }, { status: 502 });
  }
}
