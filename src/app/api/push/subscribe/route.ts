import { NextResponse } from "next/server";
import { denied } from "@/lib/access";
import { isMissingTable, supabaseAdmin } from "@/lib/supabase";

// Enregistre l'abonnement push du téléphone (après l'accord de Ruben pour les notifications).
export async function POST(req: Request) {
  if (denied(req)) return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  const sub = (await req.json().catch(() => null)) as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | null;
  const endpoint = sub?.endpoint;
  const p256dh = sub?.keys?.p256dh;
  const auth = sub?.keys?.auth;
  if (typeof endpoint !== "string" || !endpoint.startsWith("https://") || typeof p256dh !== "string" || typeof auth !== "string") {
    return NextResponse.json({ error: "Abonnement invalide" }, { status: 400 });
  }
  const { error } = await supabaseAdmin().from("push_subscriptions").upsert({ endpoint, p256dh, auth }, { onConflict: "endpoint" });
  if (isMissingTable(error)) return NextResponse.json({ error: "Les rappels ne sont pas encore installés (migration 0007 à valider)." }, { status: 503 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
