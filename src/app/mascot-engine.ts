// Moteur de la mascotte : UN état partagé (regard, humeur, état vocal) pour tous les yeux de l'app, animé par une seule boucle requestAnimationFrame.
// 100 % code, aucun appel IA. Les yeux (majordome.tsx) s'abonnent aux images (`subscribeFrame`) et modifient directement leur style :
// pas de re-rendu React 60 fois par seconde. Le petit état « lent » (humeur, voix) passe par useSyncExternalStore.
import type { OrbState } from "@/lib/voice";
import { blend, EMO, stepParams, type AiMood, type EmoParams, type Mood } from "@/lib/mascot";

export type Frame = { p: EmoParams; gx: number; gy: number; bounce: number }; // gx, gy ∈ [-1, 1] ; bounce en fraction de S (vers le haut)
type Listener = () => void;

const SLEEP_AFTER_MS = 60_000;
const AI_MOOD_MS = 5_000;

let started = false;
let raf = 0;
let last = 0;
const frameSubs = new Set<(f: Frame) => void>();
const stateSubs = new Set<Listener>();

// --- état « lent » (lu par React) ---
let shown: Mood = "neutral";
let voice: OrbState = "idle";
// --- état interne ---
let override: { mood: Mood; until: number } | null = null;
let voiceSince = 0;
let lastTouch = 0;
let pointer: { x: number; y: number; at: number } | null = null;
let focusTarget: { x: number; y: number } | null = null;
let drift = { x: 0, y: 0, next: 0 };
let cur: EmoParams = EMO.neutral;
let gx = 0;
let gy = 0;
let bounce = 0;
let lastPulse = 0;
let blink: { start: number; double: boolean; doneFirst: boolean } | null = null;
let nextBlink = 0;

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const clamp = (v: number) => Math.max(-1, Math.min(1, v));
const emitState = () => stateSubs.forEach((l) => l());
const setShown = (m: Mood) => {
  if (m !== shown) {
    shown = m;
    emitState();
  }
};

function wake(now: number) {
  const wasAsleep = now - lastTouch > SLEEP_AFTER_MS && voice === "idle";
  lastTouch = now;
  if (wasAsleep) mascotApi.react("surprised", 450); // il se réveille en sursautant
}

function baseMood(now: number): Mood {
  if (voice === "listening") return now - voiceSince < 300 ? "surprised" : "focus";
  if (voice === "thinking") return "focus";
  if (voice === "speaking") return "happy";
  return now - lastTouch > SLEEP_AFTER_MS ? "sleepy" : "neutral";
}

function tick(t: number) {
  const dt = Math.min(50, t - (last || t));
  last = t;
  const now = performance.now();
  if (override && now > override.until) override = null;
  const mood = override?.mood ?? baseMood(now);
  setShown(mood);

  // Clignement : toutes les 2,5 à 6 s, parfois double. Le temps est aussi celui de la boucle (pas de timer séparé).
  if (!nextBlink) nextBlink = now + 2500 + Math.random() * 3500;
  if (!blink && now >= nextBlink && mood !== "sleepy") blink = { start: now, double: Math.random() < 0.2, doneFirst: false };
  let blinkAmount = 0;
  if (blink) {
    const k = (now - blink.start) / 150; // un clignement dure 150 ms
    if (k >= 1) {
      if (blink.double && !blink.doneFirst) blink = { start: now + 80, double: true, doneFirst: true };
      else {
        blink = null;
        nextBlink = now + 2500 + Math.random() * 3500;
      }
    } else if (k >= 0) blinkAmount = 1 - Math.abs(2 * k - 1); // fermeture puis ouverture
  }

  cur = stepParams(cur, EMO[mood], dt);
  const p = blinkAmount ? blend(cur, EMO.blink, blinkAmount) : cur;

  // Regard : la cible est le doigt / la souris, sinon l'élément qui a le focus, sinon une lente dérive. Lissé, jamais saccadé.
  let tx = 0;
  let ty = 0;
  if (!reduced()) {
    if (voice === "listening") ty = -0.45;
    else if (voice === "thinking") tx = Math.sin(now / 700) * 0.65;
    else if (pointer && now - pointer.at < 3000) {
      tx = pointer.x;
      ty = pointer.y;
    } else if (focusTarget) {
      tx = focusTarget.x;
      ty = focusTarget.y;
    } else if (mood !== "sleepy") {
      if (now > drift.next) drift = { x: (Math.random() - 0.5) * 0.7, y: (Math.random() - 0.5) * 0.5, next: now + 1500 + Math.random() * 2000 };
      tx = drift.x;
      ty = drift.y;
    }
  }
  const k = 1 - Math.exp(-dt / 120);
  gx += (tx - gx) * k;
  gy += (ty - gy) * k;

  // Rebond de la parole : une impulsion à chaque mot (événement « boundary » de la synthèse vocale), sinon une cadence de secours.
  if (voice === "speaking" && now - lastPulse > 420) mascotApi.pulse();
  bounce *= Math.exp(-dt / 110);

  const f: Frame = { p, gx, gy, bounce: reduced() ? 0 : bounce };
  frameSubs.forEach((s) => s(f));
  raf = frameSubs.size ? requestAnimationFrame(tick) : 0;
}

