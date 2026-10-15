import { NextResponse } from "next/server";
import { denied } from "@/lib/access";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: Request) {
  if (denied(req)) return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  const { data, error } = await supabaseAdmin().from("memories").select("id,content,category,created_at").order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ memories: data ?? [] });
}

// Suppression d'un souvenir, à la demande explicite de Ruben (bouton + confirmation dans l'app).
export async function DELETE(req: Request) {
  if (denied(req)) return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  const { id } = (await req.json().catch(() => ({}))) as { id?: number };
  if (typeof id !== "number") return NextResponse.json({ error: "id requis" }, { status: 400 });
  const { error } = await supabaseAdmin().from("memories").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
