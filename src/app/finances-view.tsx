"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEMO_FINANCES as F, DEMO_PHASE } from "@/lib/demo-data";
import { goalProgress, monthTotals, spendingByCategory, unusualExpenses, type Budget, type Tx } from "@/lib/finance/stats";
import { Bar, Card, DemoBanner, euro, Header, Label } from "./ui";

type Goal = { id?: number; label: string; target: number; saved: number; due_label?: string | null; image_url: string | null };
type Data = { ready: false } | { ready: true; transactions: Tx[]; budgets: Budget[]; goals: Goal[] };
type Row = { category: string; spent: number; limit: number | null; over: boolean };

const ym = (d = new Date()) => d.toLocaleDateString("en-CA", { timeZone: "Europe/Paris" }).slice(0, 7);
const shortDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "UTC", day: "numeric", month: "short" });

/** Les banques françaises exportent souvent en Windows-1252 : on essaie UTF-8, sinon on bascule. */
async function readCsv(file: File) {
  const buf = await file.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder("windows-1252").decode(buf);
  }
}

function BudgetList({ rows }: { rows: Row[] }) {
  return (
    <ul className="space-y-4">
      {rows.map((b) => (
        <li key={b.category}>
          <div className="mb-1.5 flex justify-between gap-3 text-[15px]">
            <span className="truncate">{b.category}</span>
            <span className="shrink-0 tabular-nums text-muted">
              {euro(b.spent, false)}
              {b.limit !== null && <span className="text-faint"> / {euro(b.limit, false)}</span>}
            </span>
          </div>
          {b.limit !== null && <Bar value={b.spent} max={b.limit} over={b.over} />}
          {b.over && <p className="mt-1 text-[12px] text-faint">Au-dessus du budget de {euro(b.spent - b.limit!, false)}</p>}
        </li>
      ))}
    </ul>
  );
}

