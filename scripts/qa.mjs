// Parcours « comme un utilisateur » (Playwright) en 390×844 et 360×800, avec des données de test réalistes (API simulée dans le navigateur : AUCUNE base, aucune clé IA).
// Prérequis : `npm run dev` (port 3000, ou passer l'adresse en argument). Usage : npm run qa
// Sortie : captures dans captures/qa/ + une liste de contrôles automatiques (débordement horizontal, zones < 44 px, contraste, erreurs de console).
import fs from "node:fs";
import { chromium } from "playwright";

const url = process.argv[2] ?? "http://localhost:3000";
const OUT = "captures/qa";
fs.mkdirSync(OUT, { recursive: true });
const NOW = new Date("2026-10-19T19:30:00Z"); // lundi 19/10/2026, 21 h 30 à Paris : la salle (18 h-20 h) vient de finir
const iso = (h, m = 0, d = "2026-10-19") => new Date(`${d}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+02:00`).toISOString();
const LONG = "Rendez-vous avec le directeur régional du développement commercial pour la revue trimestrielle des objectifs de partenariat";

const rule = (id, title, days, at, end, habit = 0) => ({ id, title, kind: "weekly", weekday: Number(days[0]), month_day: null, at_time: at, end_time: end, days, habit, last_generated: null, created_at: "2026-10-01T08:00:00Z" });
const fullData = () => ({
  tasks: [
    { id: 1, title: "Ranger ma chambre", due_at: null, priority: 2, notes: null, status: "todo" },
    { id: 2, title: "Sortir les poubelles", due_at: iso(0), priority: 1, notes: null, status: "todo" },
    { id: 3, title: "Penser à écrire à la mairie pour la demande d'autorisation de travaux de la maison de campagne", due_at: null, priority: 3, notes: null, status: "todo" },
    { id: 4, title: "Dîner avec Arthur", due_at: iso(20), end_at: iso(22), priority: 2, notes: null, status: "todo" },
    { id: 5, title: LONG, due_at: iso(14), end_at: iso(15, 30), priority: 2, notes: null, status: "todo" },
    { id: 6, title: "Appeler le médecin", due_at: iso(11, 30), priority: 2, notes: null, status: "todo" },
  ],
  rules: [rule(1, "Travail", "1,2,3,4,5", "09:00", "17:00"), rule(2, "Salle de muscu", "1,3,5", "18:00", "20:00", 1), rule(3, "Boxe anglaise", "2", "18:30", "20:00", 1), rule(4, "Méditation", "1,2,3,4,5,6,7", "07:00", "07:20", 1), rule(5, "Réunion hebdomadaire de coordination avec l'équipe produit et design", "4", "10:00", "10:45")],
  exceptions: [{ rule_id: 1, day: "2026-10-21", action: "skip", new_day: null, new_start: null, new_end: null }],
  logs: [],
});

const findings = [];
const note = (vp, screen, kind, text) => findings.push({ vp, screen, kind, text });

async function audit(page, vp, screen, errors) {
  const r = await page.evaluate(() => {
    const visible = (el) => {
      const b = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return b.width > 0 && b.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && b.bottom > 0 && b.top < innerHeight && cs.opacity !== "0";
    };
    const label = (el) => (el.getAttribute("aria-label") || el.textContent || el.getAttribute("placeholder") || el.tagName).trim().replace(/\s+/g, " ").slice(0, 40);
    const small = [...document.querySelectorAll("button, a[href], input:not([type=hidden]), select, textarea, [role=button]")]
      .filter(visible)
      .map((el) => ({ el, b: el.getBoundingClientRect() }))
      .filter(({ el, b }) => (b.height < 43.5 || b.width < 43.5) && el.getAttribute("aria-label") !== "Écrire à Majordome") // ce bouton mesure 32 px mais sa zone tactile est étendue à 44 px (before:-inset-1.5)
      .map(({ el, b }) => `${el.tagName.toLowerCase()} « ${label(el)} » ${Math.round(b.width)}×${Math.round(b.height)}`);
    const cv = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    cv.canvas.width = cv.canvas.height = 1;
    const rgb = (col, under) => { cv.clearRect(0, 0, 1, 1); if (under) { cv.fillStyle = under; cv.fillRect(0, 0, 1, 1); } cv.fillStyle = col; cv.fillRect(0, 0, 1, 1); const d = cv.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2]]; };
    const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor; const px = rgb(c); cv.clearRect(0, 0, 1, 1); cv.fillStyle = c; cv.fillRect(0, 0, 1, 1); if (cv.getImageData(0, 0, 1, 1).data[3] > 200) return c; } return "#050506"; };
    const low = new Map();
    for (const el of document.querySelectorAll("p, span, button, a, h1, h2, h3, li, label, dt, dd, time")) {
      if (!visible(el) || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
      const cs = getComputedStyle(el);
      const bg = bgOf(el);
      const fg = rgb(cs.color, bg);
      const base = rgb(bg);
      const L1 = lum(fg), L2 = lum(base);
      const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      const px = parseFloat(cs.fontSize), big = px >= 24 || (px >= 18.66 && Number(cs.fontWeight) >= 700);
      if (ratio < (big ? 3 : 4.5)) low.set(label(el), `${ratio.toFixed(1)}:1 « ${label(el)} » ${Math.round(px)} px`);
    }
    const cut = [...document.querySelectorAll("p, span, h1, h2, li, button")].filter(visible).filter((el) => el.scrollWidth > el.clientWidth + 1 && !/truncate|overflow-hidden|text-ellipsis/.test(el.className) === false ? false : false);
    return { overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth, small: [...new Set(small)].slice(0, 14), low: [...low.values()].slice(0, 8), cut: cut.length };
  });
  if (r.overflowX > 1) note(vp, screen, "débordement horizontal", `${r.overflowX} px`);
  for (const s of r.small) note(vp, screen, "zone < 44 px", s);
  for (const s of r.low) note(vp, screen, "contraste faible", s);
  for (const e of errors.splice(0)) note(vp, screen, "console", e);
}

