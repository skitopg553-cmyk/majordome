import { NextResponse } from "next/server";
import { denied } from "@/lib/access";
import { accessToken } from "@/lib/google-sync";
import { supabaseAdmin } from "@/lib/supabase";

// État de la connexion Google pour l'écran : off (désactivée), no-table, not-connected, reconnect (jeton expiré : carte « Reconnecter »), ok.
export async function GET(req: Request) {
  if (denied(req)) return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  try {
    return NextResponse.json({ state: (await accessToken(supabaseAdmin())).state });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erreur Google" }, { status: 502 });
  }
}
