// Tour complet de l'appli « comme un utilisateur » (Playwright, 390×844), API simulée dans le navigateur : AUCUNE base, aucune clé IA.
// Deux passages : une semaine réaliste (données pleines), puis une base vide. Chaque écran : capture + texte visible + contrôles automatiques.
// Prérequis : `npm run dev`. Usage : node scripts/tour.mjs   Sortie : captures/tour/
import fs from "node:fs";
import { chromium } from "playwright";

const url = process.argv[2] ?? "http://localhost:3000";
const OUT = "captures/tour";
fs.mkdirSync(OUT, { recursive: true });
const NOW = new Date("2026-10-20T16:30:00Z"); // mardi 20 octobre 2026, 18 h 30 à Paris
const iso = (day, hm) => new Date(`${day}T${hm}:00+02:00`).toISOString();
const rule = (id, title, days, at, end, habit = 0) => ({ id, title, kind: "weekly", weekday: Number(days[0]), month_day: null, days, at_time: at, end_time: end, habit, last_generated: null, created_at: "2026-10-01T08:00:00Z" });

const full = () => ({
  tasks: [
    { id: 1, title: "Sortir les poubelles", due_at: null, status: "todo", priority: 2, notes: null },
    { id: 2, title: "Appeler la banque", due_at: iso("2026-10-19", "00:00"), status: "todo", priority: 1, notes: null },
    { id: 3, title: "Dentiste", due_at: iso("2026-10-22", "15:00"), end_at: iso("2026-10-22", "16:00"), status: "todo", priority: 2, notes: null },
    { id: 4, title: "Acheter du pain", due_at: null, status: "done", priority: 2, notes: null, done_at: iso("2026-10-20", "09:00") },
  ],
  rules: [rule(1, "Cours", "1,2,3,4,5", "09:00", "12:00"), rule(2, "Boxe anglaise", "2", "18:30", "20:00", 1), rule(3, "Muscu", "1,3,5", "12:00", "13:30", 1), rule(4, "Travail O'Tacos", "5,7", "18:30", "23:00")],
  exceptions: [],
  logs: [],
  memories: [
    { id: 1, content: "Allergique aux arachides", category: "info" },
    { id: 2, content: "Veut perdre 5 kg avant l'été", category: "objectif" },
    { id: 3, content: "Préfère être réveillé à 7 h", category: "preference" },
  ],
  fin: {
    ready: true,
    transactions: [
      { id: 1, date: "2026-10-20", label: "Carrefour", amount: -42.3, category: "Courses" },
      { id: 2, date: "2026-10-18", label: "Netflix", amount: -13.49, category: "Abonnements" },
      { id: 3, date: "2026-10-15", label: "Salaire O'Tacos", amount: 820, category: "Revenus" },
      { id: 4, date: "2026-10-12", label: "SNCF", amount: -35, category: "Transport" },
      { id: 5, date: "2026-10-05", label: "Loyer", amount: -450, category: "Logement" },
    ],
    budgets: [{ category: "Courses", monthly_limit: 200 }, { category: "Abonnements", monthly_limit: 20 }],
    goals: [{ id: 1, label: "Voiture", target: 3000, saved: 650, due_label: "été 2027", image_url: null }],
    bank: { ready: true, connection: null },
    snapshot: { balance: 1234.56, asOf: "2026-10-18" },
    savings: { capacity: { months: 1, fixed: 463.49, free: 280 }, saved: 650, advice: [{ label: "Abonnements", text: "Netflix : 13,49 € par mois." }] },
  },
  forme: { ready: true, sleeps: [{ date: "2026-10-20", hours: 7.25 }, { date: "2026-10-19", hours: 6 }], workouts: [{ id: 1, date: "2026-10-19", kind: "Musculation", minutes: 75 }], steps: [{ date: "2026-10-20", steps: 6400 }], nutrition: { meals: [{ id: 1, label: "Riz blanc cuit", grams: 200, kcal: 290, protein: 6, carbs: 63, fat: 0.6, estimated: 0 }], goals: { kcal: 2200, protein: 140, carbs: 250, fat: 70 } }, screen: [] },
  week: { mirror: { from: "2026-10-19", to: "2026-10-25", tasksDone: 3, tasksLate: 1, spent: 90.79, income: 820, topCategory: { category: "Courses", spent: 42.3 }, sessions: 1, activeDays: 1, spentPrev: 120, spentDeltaPct: -24, sleepAvg: 6.6, nights: 2, kcalAvg: 290, mealDays: 1 }, note: "Semaine calme côté dépenses, une seule séance pour l'instant." },
  costs: { today: { cost: 0.0012, calls: 3 }, month: { cost: 0.0102, calls: 58 }, byModel: [{ model: "gpt-4o-mini", cost: 0.0102, calls: 58 }], unpriced: 0 },
});
const empty = () => ({ tasks: [], rules: [], exceptions: [], logs: [], memories: [], fin: { ready: true, transactions: [], budgets: [], goals: [], bank: { ready: true, connection: null }, snapshot: null }, forme: { ready: true, sleeps: [], workouts: [], steps: [], nutrition: { meals: [], goals: null }, screen: [] }, week: { mirror: { from: "2026-10-19", to: "2026-10-25", tasksDone: 0, tasksLate: 0, spent: 0, income: 0, topCategory: null, sessions: 0, activeDays: 0, spentPrev: 0, spentDeltaPct: null, sleepAvg: null, nights: 0, kcalAvg: null, mealDays: 0 }, note: null }, costs: { today: { cost: 0, calls: 0 }, month: { cost: 0, calls: 0 }, byModel: [], unpriced: 0 } });

