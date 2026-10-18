import { NextResponse } from "next/server";
import { denied } from "@/lib/access";
import { syncGoogle } from "@/lib/google-sync";
import { supabaseAdmin } from "@/lib/supabase";

export const maxDuration = 60;

// Passage Google : séances de sport détectées dans l'agenda + rendez-vous trouvés dans les mails (lecture seule, 20 mails lus par Haiku au plus par jour).
// Appelé par l'app à l'ouverture ; au plus un vrai passage toutes les 20 minutes.
export async function POST(req: Request) {
  if (denied(req)) return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  try {
    return NextResponse.json(await syncGoogle(supabaseAdmin()));
  } catch (e) {
    console.error("Passage Google :", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erreur Google" }, { status: 502 });
  }
}