function GoalCard({ g }: { g: Goal }) {
  const pct = goalProgress(g.saved, g.target);
  return (
    <div className="relative h-40 overflow-hidden rounded-[22px] bg-surface">
      {g.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={g.image_url} alt="" className="absolute inset-0 size-full object-cover brightness-[0.7]" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/60 to-transparent" />
      <div className="absolute inset-x-4 bottom-4">
        <p className="text-[12px] font-medium text-fg/75">Objectif{g.due_label ? ` · ${g.due_label}` : ""}</p>
        <p className="truncate text-[17px] font-semibold tracking-tight">{g.label}</p>
        <p className="mt-0.5 text-[13px] tabular-nums text-fg/75">
          {euro(g.saved, false)} / {euro(g.target, false)} · {pct} %
        </p>
        <div className="mt-2">
          <Bar value={g.saved} max={g.target} />
        </div>
      </div>
    </div>
  );
}

function TxList({ items }: { items: { key: string; label: string; sub: string; amount: number }[] }) {
  return (
    <ul className="divide-y divide-line/60">
      {items.map((t) => (
        <li key={t.key} className="flex items-center gap-3 py-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-raised text-[15px] font-medium text-fg">{t.label[0]?.toUpperCase()}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px]">{t.label}</span>
            <span className="block text-xs text-faint">{t.sub}</span>
          </span>
          <span className={`shrink-0 tabular-nums ${t.amount > 0 ? "text-pos" : ""}`}>
            {t.amount > 0 ? "+" : ""}
            {euro(t.amount)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function FinancesView({ accessCode, onUnauthorized, onAvatar }: { accessCode: string; onUnauthorized: () => void; onAvatar: () => void }) {
  const [data, setData] = useState<Data | null>(null);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    fetch("/api/finances", { headers: { "x-access-code": accessCode } })
      .then(async (r) => {
        if (r.status === 401) return onUnauthorized();
        // Toute erreur (base indisponible…) → aperçu fictif plutôt qu'un écran cassé.
        setData(r.ok ? await r.json() : { ready: false });
      })
      .catch(() => setData({ ready: false }));
  }, [accessCode, onUnauthorized]);

  useEffect(load, [load]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setImporting(true);
    setNotice(null);
    try {
      const res = await fetch("/api/finances/import", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-access-code": accessCode },
        body: JSON.stringify({ csv: await readCsv(file) }),
      });
      if (res.status === 401) return onUnauthorized();
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? `Erreur serveur (${res.status})`);
      const parts = [`${d.imported} opération${d.imported > 1 ? "s" : ""} ajoutée${d.imported > 1 ? "s" : ""}`];
      if (d.duplicates) parts.push(`${d.duplicates} déjà présente${d.duplicates > 1 ? "s" : ""}`);
      if (d.skipped) parts.push(`${d.skipped} ligne${d.skipped > 1 ? "s" : ""} ignorée${d.skipped > 1 ? "s" : ""}`);
      setNotice({ ok: true, text: parts.join(" · ") });
      load();
    } catch (e) {
      setNotice({ ok: false, text: e instanceof Error ? e.message : "Import impossible" });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const importButton = (
    <>
      <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={importing}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-surface text-[14px] font-medium text-fg ring-1 ring-line transition-opacity active:scale-[0.99] disabled:opacity-50"
      >
        <svg viewBox="0 0 24 24" className="size-[18px] text-accent" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
        </svg>
        {importing ? "Import en cours…" : "Importer un relevé (CSV)"}
      </button>
      {notice && <p className={`px-1 text-[13px] ${notice.ok ? "text-muted" : "text-neg"}`}>{notice.text}</p>}
    </>
  );

  // Chargement : squelette discret (rien qui saute à l'arrivée des données).
  if (!data) {
    return (
      <div className="space-y-3 px-4 pb-6">
        <Header title="Finances" onAvatar={onAvatar} />
        {[120, 160, 200].map((h) => (
          <div key={h} className="animate-pulse rounded-[22px] bg-surface" style={{ height: h }} />
        ))}
      </div>
    );
  }

  /* ---------- Données réelles ---------- */
  if (data.ready) {
    const month = ym();
    const totals = monthTotals(data.transactions, month);
    const rows = spendingByCategory(data.transactions, month, data.budgets);
    const unusual = unusualExpenses(data.transactions, month).slice(0, 3);
    const recent = data.transactions.slice(0, 8);
    return (
      <div className="space-y-3 px-4 pb-6">
        <Header title="Finances" onAvatar={onAvatar} />
        {data.transactions.length === 0 ? (
          <Card>
            <p className="text-[17px] font-semibold tracking-tight">Commence par un relevé</p>
            <p className="mt-1 text-[14px] leading-snug text-muted">
              Télécharge le relevé de ton compte au format CSV depuis l&apos;appli ou le site de ta banque, puis importe-le ici. Majordome range tout seul chaque dépense.
            </p>
          </Card>
        ) : (
          <>
            <Card>
              <Label>Ce mois-ci</Label>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[12px] text-muted">Dépensé</p>
                  <p className="text-[24px] font-semibold tabular-nums tracking-tight">{euro(totals.spent, false)}</p>
                </div>
                <div>
                  <p className="text-[12px] text-muted">Reçu</p>
                  <p className="text-[24px] font-semibold tabular-nums tracking-tight text-pos">{euro(totals.income, false)}</p>
                </div>
              </div>
            </Card>
            {rows.length > 0 && (
              <Card>
                <div className="mb-3">
                  <Label>Par catégorie</Label>
                </div>
                <BudgetList rows={rows} />
              </Card>
            )}
            {unusual.length > 0 && (
              <Card>
                <Label>Plus élevé que d&apos;habitude</Label>
                <TxList items={unusual.map((t) => ({ key: String(t.id), label: t.label, sub: `${t.category} · ${shortDate(t.date)}`, amount: t.amount }))} />
              </Card>
            )}
          </>
        )}
        {data.goals.length > 0 && data.goals.map((g) => <GoalCard key={g.id} g={g} />)}
        {importButton}
        {recent.length > 0 && (
          <Card>
            <Label>Dernières opérations</Label>
            <TxList items={recent.map((t) => ({ key: String(t.id), label: t.label, sub: `${t.category} · ${shortDate(t.date)}`, amount: t.amount }))} />
          </Card>
        )}
      </div>
    );
  }

  /* ---------- Aperçu FICTIF (phase 4 : tables pas encore créées) ---------- */
  const [int, dec] = euro(F.balance).split(",");
  return (
    <div className="space-y-3 px-4 pb-6">
      <Header title="Finances" onAvatar={onAvatar} />
      <div className="px-1">
        <DemoBanner phase={DEMO_PHASE.finances} />
      </div>

      {/* Solde en grand, façon app bancaire */}
      <div className="px-1 pb-3 pt-4 text-center">
        <p className="text-sm text-muted">Solde total</p>
        <p className="mt-1 text-[44px] font-semibold leading-none tracking-tight tabular-nums">
          {int}
          <span className="text-2xl text-muted">,{dec}</span>
        </p>
      </div>

      <Card>
        <div className="flex items-baseline justify-between">
          <Label>Dépensé ce mois-ci</Label>
          <p className="text-xs text-faint">sur {euro(F.monthBudget, false)}</p>
        </div>
        <p className="mb-3 mt-1 text-2xl font-semibold tabular-nums">{euro(F.monthSpent)}</p>
        <Bar value={F.monthSpent} max={F.monthBudget} />
      </Card>

      <Card>
        <div className="mb-3">
          <Label>Budgets</Label>
        </div>
        <BudgetList rows={F.budgets.map((b) => ({ category: b.label, spent: b.spent, limit: b.limit, over: b.spent > b.limit }))} />
      </Card>

      {F.goals.map((g) => (
        <GoalCard key={g.label} g={{ label: g.label, target: g.target, saved: g.saved, due_label: g.due, image_url: g.image_url }} />
      ))}

      {importButton}

      <Card>
        <Label>Dernières opérations</Label>
        <TxList items={F.transactions.map((t) => ({ key: t.label + t.when, label: t.label, sub: `${t.category} · ${t.when}`, amount: t.amount }))} />
      </Card>
    </div>
  );
}