const findings = [];
const note = (run, screen, kind, text) => findings.push({ run, screen, kind, text });

async function audit(page, run, screen, errors) {
  const r = await page.evaluate(() => {
    const vis = (el) => { const b = el.getBoundingClientRect(); const cs = getComputedStyle(el); return b.width > 0 && b.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && b.bottom > 0 && b.top < innerHeight; };
    const label = (el) => (el.getAttribute("aria-label") || el.textContent || el.getAttribute("placeholder") || el.tagName).trim().replace(/\s+/g, " ").slice(0, 40);
    const small = [...document.querySelectorAll("button, a[href], input:not([type=hidden]):not(.sr-only), select, textarea")].filter(vis)
      .filter((el) => el.getAttribute("aria-label") !== "Écrire à Majordome" && !el.closest("[aria-label='Grille horaire']"))
      .map((el) => ({ el, b: el.getBoundingClientRect() })).filter(({ b }) => b.height < 43.5 || b.width < 43.5)
      .map(({ el, b }) => `${el.tagName.toLowerCase()} « ${label(el)} » ${Math.round(b.width)}×${Math.round(b.height)}`);
    return { overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth, small: [...new Set(small)].slice(0, 8), text: (document.querySelector("section[role=dialog]") ?? document.querySelector("main") ?? document.body).innerText.slice(0, 3000) };
  });
  if (r.overflowX > 1) note(run, screen, "débordement horizontal", `${r.overflowX} px`);
  for (const s of r.small) note(run, screen, "zone < 44 px", s);
  for (const e of errors.splice(0)) note(run, screen, "console", e);
  return r.text;
}

