import { NextResponse } from "next/server";
import { denied } from "@/lib/access";
import { BANK_REDIRECT_URL } from "@/lib/bank-config";
import { connectBank } from "@/lib/bank-flow";
import * as eb from "@/lib/enable-banking";

// « Connecter ma banque » : renvoie l'adresse de la banque où Ruben donne son accord (lecture seule, 90 jours).
// POST + code d'accès : une simple adresse (GET) ne peut pas porter le code d'accès, donc l'écran appelle cette route puis ouvre l'adresse reçue.
export async function POST(req: Request) {
  if (denied(req)) return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  const secret = process.env.MAJORDOME_ACCESS_CODE ?? "";
  try {
    return NextResponse.json(await connectBank({ eb, secret, redirectUrl: BANK_REDIRECT_URL }));
  } catch (err) {
    // Message brut de l'API (voulu : Ruben me le renvoie pour diagnostiquer). Il ne contient ni la clé ni le jeton.
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
