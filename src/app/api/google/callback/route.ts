import { NextResponse } from "next/server";
import { exchangeCode, googleEnabled, verifyState } from "@/lib/google";
import { isMissingTable, supabaseAdmin } from "@/lib/supabase";

// Retour de Google après le consentement. Vérifie le state signé, échange le code, garde le refresh token (lecture seule).
export async function GET(req: Request) {
  if (!googleEnabled()) return NextResponse.json({ error: "Connexion Google désactivée" }, { status: 404 });
  const url = new URL(req.url);
  const back = (status: string) => NextResponse.redirect(new URL(`/?google=${status}`, url.origin));

  if (url.searchParams.get("error")) return back("refuse"); // Ruben a cliqué « Annuler » chez Google
  const secret = process.env.MAJORDOME_ACCESS_CODE ?? "";
  if (!secret || !verifyState(url.searchParams.get("state"), secret)) return back("lien-expire");
  const code = url.searchParams.get("code");
  if (!code) return back("erreur");

  try {
    const tokens = await exchangeCode(code);
    if (!tokens.refresh_token) return back("sans-acces-hors-ligne");
    const { error } = await supabaseAdmin().from("google_tokens").insert({ refresh_token: tokens.refresh_token, scope: tokens.scope });
    if (isMissingTable(error)) return back("table-manquante");
    if (error) throw new Error(error.message);
    return back("ok");
  } catch (err) {
    console.error("Connexion Google échouée :", err instanceof Error ? err.message : err); // jamais les jetons dans les logs
    return back("erreur");
  }
}