async function tour(browser, run, data) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Europe/Paris", locale: "fr-FR", deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && !/favicon|Failed to load resource/.test(m.text()) && errors.push(m.text().slice(0, 200)));
  page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 200)));
  page.on("dialog", (d) => d.accept());
  await page.clock.setFixedTime(NOW);
  const calls = [];
  await page.route("**/api/**", async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname;
    const m = req.method();
    calls.push(`${m} ${p}`);
    const json = (b, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(b) });
    if (p === "/api/tasks") return json(m === "GET" ? { tasks: data.tasks } : { ok: true });
    if (p === "/api/slots") return json({ ready: true, rules: data.rules, exceptions: data.exceptions, logs: data.logs });
    if (p === "/api/google/summary" || p === "/api/google/agenda" || p === "/api/google/status") return json({ state: "not-connected", events: [], suggestions: [], mails: null });
    if (p.startsWith("/api/google/")) return json({ state: "not-connected" });
    if (p === "/api/messages") return json({ messages: [] });
    if (p === "/api/memories") return json(m === "GET" ? { memories: data.memories } : { ok: true });
    if (p === "/api/finances") return json(data.fin);
    if (p === "/api/forme") return json(data.forme);
    if (p === "/api/week") return json(data.week);
    if (p === "/api/costs") return json(data.costs);
    if (p === "/api/chat") return route.fulfill({ status: 200, contentType: "text/plain", body: "OK\n\nFait : Boxe anglaise mardi 19 h-20 h 30 (habitude à confirmer)" });
    return json({ ok: true });
  });
  await page.goto(url);
  await page.evaluate(() => localStorage.setItem("majordome-access-code", "test-local"));
  await page.reload();
  await page.waitForSelector("nav");
  await page.waitForTimeout(1200);
  let n = 0;
  const texts = {};
  const scroller = () => page.evaluate(() => document.querySelector(".min-h-0.flex-1.overflow-y-auto")?.scrollTo(0, 99999));
  const shot = async (name) => {
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/${run}-${String(++n).padStart(2, "0")}-${name}.png` });
    texts[name] = await audit(page, run, name, errors);
  };
  const tab = async (t) => {
    await page.locator("nav button", { hasText: t }).click();
    await page.waitForTimeout(800);
  };
  const safe = async (label, fn) => { try { await fn(); } catch (e) { note(run, label, "parcours bloqué", String(e.message).split("\n")[0]); } };

  await safe("accueil", async () => { await shot("accueil-haut"); await scroller(); await shot("accueil-bas"); });
  await safe("fiche-pense-bete", async () => {
    if (!data.tasks.length) return;
    await page.evaluate(() => document.querySelector(".min-h-0.flex-1.overflow-y-auto")?.scrollTo(0, 0));
    await page.getByText(data.tasks[0].title).first().click();
    await shot("fiche-pense-bete");
    await page.getByRole("button", { name: "Fermer", exact: true }).first().click();
  });
  await safe("ta-semaine", async () => {
    await page.evaluate(() => document.querySelector(".min-h-0.flex-1.overflow-y-auto")?.scrollTo(0, 0));
    const b = page.getByText("Ta semaine").first();
    await b.scrollIntoViewIfNeeded();
    await b.click();
    await shot("ta-semaine");
    await page.getByRole("button", { name: "Fermer", exact: true }).first().click();
  });
  await safe("planning", async () => { await tab("Planning"); await shot("planning-jour"); await page.getByRole("tab", { name: "Semaine" }).click(); await shot("planning-semaine"); });
  await safe("finances", async () => { await tab("Finances"); await shot("finances-haut"); await scroller(); await shot("finances-bas"); });
  await safe("forme", async () => { await tab("Forme"); await shot("forme-haut"); await scroller(); await shot("forme-bas"); });
  await safe("profil", async () => {
    await tab("Accueil");
    await page.getByRole("button", { name: /profil|^R$/i }).first().click();
    await shot("profil-haut");
    await page.evaluate(() => document.querySelector("section[role=dialog] .overflow-y-auto")?.scrollTo(0, 99999));
    await shot("profil-bas");
    await page.getByRole("button", { name: "Fermer", exact: true }).first().click();
  });
  await safe("chat", async () => {
    await page.getByLabel("Écrire à Majordome").click();
    await shot("chat-vide");
    await page.locator("textarea").fill("décale la boxe à 19h jusqu'à 20h30");
    await page.keyboard.press("Enter");
    await page.getByText("Fait :").first().waitFor({ timeout: 5000 });
    await shot("chat-reponse");
  });
  await ctx.close();
  return { texts, calls: [...new Set(calls)] };
}

const browser = await chromium.launch();
const a = await tour(browser, "plein", full());
const b = await tour(browser, "vide", empty());
await browser.close();
fs.writeFileSync(`${OUT}/textes.json`, JSON.stringify({ plein: a.texts, vide: b.texts, appels: a.calls }, null, 2));
fs.writeFileSync(`${OUT}/findings.json`, JSON.stringify(findings, null, 2));
console.log(`${findings.length} constat(s) :`);
for (const f of findings) console.log(`- [${f.run}] ${f.screen} — ${f.kind} : ${f.text}`);
