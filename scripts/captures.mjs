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
const parisDate = (d) => d.toLocaleDateString("en-CA", { timeZone: "Europe/Paris" }); // comme l'app
const today = parisDate(new Date());
const daysAgo = (n) => parisDate(new Date(Date.now() - n * 86400e3));
const finances = {
  ready: true,
  snapshot: process.env.NO_BANK ? { balance: 2392.61, asOf: today } : null,
  bank: process.env.NO_BANK ? { ready: true, connection: null } : { ready: true, connection: { bankName: "Revolut", balance: 976.6, syncedAt: new Date(Date.now() - 5 * 60e3).toISOString(), validUntil: new Date(Date.now() + 10 * 86400e3).toISOString() } },
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
  goals: [{ id: 1, label: "Voiture", target: 3000, saved: 450, due_label: "Juin", image_url: null }],
  savings: { capacity: { months: 3, fixed: 864, free: 180 }, saved: 450, advice: [{ label: "Voiture", text: "Voiture : 319 €/mois nécessaires, 180 € dispo → décale de 2 mois ou réduis tes sorties de 139 €." }] },
};

let formeReady = false;
const forme = {
  ready: true,
  sleeps: [daysAgo(3), daysAgo(2), daysAgo(1), today].map((date, i) => ({ date, hours: [6.5, 7.25, 5.75, 7.5][i] })),
  workouts: [{ date: daysAgo(1), kind: "Salle", minutes: 60 }],
  steps: [{ date: today, steps: 2000 }],
  nutrition: { meals: [{ id: 1, label: "Riz blanc cuit", grams: 150, kcal: 195, protein: 4, carbs: 42, fat: 0.5, estimated: 0 }, { id: 2, label: "Gâteau de Mamie", grams: 100, kcal: 350, protein: 5, carbs: 50, fat: 15, estimated: 1 }, { id: 3, label: "Œuf entier", grams: 110, kcal: 157, protein: 14, carbs: 1, fat: 11, estimated: 0 }], goals: { kcal: 2200, protein: 140, carbs: 250, fat: 70 } },
  screen: [{ date: today, minutes: 246 }, { date: daysAgo(2), minutes: 270 }, { date: daysAgo(8), minutes: 330 }, { date: daysAgo(9), minutes: 300 }],
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
  if (u.pathname === "/api/forme") return json(formeReady ? forme : { ready: false });
  if (u.pathname === "/api/costs") return json({ today: { cost: 0.051, calls: 3 }, month: { cost: 1.842, calls: 61 }, byModel: [{ model: "claude-sonnet-5-5", cost: 1.79, calls: 40 }, { model: "claude-haiku-5-5", cost: 0.052, calls: 21 }], unpriced: 0 });
  if (u.pathname === "/api/bank/sync") return json({ imported: 3, duplicates: 12, skipped: 0, balance: 976.6, syncedAt: new Date().toISOString() });
  if (u.pathname === "/api/finances") return json(financesReady ? finances : { ready: false });
  if (u.pathname === "/api/chat") return route.fulfill({ status: 200, contentType: "text/plain", body: "Voici ta journée :\n\n- **Appeler le médecin** avant 18 h\n- Renvoyer le dossier (*en retard*)\u001e" + JSON.stringify([{ label: "Séance « Musculation »", steps: [{ op: "delete", table: "workouts", id: 9 }] }]) });
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

page.on("console", (m) => m.type() === "error" && console.log("[console]", m.text().slice(0, 300)));
page.on("pageerror", (e) => console.log("[pageerror]", e.message.slice(0, 300)));
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
await page.getByRole("button", { name: /Ta semaine/ }).click();
await shot("1c-ta-semaine");
await page.getByLabel("Fermer", { exact: true }).click();
await tab("Planning");
await page.locator("main > div").first().evaluate((el) => el.scrollTo(0, 0));
await shot("2-planning");
await page.getByRole("button", { name: /^Appeler le médecin/ }).click();
await shot("2b-planning-fiche");
await page.getByLabel("Fermer", { exact: true }).click();
await page.mouse.move(320, 560);
await page.mouse.down();
await page.mouse.move(220, 560, { steps: 6 });
await page.mouse.move(150, 560, { steps: 6 });
await shot("2c-planning-glisse"); // en plein geste : deux jours visibles
await page.mouse.up();
await shot("2d-planning-demain");
await tab("Finances");
await shot("3-finances");
financesReady = true;
await tab("Forme");
await tab("Finances");
await shot("3b-finances-reelles");
await page.getByRole("button", { name: "Nouvel objectif" }).click();
await page.getByLabel("Nom de l'objectif").fill("Voiture");
await shot("3c-nouvel-objectif");
await tab("Accueil");
await page.locator("main > div").first().evaluate((el) => el.scrollTo(0, 500));
await shot("1d-accueil-reel");
await tab("Forme");
await shot("4-forme");
formeReady = true;
await tab("Accueil");
await tab("Forme");
await page.getByRole("button", { name: "+ Séance" }).click();
await shot("4b-forme-reelle");
await page.locator("main > div").first().evaluate((el) => el.scrollTo(0, el.scrollHeight));
await shot("4c-forme-bas");
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
