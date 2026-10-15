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

// Finances : d'abord l'aperçu fictif (tables absentes), puis des données réelles simulées.
let financesReady = false;
const today = new Date().toISOString().slice(0, 10);
const daysAgo = (n) => new Date(Date.now() - n * 86400e3).toISOString().slice(0, 10);
const finances = {
  ready: true,
  transactions: [
    { id: 1, date: today, label: "CB CARREFOUR CITY", amount: -23.4, category: "Courses" },
    { id: 2, date: daysAgo(1), label: "PRLV NAVIGO", amount: -86.4, category: "Transport" },
    { id: 3, date: daysAgo(2), label: "VIR SALAIRE ACME", amount: 1450, category: "Revenu" },
    { id: 4, date: daysAgo(3), label: "UBER EATS", amount: -64, category: "Restaurants" },
    { id: 5, date: daysAgo(20), label: "UBER EATS", amount: -18, category: "Restaurants" },
    { id: 6, date: daysAgo(35), label: "UBER EATS", amount: -21, category: "Restaurants" },
    { id: 7, date: daysAgo(50), label: "UBER EATS", amount: -15, category: "Restaurants" },
  ],
  budgets: [{ category: "Courses", limit: 300 }, { category: "Restaurants", limit: 60 }],
  goals: [{ id: 1, label: "Voyage en Australie", target: 4000, saved: 1850, due_label: "Avril", image_url: "/objectif.jpg" }],
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await page.route("**/api/**", (route) => {
  const u = new URL(route.request().url());
  const m = route.request().method();
  const json = (body) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  if (u.pathname === "/api/tasks") return json(m === "GET" ? { tasks } : m === "POST" ? { task: { id: 99, ...route.request().postDataJSON(), notes: null, status: "todo" } } : { ok: true });
  if (u.pathname === "/api/memories") return json(m === "GET" ? { memories } : { ok: true });
  if (u.pathname === "/api/messages") return json({ messages: [] });
  if (u.pathname === "/api/finances") return json(financesReady ? finances : { ready: false });
  if (u.pathname === "/api/chat") return route.fulfill({ status: 200, contentType: "text/plain", body: "Voici ta journée :\n\n- **Appeler le médecin** avant 18 h\n- Renvoyer le dossier (*en retard*)" });
  return route.continue();
});

// Faux micro : la dictée « entend » une phrase puis reste en écoute (pour capturer l'état écoute).
await page.addInitScript(() => {
  window.SpeechRecognition = window.webkitSpeechRecognition = class {
    start() {
      setTimeout(() => this.onresult?.({ results: [[{ transcript: "Ajoute une tâche : rappeler Paul demain" }]] }), 200);
    }
    stop() {
      this.onend?.();
    }
    abort() {}
  };
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
await page.getByRole("tab", { name: "semaine" }).click();
await shot("2b-planning-semaine");
await tab("Finances");
await shot("3-finances");
financesReady = true;
await tab("Forme");
await tab("Finances");
await shot("3b-finances-reelles");
await tab("Forme");
await shot("4-forme");
await page.getByLabel("Écrire à Majordome").click();
await shot("5-chat");
await page.getByRole("button", { name: "Qu'est-ce que j'ai à faire aujourd'hui ?" }).click();
await shot("5b-chat-reponse");
await page.getByLabel("Fermer la conversation").click();
await page.getByLabel("Profil, mémoire et réglages").first().click();
await shot("6-profil");
await page.getByLabel("Fermer", { exact: true }).click();
await page.getByLabel("Parler à Majordome").click();
await shot("7-ecoute");

await browser.close();
