// Parcours du CALENDRIER « comme un utilisateur » (Playwright), en 390×844 et 360×800. API simulée dans le navigateur : AUCUNE base.
// La simulation de /api/calendar est volontairement simple : elle vérifie que l'écran envoie les bonnes demandes et se met à jour ;
// les règles fines (anti-doublon, titres, dates) sont testées à part (src/lib/calendar*.test.ts).
// Prérequis : `npm run dev`. Usage : npm run qa:calendrier   Sortie : captures/qa-calendrier/ + constats automatiques.
import assert from "node:assert/strict";
import fs from "node:fs";
import { chromium } from "playwright";

const url = process.argv[2] ?? "http://localhost:3000";
const OUT = "captures/qa-calendrier";
fs.mkdirSync(OUT, { recursive: true });
const NOW = new Date("2026-10-20T08:00:00Z"); // mardi 20 octobre 2026, 10 h à Paris
const DAYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
const off = (day) => (day >= "2026-10-25" ? "+01:00" : "+02:00");
const iso = (day, hm) => new Date(`${day}T${hm}:00${off(day)}`).toISOString();
const LONG = "Réunion avec le directeur régional du développement commercial et de la stratégie de partenariats";

const rule = (id, title, days, at, end, habit = 0) => ({ id, title, kind: "weekly", weekday: Number(days[0]), month_day: null, days, at_time: at, end_time: end, habit, last_generated: null, created_at: "2026-10-01T08:00:00Z" });
const week = () => ({
  tasks: [
    { id: 101, title: "Dentiste", due_at: iso("2026-10-20", "10:00"), end_at: iso("2026-10-20", "11:00"), status: "todo", priority: 2, notes: null },
    { id: 102, title: LONG, due_at: iso("2026-10-22", "14:00"), end_at: iso("2026-10-22", "15:30"), status: "todo", priority: 2, notes: null },
    { id: 103, title: "Sortir les poubelles", due_at: null, status: "todo", priority: 2, notes: null },
    { id: 104, title: "Acheter des piles", due_at: iso("2026-10-20", "00:00"), status: "todo", priority: 2, notes: null },
  ],
  rules: [
    rule(1, "Cours", "1", "09:00", "12:00"), rule(2, "Cours", "1", "14:00", "18:00"),
    rule(3, "Cours", "2", "09:00", "12:00"), rule(4, "Cours", "2", "12:30", "17:30"), rule(5, "Boxe anglaise", "2", "18:30", "20:00", 1),
    rule(6, "Cours", "3,4", "09:00", "12:00"), rule(7, "Muscu", "3,4", "12:00", "13:30", 1), rule(8, "Cours", "3,4", "13:30", "17:00"),
    rule(9, "Cours", "5", "09:00", "12:00"), rule(10, "Muscu", "5", "12:00", "13:00", 1), rule(11, "Cours", "5", "13:00", "16:00"),
    rule(12, "Travail O'Tacos", "5,7", "18:30", "23:00"),
  ],
  exceptions: [],
  logs: [],
});

/** Simulation minimale de /api/calendar (création, modification, suppression). */
function calendar(data, b) {
  const csv = (names) => names.map((n) => DAYS.indexOf(n) + 1).sort().join(",");
  let next = 1000 + data.tasks.length + data.rules.length + data.exceptions.length;
  if (b.action === "create") {
    if (b.days?.length) data.rules.push(rule(next, b.title, csv(b.days), b.start, b.end));
    else data.tasks.push({ id: next, title: b.title, due_at: iso(b.day, b.start), end_at: iso(b.day, b.end), status: "todo", priority: 2, notes: null });
    return "Créé.";
  }
  const t = b.target;
  if (t.kind === "task") {
    if (b.action === "delete") data.tasks = data.tasks.filter((x) => x.id !== t.id);
    else Object.assign(data.tasks.find((x) => x.id === t.id), { title: b.title, due_at: iso(b.day, b.start), end_at: iso(b.day, b.end) });
    return "Fait.";
  }
  if (b.scope === "series") {
    if (b.action === "delete") data.rules = data.rules.filter((r) => r.id !== t.id);
    else Object.assign(data.rules.find((r) => r.id === t.id), { title: b.title, at_time: b.start, end_time: b.end, days: csv(b.days) });
    return "Fait (toutes les semaines).";
  }
  data.exceptions = data.exceptions.filter((e) => !(e.rule_id === t.id && e.day === t.day));
  data.exceptions.push(b.action === "delete" ? { rule_id: t.id, day: t.day, action: "skip", new_day: null, new_start: null, new_end: null } : { rule_id: t.id, day: t.day, action: "move", new_day: b.day, new_start: b.start, new_end: b.end });
  return "Fait (cette fois seulement).";
}

