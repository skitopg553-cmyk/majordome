// Mise en page des pages publiques (confidentialité, conditions) : composant serveur, aucun JavaScript côté navigateur.
// Ces pages n'ont PAS de code d'accès : il ne protège que l'app et /api (voir src/lib/access.ts).

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-5 pb-16 pt-10 text-[16px] leading-relaxed text-fg/90">
      <p className="inline-flex items-baseline font-semibold tracking-tight text-lg text-fg">
        majordome
        <span className="glow ml-[0.08em] inline-block size-[0.24em] rounded-full bg-accent" aria-hidden />
      </p>
      <h1 className="mt-8 text-[30px] font-semibold leading-tight tracking-tight text-fg">{title}</h1>
      <p className="mt-1 text-sm text-muted">Dernière mise à jour : {updated}</p>
      <div className="mt-8 space-y-4">{children}</div>
    </main>
  );
}

export const H2 = ({ children }: { children: React.ReactNode }) => <h2 className="pt-4 text-[19px] font-semibold tracking-tight text-fg">{children}</h2>;

export const Ul = ({ children }: { children: React.ReactNode }) => <ul className="list-disc space-y-1.5 pl-5 marker:text-accent">{children}</ul>;

export const Mail = () => (
  <a href="mailto:ski.topg553@gmail.com" className="text-accent underline underline-offset-2">
    ski.topg553@gmail.com
  </a>
);
