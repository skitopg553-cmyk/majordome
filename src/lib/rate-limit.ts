// Limite d'essais du code d'accès : MAX_FAILS mauvais codes depuis la même adresse IP, puis LOCK_MS d'attente.
// En MÉMOIRE : chaque instance du serveur (Vercel) a son propre compteur et un redéploiement le remet à zéro.
// shortcut: un attaquant qui tombe sur plusieurs instances obtient quelques essais de plus ; pour un compteur partagé, passer par une table Supabase.
export const MAX_FAILS = 5;
export const LOCK_MS = 10 * 60_000;

type Entry = { fails: number; first: number; lockedUntil: number };

export function createLimiter(max = MAX_FAILS, lockMs = LOCK_MS) {
  const entries = new Map<string, Entry>();
  return {
    /** Vrai si cette adresse est en attente. */
    isLocked(ip: string, now = Date.now()) {
      const e = entries.get(ip);
      return !!e && e.lockedUntil > now;
    },
    /** Note un mauvais code. Au max-ième échec dans la fenêtre, verrouille pour lockMs. */
    fail(ip: string, now = Date.now()) {
      if (entries.size > 1000) for (const [k, v] of entries) if (v.lockedUntil <= now && now - v.first > lockMs) entries.delete(k); // ne grossit pas sans fin
      const e = entries.get(ip);
      const cur: Entry = e && (e.lockedUntil > now || now - e.first <= lockMs) ? e : { fails: 0, first: now, lockedUntil: 0 };
      cur.fails++;
      if (cur.fails >= max) cur.lockedUntil = now + lockMs;
      entries.set(ip, cur);
    },
    /** Bon code : on repart de zéro. */
    clear(ip: string) {
      entries.delete(ip);
    },
    reset() {
      entries.clear();
    },
  };
}
