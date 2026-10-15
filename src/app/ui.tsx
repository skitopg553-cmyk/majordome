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
  const cls = `block w-full rounded-[22px] bg-surface p-4 text-left ${onClick ? "transition-transform active:scale-[0.985]" : ""} ${className}`;
  return onClick ? (
    <button onClick={onClick} className={cls}>
      {children}
    </button>
  ) : (
    <div className={cls}>{children}</div>
  );
}

/** Signature : « majordome. » avec le point final lumineux. */
export function Wordmark({ className = "text-lg" }: { className?: string }) {
  return (
    <span className={`inline-flex items-baseline font-semibold tracking-tight ${className}`}>
      majordome
      <span className="glow ml-[0.08em] inline-block size-[0.24em] rounded-full bg-accent" aria-hidden />
    </span>
  );
}

/** Avatar : ouvre Mémoire & objectifs + Réglages. */
export function Avatar({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Profil, mémoire et réglages"
      className="flex size-11 shrink-0 items-center justify-center rounded-full bg-raised text-[15px] font-medium text-fg ring-1 ring-line active:scale-95"
    >
      R
    </button>
  );
}

/** En-tête des sections : titre à gauche, avatar à droite. */
export function Header({ title, subtitle, onAvatar }: { title: string; subtitle?: string; onAvatar: () => void }) {
  return (
    <header className="flex items-start justify-between gap-4 px-1 pb-4 pt-3">
      <div className="min-w-0">
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted first-letter:uppercase">{subtitle}</p>}
      </div>
      <Avatar onClick={onAvatar} />
    </header>
  );
}

/** Petit libellé de carte (« Prochain rendez-vous », « Solde »…). */
export function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-[13px] font-medium text-muted">{children}</p>;
}

/** Barre de progression fine. */
export function Bar({ value, max, over = false }: { value: number; max: number; over?: boolean }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-raised">
      <div className={`h-full rounded-full ${over ? "bg-neg" : "bg-accent"}`} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
    </div>
  );
}

export const euro = (n: number, cents = true) =>
  n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });

/** Salutation selon l'heure à Paris. */
export function greeting(now = new Date()) {
  // On lit la partie « hour » seule : en fr-FR le texte complet vaut « 00 h » (Number() → NaN).
  const h = Number(
    new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "numeric", hourCycle: "h23" }).formatToParts(now).find((p) => p.type === "hour")?.value,
  );
  return h < 5 ? "Bonne nuit" : h < 12 ? "Bonjour" : h < 18 ? "Bon après-midi" : "Bonsoir";
}

export const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" });
