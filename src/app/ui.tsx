// Petits éléments d'interface partagés par toutes les sections.

/** Bandeau obligatoire sur tout bloc qui affiche des données fictives. */
export function DemoBanner({ phase, what = "données fictives" }: { phase: number; what?: string }) {
  return (
    <p className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.12em] text-faint">
      <span className="size-1 rounded-full bg-faint" aria-hidden />
      Aperçu — {what} · phase {phase}
    </p>
  );
}

/** Carte arrondie façon app bancaire. Cliquable si onClick est fourni. */
export function Card({ children, onClick, className = "" }: { children: React.ReactNode; onClick?: () => void; className?: string }) {
  const cls = `block w-full rounded-3xl bg-surface p-5 text-left ${onClick ? "transition-transform active:scale-[0.985]" : ""} ${className}`;
  return onClick ? (
    <button onClick={onClick} className={cls}>
      {children}
    </button>
  ) : (
    <div className={cls}>{children}</div>
  );
}

/** En-tête des sections : titre à gauche, avatar (profil, mémoire, réglages) à droite. */
export function Header({ title, subtitle, onAvatar }: { title: string; subtitle?: string; onAvatar: () => void }) {
  return (
    <header className="flex items-start justify-between gap-4 px-1 pb-4 pt-3">
      <div className="min-w-0">
        <h1 className="font-serif text-[32px] font-medium leading-tight tracking-wide">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted first-letter:uppercase">{subtitle}</p>}
      </div>
      <button
        onClick={onAvatar}
        aria-label="Profil, mémoire et réglages"
        className="mt-1 flex size-11 shrink-0 items-center justify-center rounded-full border border-brass/40 bg-raised font-serif text-lg text-brass active:scale-95"
      >
        R
      </button>
    </header>
  );
}

/** Barre de progression fine. */
export function Bar({ value, max, over = false }: { value: number; max: number; over?: boolean }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-raised">
      <div className={`h-full rounded-full ${over ? "bg-[#c4705a]" : "bg-brass"}`} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
    </div>
  );
}

export const euro = (n: number, cents = true) =>
  n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });

/** Salutation selon l'heure à Paris. */
export function greeting(now = new Date()) {
  const h = Number(now.toLocaleString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", hour12: false }));
  return h < 5 ? "Bonne nuit" : h < 12 ? "Bonjour" : h < 18 ? "Bon après-midi" : "Bonsoir";
}

export const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" });
