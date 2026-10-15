import { DEMO_FINANCES as F, DEMO_PHASE } from "@/lib/demo-data";
import { Bar, Card, DemoBanner, euro, Header } from "./ui";

// Coquille FICTIVE (phase 4) : mise en page finale, données de src/lib/demo-data.ts.
export default function FinancesView({ onAvatar }: { onAvatar: () => void }) {
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
          <h2 className="text-sm font-medium text-muted">Dépensé ce mois-ci</h2>
          <p className="text-xs text-faint">sur {euro(F.monthBudget, false)}</p>
        </div>
        <p className="mb-3 mt-1 text-2xl font-semibold tabular-nums">{euro(F.monthSpent)}</p>
        <Bar value={F.monthSpent} max={F.monthBudget} />
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-medium text-muted">Budgets</h2>
        <ul className="space-y-4">
          {F.budgets.map((b) => (
            <li key={b.label}>
              <div className="mb-1.5 flex justify-between text-[15px]">
                <span>{b.label}</span>
                <span className={`tabular-nums ${b.spent > b.limit ? "text-neg" : "text-muted"}`}>
                  {euro(b.spent, false)} <span className="text-faint">/ {euro(b.limit, false)}</span>
                </span>
              </div>
              <Bar value={b.spent} max={b.limit} over={b.spent > b.limit} />
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        {F.goals.map((g) => (
          <Card key={g.label} className="p-4">
            <p className="text-xs text-muted">Objectif · {g.due}</p>
            <p className="mt-1 text-[15px] font-medium leading-snug">{g.label}</p>
            <p className="mb-2 mt-2 text-lg font-semibold tabular-nums">
              {euro(g.saved, false)} <span className="text-xs font-normal text-faint">/ {euro(g.target, false)}</span>
            </p>
            <Bar value={g.saved} max={g.target} />
          </Card>
        ))}
      </div>

      <Card>
        <h2 className="mb-1 text-sm font-medium text-muted">Dernières opérations</h2>
        <ul className="divide-y divide-line/60">
          {F.transactions.map((t) => (
            <li key={t.label + t.when} className="flex items-center gap-3 py-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-raised text-accent">{t.label[0]}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px]">{t.label}</span>
                <span className="block text-xs text-faint">
                  {t.category} · {t.when}
                </span>
              </span>
              <span className={`tabular-nums ${t.amount > 0 ? "text-pos" : ""}`}>
                {t.amount > 0 ? "+" : ""}
                {euro(t.amount)}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
