import { NextResponse } from "next/server";
import { denied } from "@/lib/access";
import { authUrl, googleEnabled, signState } from "@/lib/google";

// Lance la connexion Google (lecture seule). Désactivé tant que GOOGLE_ENABLED n'est pas « true ».
// POST avec le code d'accès en en-tête → renvoie l'URL Google vers laquelle naviguer.
export async function POST(req: Request) {
  if (!googleEnabled()) return NextResponse.json({ error: "Connexion Google désactivée" }, { status: 404 });
  if (denied(req)) return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  const { GOOGLE_CLIENT_ID: id, GOOGLE_REDIRECT_URI: redirect, MAJORDOME_ACCESS_CODE: secret } = process.env;
  if (!id || !redirect || !secret) return NextResponse.json({ error: "GOOGLE_CLIENT_ID ou GOOGLE_REDIRECT_URI manquant" }, { status: 500 });
  return NextResponse.json({ url: authUrl(id, redirect, signState(secret)) });
}
