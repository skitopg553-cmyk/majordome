"use client";

import { callApi } from "./api-client";
import { useState } from "react";
import { EXPIRY_WARNING_DAYS } from "@/lib/bank-config";
import { daysLeft } from "@/lib/finance/bank";
import { Card, euro, Label } from "./ui";

export type BankInfo = { ready: false } | { ready: true; connection: { bankName: string; balance: number | null; syncedAt: string | null; validUntil: string | null } | null };

/** « il y a 5 min », « il y a 2 h », « il y a 3 j » : suffisant pour savoir si le solde est frais. */
export function ago(iso: string | null, now = new Date()) {
  const t = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(t)) return "jamais";
  const min = Math.max(0, Math.round((now.getTime() - t) / 60_000));
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  if (min < 1440) return `il y a ${Math.round(min / 60)} h`;
  return `il y a ${Math.round(min / 1440)} j`;
}

/** Message d'expiration (null si tout va bien) : prévient 14 jours avant, puis dit clairement que c'est fini. */
export function expiryMessage(validUntil: string | null, now = new Date()) {
  const d = daysLeft(validUntil, now);
  if (d === null || d > EXPIRY_WARNING_DAYS) return null;
  if (d <= 0) return "Ton accord de lecture a expiré : reconnecte ta banque pour continuer à voir tes opérations.";
  return `Ton accord de lecture se termine dans ${d} jour${d > 1 ? "s" : ""}. Reconnecte ta banque avant pour ne rien perdre.`;
}

/** Connexion bancaire (Revolut, lecture seule) : « Connecter », « Actualiser », vrai solde, avertissement d'expiration. */
export default function BankCard({ bank, accessCode, onUnauthorized, onChanged, incoming }: { bank: BankInfo | undefined; accessCode: string; onUnauthorized: () => void; onChanged: () => void; incoming: { ok: boolean; text: string } | null }) {
  const [busy, setBusy] = useState<"connect" | "sync" | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(incoming);

  async function call(path: string, kind: "connect" | "sync") {
    setBusy(kind);
    setNotice(null);
    try {
      const d = await callApi<{ url?: string; imported?: number }>(accessCode, path, { method: "POST", onUnauthorized }); // message d'erreur brut du serveur : voulu
      if (kind === "connect") return void window.location.assign(d.url ?? "/");
      setNotice({ ok: true, text: d.imported ? `${d.imported} nouvelle${d.imported > 1 ? "s" : ""} opération${d.imported > 1 ? "s" : ""}` : "Déjà à jour" });
      onChanged();
    } catch (e) {
      setNotice({ ok: false, text: e instanceof Error ? e.message : "Erreur inconnue" });
    } finally {
      setBusy(null);
    }
  }

  const note = notice && <p className={`mt-3 break-words text-[13px] ${notice.ok ? "text-muted" : "text-neg"}`}>{notice.text}</p>;
  const btn = "min-h-11 rounded-full px-5 text-[14px] font-semibold active:scale-95 disabled:opacity-50";

  if (!bank || !bank.ready) {
    return (
      <Card>
        <Label>Ta banque</Label>
        <p className="mt-1 text-[14px] leading-snug text-muted">La connexion bancaire n&apos;est pas encore activée sur la base de données.</p>
        {note}
      </Card>
    );
  }

  const c = bank.connection;
  if (!c) {
    return (
      <Card>
        <Label>Ta banque</Label>
        <p className="mt-1 text-[17px] font-semibold tracking-tight">Connecte ton Revolut</p>
        <p className="mt-0.5 text-[14px] leading-snug text-muted">Lecture seule : Majordome voit ton solde et tes opérations, il ne peut rien payer ni virer.</p>
        <button onClick={() => call("/api/bank/connect", "connect")} disabled={!!busy} className={`${btn} mt-3 bg-accent text-ink`}>
          {busy === "connect" ? "Ouverture…" : "Connecter ma banque"}
        </button>
        {note}
      </Card>
    );
  }

  const warn = expiryMessage(c.validUntil);
  return (
    <Card>
      <div className="flex items-baseline justify-between gap-3">
        <Label>Solde {c.bankName}</Label>
        <span className="text-[12px] text-faint">{ago(c.syncedAt)}</span>
      </div>
      <p className="mt-1 text-[34px] font-semibold leading-none tracking-tight tabular-nums">{c.balance !== null ? euro(c.balance) : "—"}</p>
      {c.balance === null && <p className="mt-1 text-[13px] text-muted">Touche « Actualiser » pour lire ton solde.</p>}
      {warn && <p className="mt-3 rounded-2xl bg-raised px-3 py-2.5 text-[13px] leading-snug text-fg/90">{warn}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => call("/api/bank/sync", "sync")} disabled={!!busy} className={`${btn} bg-accent text-ink`}>
          {busy === "sync" ? "Actualisation…" : "Actualiser"}
        </button>
        {warn && (
          <button onClick={() => call("/api/bank/connect", "connect")} disabled={!!busy} className={`${btn} bg-raised text-fg ring-1 ring-line`}>
            Reconnecter
          </button>
        )}
      </div>
      {note}
    </Card>
  );
}