function onPointer(e: PointerEvent) {
  const now = performance.now();
  wake(now);
  pointer = { x: clamp((e.clientX / window.innerWidth) * 2 - 1), y: clamp((e.clientY / window.innerHeight) * 2 - 1), at: now };
}
function onFocusIn(e: FocusEvent) {
  wake(performance.now());
  const el = e.target as HTMLElement | null;
  if (!el?.getBoundingClientRect) return;
  const r = el.getBoundingClientRect();
  focusTarget = { x: clamp(((r.left + r.width / 2) / window.innerWidth) * 2 - 1), y: clamp(((r.top + r.height / 2) / window.innerHeight) * 2 - 1) };
}
const onFocusOut = () => (focusTarget = null);
const onActivity = () => wake(performance.now());

export const mascotApi = {
  /** Démarre l'écoute des gestes (une seule fois, appelé par le layout racine). */
  start() {
    if (started || typeof window === "undefined") return;
    started = true;
    lastTouch = performance.now();
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("pointerdown", onPointer, { passive: true });
    window.addEventListener("keydown", onActivity, { passive: true });
    window.addEventListener("scroll", onActivity, { passive: true, capture: true });
    window.addEventListener("focusin", onFocusIn);
    window.addEventListener("focusout", onFocusOut);
  },
  /** État vocal : repos, écoute, réflexion, parole. */
  setVoice(v: OrbState) {
    if (v === voice) return;
    voice = v;
    voiceSince = performance.now();
    if (v !== "idle") lastTouch = voiceSince;
    emitState();
  },
  /** Humeur passagère (une réaction du code : tâche cochée, erreur réseau…) : revient seule à l'état normal. */
  react(mood: Mood, ms: number) {
    override = { mood, until: performance.now() + ms };
  },
  /** Humeur demandée par l'IA dans sa réponse : visible 5 s puis retour doux au neutre. */
  setAiMood(mood: AiMood) {
    if (mood !== "neutral") override = { mood, until: performance.now() + AI_MOOD_MS };
  },
  /** Petit rebond de la parole (un mot prononcé). */
  pulse() {
    lastPulse = performance.now();
    bounce = 0.06;
  },
  subscribeFrame(cb: (f: Frame) => void) {
    frameSubs.add(cb);
    if (!raf && typeof window !== "undefined") {
      last = 0;
      raf = requestAnimationFrame(tick);
    }
    return () => {
      frameSubs.delete(cb);
    };
  },
  subscribeState(l: Listener) {
    stateSubs.add(l);
    return () => {
      stateSubs.delete(l);
    };
  },
  getMood: () => shown,
  getVoice: () => voice,
};