async function newPage(browser, vp, data, opts = {}) {
  const ctx = await browser.newContext({ viewport: vp, timezoneId: "Europe/Paris", locale: "fr-FR", deviceScaleFactor: 2, reducedMotion: opts.reduced ? "reduce" : "no-preference" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && !/favicon|Failed to load resource/.test(m.text()) && errors.push(m.text().slice(0, 160)));
  page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 160)));
  await page.clock.setFixedTime(NOW);
  const calls = [];
  await page.route("**/api/**", async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname;
    const m = req.method();
    const body = m === "GET" || m === "DELETE" ? null : req.postDataJSON?.() ?? null;
    calls.push(`${m} ${p}`);
    if (opts.delay) await new Promise((r) => setTimeout(r, opts.delay));
    const json = (b) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });
    if (p === "/api/tasks") return json(m === "GET" ? { tasks: data.tasks } : { ok: true });
    if (p === "/api/slots") {
      if (m === "POST" && body?.action === "habit") data.logs.push({ rule_id: body.rule_id, day: body.day, status: body.status });
      return json(m === "GET" ? { ready: true, rules: data.rules, exceptions: data.exceptions, logs: data.logs } : { ok: true });
    }
    if (p.startsWith("/api/google/")) return json({ state: "off", events: [] });
    if (p === "/api/messages") return json({ messages: [] });
    if (p === "/api/chat") return route.fulfill({ status: 200, contentType: "text/plain", body: "OK\n\nNoté :\n- Travail lundi-vendredi 9 h-17 h\n- Salle de muscu lundi, mercredi, vendredi 18 h-20 h (habitude à confirmer)\n- Dîner avec Arthur lundi 19 octobre 20 h, une seule fois" });
    if (p === "/api/forme") return json({ ready: true, sleeps: [], workouts: [], steps: [], screen: [] });
    if (p === "/api/finances") return json({ ready: true, transactions: [], budgets: [], goals: [], bank: { ready: false }, snapshot: null });
    return json({});
  });
  await page.goto(url);
  await page.evaluate(() => localStorage.setItem("majordome-access-code", "test-local"));
  return { page, ctx, errors, calls };
}

const browser = await chromium.launch();
const VIEWPORTS = [{ name: "390x844", width: 390, height: 844 }, { name: "360x800", width: 360, height: 800 }];