const findings = [];
const note = (vp, screen, kind, text) => findings.push({ vp, screen, kind, text });

async function audit(page, vp, screen, errors) {
  const r = await page.evaluate(() => {
    const visible = (el) => {
      const b = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return b.width > 0 && b.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && b.bottom > 0 && b.top < innerHeight;
    };
    const label = (el) => (el.getAttribute("aria-label") || el.textContent || el.tagName).trim().replace(/\s+/g, " ").slice(0, 40);
    // Les pavés du calendrier ont la hauteur de leur durée : un pavé de 30 min peut être bas ; on les compte à part.
    const small = [...document.querySelectorAll("button, a[href], input:not([type=hidden]), select, textarea")]
      .filter(visible)
      .filter((el) => el.getAttribute("aria-label") !== "Écrire à Majordome")
      .map((el) => ({ el, b: el.getBoundingClientRect() }))
      .filter(({ el, b }) => (b.height < 43.5 || b.width < 43.5) && !el.closest("[aria-label='Grille horaire']"))
      .map(({ el, b }) => `${el.tagName.toLowerCase()} « ${label(el)} » ${Math.round(b.width)}×${Math.round(b.height)}`);
    const tinyBlocks = [...document.querySelectorAll("[aria-label='Grille horaire'] button")].filter(visible).filter((el) => el.getBoundingClientRect().width < 30).map((el) => `pavé « ${label(el)} » ${Math.round(el.getBoundingClientRect().width)} px de large`);
    return { overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth, small: [...new Set(small)].slice(0, 10), tinyBlocks: tinyBlocks.slice(0, 6) };
  });
  if (r.overflowX > 1) note(vp, screen, "débordement horizontal", `${r.overflowX} px`);
  for (const s of r.small) note(vp, screen, "zone < 44 px", s);
  for (const s of r.tinyBlocks) note(vp, screen, "pavé étroit", s);
  for (const e of errors.splice(0)) note(vp, screen, "console", e);
}

