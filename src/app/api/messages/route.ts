import { NextResponse } from "next/server";
import { denied } from "@/lib/access";
import { supabaseAdmin } from "@/lib/supabase";

// Les 30 derniers messages (dans l'ordre chronologique), éventuellement après une date
// (?after=… : posée par le bouton « Nouvelle conversation », qui ne supprime rien en base).
export async function GET(req: Request) {
  if (denied(req)) return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  const afterDate = new URL(req.url).searchParams.get("after");
  let q = supabaseAdmin().from("messages").select("role,content,created_at").order("created_at", { ascending: false }).limit(30);
  if (afterDate) q = q.gt("created_at", afterDate);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ messages: (data ?? []).reverse() });
}