for (const vp of VIEWPORTS) {
  const shot = async (page, n, name, errors) => {
    await page.screenshot({ path: `${OUT}/${vp.name}-${String(n).padStart(2, "0")}-${name}.png` });
    await audit(page, vp.name, name, errors);
  };
  const next = async (page, k = 1) => { for (let i = 0; i < k; i++) { await page.getByLabel("Jour suivant").click(); await page.waitForTimeout(450); } };

  // 1. Chargement (API lente) : l'écran de chargement, puis l'Accueil
  {
    const { page, ctx, errors } = await newPage(browser, vp, fullData(), { delay: 1200 });
    await page.reload();
    await page.waitForTimeout(500);
    await shot(page, 1, "chargement", errors);
    await page.waitForSelector("nav", { timeout: 8000 }).catch(() => {});
    await page.getByText("Ranger ma chambre").waitFor({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(500);
    await shot(page, 2, "accueil-habitudes", errors);

    // 2. Habitudes : Oui (célébration), Non (reprogrammer)
    await page.getByRole("button", { name: "Oui", exact: true }).first().click();
    await page.waitForTimeout(450);
    await shot(page, 3, "celebration-450ms", errors);
    await page.waitForTimeout(900);
    await shot(page, 4, "celebration-fin", errors);
    const non = page.getByRole("button", { name: "Non", exact: true }).first();
    if (await non.count()) {
      await non.click();
      await page.waitForTimeout(400);
      await shot(page, 5, "habitude-non-reprogrammer", errors);
      await page.getByRole("button", { name: "Laisser tomber" }).click().catch(() => {});
    }
    await page.evaluate(() => document.querySelector(".min-h-0.flex-1.overflow-y-auto")?.scrollTo(0, 99999));
    await page.waitForTimeout(300);
    await shot(page, 6, "accueil-bas", errors);

    // 3. Planning : aujourd'hui, mardi, samedi (vide), lundi suivant, jeudi (titre long), fiches
    await page.locator("nav button", { hasText: "Planning" }).click();
    await page.waitForTimeout(700);
    await shot(page, 7, "planning-lundi", errors);
    await page.getByText("Travail").first().click();
    await page.waitForTimeout(500);
    await shot(page, 8, "fiche-creneau", errors);
    await page.getByRole("button", { name: "Fermer", exact: true }).click();
    await page.getByText("Rendez-vous avec le directeur").first().click();
    await page.waitForTimeout(500);
    await shot(page, 9, "fiche-tache-titre-long", errors);
    await page.getByRole("button", { name: "Fermer", exact: true }).click();
    await next(page);
    await shot(page, 10, "planning-mardi", errors);
    await next(page);
    await shot(page, 11, "planning-mercredi-travail-supprime", errors);
    await next(page);
    await shot(page, 12, "planning-jeudi-titre-long", errors);
    await next(page, 2);
    await shot(page, 13, "planning-samedi-vide", errors);
    await next(page, 2);
    await shot(page, 14, "planning-lundi-suivant", errors);

    // 4. Chat : récapitulatif d'un message qui crée plusieurs choses
    await page.locator("nav button", { hasText: "Accueil" }).click();
    await page.getByLabel("Écrire à Majordome").click();
    await page.locator("textarea").fill("je travaille du lundi au vendredi de 9h à 17h, salle lundi mercredi vendredi 18h-20h, dîner avec Arthur lundi 20h");
    await page.keyboard.press("Enter");
    await page.getByText("Noté :").first().waitFor({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(500);
    await shot(page, 15, "chat-recapitulatif", errors);
    await ctx.close();
  }

  // 5. Jour sans rien + base vide : états vides
  {
    const { page, ctx, errors } = await newPage(browser, vp, { tasks: [], rules: [], exceptions: [], logs: [] });
    await page.reload();
    await page.waitForSelector("nav");
    await page.waitForTimeout(800);
    await shot(page, 16, "accueil-vide", errors);
    await page.locator("nav button", { hasText: "Planning" }).click();
    await page.waitForTimeout(700);
    await shot(page, 17, "planning-vide", errors);
    await ctx.close();
  }

  // 6. « Réduire les animations » : la célébration est sobre (pas d'anneau)
  {
    const { page, ctx, errors } = await newPage(browser, vp, fullData(), { reduced: true });
    await page.reload();
    await page.getByRole("button", { name: "Oui", exact: true }).first().waitFor();
    await page.getByRole("button", { name: "Oui", exact: true }).first().click();
    await page.waitForTimeout(300);
    const ring = await page.locator(".celebrate").count();
    if (ring) note(vp.name, "animations réduites", "défaut", "la célébration s'affiche malgré « réduire les animations »");
    await shot(page, 18, "animations-reduites", errors);
    await ctx.close();
  }
}
await browser.close();

fs.writeFileSync(`${OUT}/findings.json`, JSON.stringify(findings, null, 2));
const by = (k) => [...new Set(findings.map((f) => f[k]))];
console.log(`${findings.length} constat(s) automatique(s) :`);
for (const f of findings) console.log(`- [${f.vp}] ${f.screen} — ${f.kind} : ${f.text}`);
console.log(`\nCaptures dans ${OUT}/ (${by("vp").length ? "voir aussi findings.json" : ""})`);