const browser = await chromium.launch();
for (const vp of [{ name: "390x844", width: 390, height: 844 }, { name: "360x800", width: 360, height: 800 }]) {
  const ctx = await browser.newContext({ viewport: vp, timezoneId: "Europe/Paris", locale: "fr-FR", deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && !/favicon|Failed to load resource/.test(m.text()) && errors.push(m.text().slice(0, 160)));
  page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 160)));
  page.on("dialog", (d) => d.accept());
  await page.clock.setFixedTime(NOW);
  const data = week();
  const sent = [];
  await page.route("**/api/**", async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname;
    const m = req.method();
    const body = m === "GET" || m === "DELETE" ? null : req.postDataJSON?.() ?? null;
    const json = (b, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(b) });
    if (p === "/api/tasks") return json(m === "GET" ? { tasks: data.tasks } : { ok: true });
    if (p === "/api/slots") return json({ ready: true, rules: data.rules, exceptions: data.exceptions, logs: data.logs });
    if (p === "/api/calendar") {
      sent.push(body);
      return json({ ok: true, done: calendar(data, body), undo: null });
    }
    if (p.startsWith("/api/google/")) return json({ state: "off", events: [] });
    if (p === "/api/messages") return json({ messages: [] });
    if (p === "/api/forme") return json({ ready: true, sleeps: [], workouts: [], steps: [], screen: [] });
    if (p === "/api/finances") return json({ ready: true, transactions: [], budgets: [], goals: [], bank: { ready: false }, snapshot: null });
    return json({});
  });
  await page.goto(url);
  await page.evaluate(() => localStorage.setItem("majordome-access-code", "test-local"));
  await page.reload();
  await page.locator("nav button", { hasText: "Planning" }).click();
  await page.waitForTimeout(800);
  let n = 0;
  const shot = async (name) => {
    await page.waitForTimeout(350);
    await page.screenshot({ path: `${OUT}/${vp.name}-${String(++n).padStart(2, "0")}-${name}.png` });
    await audit(page, vp.name, name, errors);
  };
  const grid = page.getByLabel("Grille horaire");
  const scrollGridTo = (h) => grid.evaluate((el, h) => el.scrollTo({ top: h * 48 }), h);
  const block = (name) => grid.getByRole("button", { name: new RegExp(`^${name}`) });
  const dayTab = (d) => page.getByRole("button", { name: new RegExp(d) }).first();
  const step = async (label, fn) => {
    try {
      await fn();
    } catch (e) {
      note(vp.name, label, "ÉCHEC du parcours", String(e.message).split("\n")[0]);
      await page.screenshot({ path: `${OUT}/${vp.name}-echec-${label}.png` });
      await page.keyboard.press("Escape").catch(() => {});
      const close = page.getByRole("button", { name: "Fermer", exact: true });
      if (await close.count()) await close.first().click().catch(() => {});
    }
  };

  await step("jour", async () => {
    await scrollGridTo(8);
    await shot("jour-mardi-chevauchement");
  });
  await step("semaine", async () => {
    await page.getByRole("tab", { name: "Semaine" }).click();
    await scrollGridTo(8);
    await shot("semaine");
    await scrollGridTo(12);
    await shot("semaine-apres-midi-soir");
  });
  await step("jeudi-titre-long", async () => {
    await dayTab("jeudi 22 octobre").click();
    await scrollGridTo(9);
    await shot("jeudi-titre-long");
    await block("Réunion avec le directeur").click();
    await shot("fiche-titre-long");
    await page.getByRole("button", { name: "Fermer", exact: true }).click();
  });
  await step("creer", async () => {
    await dayTab("samedi 24 octobre").click();
    await scrollGridTo(8);
    const col = page.locator("[data-day='2026-10-24']");
    const box = await col.boundingBox();
    const top = await col.evaluate((el) => el.getBoundingClientRect().top);
    await page.mouse.click(box.x + box.width / 2, top + 10 * 48 + 5); // 10 h
    await page.getByPlaceholder("Cours, Boxe, Dentiste…").fill("Brunch");
    await page.getByLabel("Fin").fill("11:30");
    await shot("creer-fiche");
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await page.waitForTimeout(600);
    const last = sent.at(-1);
    assert.deepEqual({ a: last.action, t: last.title, d: last.day, s: last.start, e: last.end }, { a: "create", t: "Brunch", d: "2026-10-24", s: "10:00", e: "11:30" });
    await block("Brunch").waitFor();
    await shot("creer-resultat");
  });
  await step("modifier-serie", async () => {
    await dayTab("mardi 20 octobre").click();
    await scrollGridTo(17);
    await block("Boxe anglaise").click();
    await page.getByLabel("Fin").fill("21:00");
    await shot("modifier-fiche-recurrente");
    await page.getByRole("button", { name: "Enregistrer pour toute la série" }).click();
    await page.waitForTimeout(600);
    assert.equal(sent.at(-1).scope, "series");
    assert.deepEqual(sent.at(-1).days, ["mardi"]);
    await shot("modifier-serie-resultat");
  });
  await step("deplacer-une-fois", async () => {
    await block("Boxe anglaise").click();
    await page.getByLabel("Début").fill("19:30");
    await page.getByLabel("Fin").fill("21:30");
    await page.getByRole("button", { name: "Enregistrer pour cette fois seulement" }).click();
    await page.waitForTimeout(600);
    assert.equal(sent.at(-1).scope, "once");
    assert.equal(sent.at(-1).target.day, "2026-10-20");
    await shot("deplacer-une-fois");
  });
  await step("supprimer-occurrence", async () => {
    await scrollGridTo(8);
    await block("Cours, 09:00").click();
    await page.getByRole("button", { name: "Supprimer cette fois" }).click();
    await page.waitForTimeout(600);
    assert.equal(sent.at(-1).action, "delete");
    assert.equal(sent.at(-1).scope, "once");
    await shot("supprimer-occurrence");
  });
  await step("supprimer-serie", async () => {
    await dayTab("vendredi 23 octobre").click();
    await scrollGridTo(17);
    await block("Travail O'Tacos").click();
    await page.getByRole("button", { name: "Supprimer toute la série" }).click();
    await page.waitForTimeout(600);
    assert.equal(sent.at(-1).scope, "series");
    assert.equal(await block("Travail O'Tacos").count(), 0);
    await shot("supprimer-serie");
  });
  await step("ponctuel-modifier-supprimer", async () => {
    await dayTab("mardi 20 octobre").click();
    await scrollGridTo(9);
    await block("Dentiste").click();
    await page.getByLabel("Début").fill("15:00");
    await page.getByLabel("Fin").fill("16:00");
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await page.waitForTimeout(600);
    await scrollGridTo(14);
    await block("Dentiste").click();
    await page.getByRole("button", { name: "Supprimer", exact: true }).click();
    await page.waitForTimeout(600);
    assert.equal(await block("Dentiste").count(), 0);
    await shot("ponctuel-supprime");
  });
  await step("pense-betes", async () => {
    await page.evaluate(() => document.querySelector(".min-h-0.flex-1.overflow-y-auto")?.scrollTo(0, 99999));
    await shot("pense-betes-sous-la-grille");
  });
  await ctx.close();
}
await browser.close();
fs.writeFileSync(`${OUT}/findings.json`, JSON.stringify(findings, null, 2));
console.log(`${findings.length} constat(s) :`);
for (const f of findings) console.log(`- [${f.vp}] ${f.screen} — ${f.kind} : ${f.text}`);
