import { NextResponse } from "next/server";
import { saveConnection } from "@/lib/bank-store";
import { finishConnection } from "@/lib/bank-flow";
import * as eb from "@/lib/enable-banking";
import { supabaseAdmin } from "@/lib/supabase";

// Retour de la banque après l'accord de Ruben. Cette adresse ne peut PAS demander le code d'accès (c'est la banque qui redirige le navigateur) :
// elle est protégée par le « state » signé (valable 10 min, lié à ce seul usage) créé par /api/bank/connect.
// On revient toujours sur l'app avec ?bank=ok ou ?bank=erreur&msg=… (message brut, tronqué).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (status: string, msg?: string) => NextResponse.redirect(new URL(`/?bank=${status}${msg ? `&msg=${encodeURIComponent(msg.slice(0, 400))}` : ""}`, url.origin));

  if (url.searchParams.get("error")) return back("refuse", url.searchParams.get("error_description") ?? url.searchParams.get("error") ?? undefined); // Ruben a refusé chez sa banque
  try {
    const c = await finishConnection({ eb, secret: process.env.MAJORDOME_ACCESS_CODE ?? "", state: url.searchParams.get("state"), code: url.searchParams.get("code") });
    const saved = await saveConnection(supabaseAdmin(), c);
    if (saved.missingTable) return back("erreur", "La table bank_connections n'existe pas encore : appliquez la migration 0009 puis reconnectez votre banque.");
    if (saved.error) return back("erreur", saved.error.message);
    return back("ok");
  } catch (err) {
    console.error("Retour banque en échec :", err instanceof Error ? err.message : "erreur inconnue"); // jamais le contenu des jetons
    return back("erreur", err instanceof Error ? err.message : String(err));
  }
}
