// Captures d'écran de l'app en 390×844 (format téléphone) avec Playwright, dans captures/ (ignoré par git).
// Prérequis : `npm run dev` lancé avec MAJORDOME_ACCESS_CODE=test-local.
// Les API sont simulées dans le navigateur : pas besoin de base de données ni de clé IA.
// Usage : node scripts/captures.mjs [url]
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const url = process.argv[2] ?? "http://localhost:3000";
mkdirSync("captures", { recursive: true });

const h = (n) => new Date(Date.now() + n * 3600e3).toISOString();
const tasks = [
  { id: 1, title: "Renvoyer le dossier à la banque", due_at: h(-3), priority: 1, notes: null, status: "todo" },
  { id: 2, title: "Appeler le médecin", due_at: h(1), priority: 2, notes: null, status: "todo" },
  { id: 3, title: "Courses pour le week-end", due_at: h(30), priority: 2, notes: null, status: "todo" },
  { id: 4, title: "Préparer la présentation", due_at: h(60), priority: 2, notes: null, status: "todo" },
  { id: 5, title: "Trier les photos", due_at: null, priority: 3, notes: null, status: "todo" },
  { id: 6, title: "Payer le loyer", due_at: h(-30), priority: 2, notes: null, status: "done" },
];
const memories = [
  { id: 1, content: "Courir un semi-marathon avant juin", category: "objectif" },
  { id: 2, content: "Préfère les réponses courtes", category: "preference" },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await page.route("**/api/**", (route) => {
  const u = new URL(route.request().url());
  const m = route.request().method();
  const json = (body) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  if (u.pathname === "/api/tasks") return json(m === "GET" ? { tasks } : m === "POST" ? { task: { id: 99, ...route.request().postDataJSON(), notes: null, status: "todo" } } : { ok: true });
  if (u.pathname === "/api/memories") return json(m === "GET" ? { memories } : { ok: true });
  if (u.pathname === "/api/messages") return json({ messages: [] });
  if (u.pathname === "/api/chat") return route.fulfill({ status: 200, contentType: "text/plain", body: "Voici ta journée :\n\n- **Appeler le médecin** avant 18 h\n- Renvoyer le dossier (*en retard*)" });
  return route.continue();
});

await page.goto(url);
await page.evaluate(() => localStorage.setItem("majordome-access-code", "test-local"));
await page.reload();
await page.waitForSelector("nav");

const shot = async (name) => {
  await page.waitForTimeout(500); // laisse finir les animations d'entrée
  await page.screenshot({ path: `captures/${name}.png`, fullPage: false });
  console.log(`captures/${name}.png`);
};
const tab = (label) => page.locator("nav button", { hasText: label }).click();

await shot("1-accueil");
await page.locator("main > div").first().evaluate((el) => el.scrollTo(0, el.scrollHeight));
await shot("1b-accueil-bas");
await tab("Planning");
await shot("2-planning");
await tab("Finances");
await shot("3-finances");
await tab("Forme");
await shot("4-forme");
await page.getByLabel("Écrire à Majordome").click();
await shot("5-chat");
await page.getByRole("button", { name: "Qu'est-ce que j'ai à faire aujourd'hui ?" }).click();
await shot("5b-chat-reponse");
await page.getByLabel("Fermer la conversation").click();
await page.getByLabel("Profil, mémoire et réglages").first().click();
await shot("6-profil");

await browser.close();
