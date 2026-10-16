// Tests de bout en bout (Playwright, 390×844) des 5 parcours clés. L'API est simulée dans le navigateur : pas de base ni de clé IA.
// Prérequis : `npm run dev` (port 3000, ou passer l'adresse en argument). Usage : npm run e2e
// Sortie : une ligne ✓ / ✗ par parcours ; code de sortie 1 si un parcours échoue.
import assert from "node:assert/strict";
import { chromium } from "playwright";

const url = process.argv[2] ?? "http://localhost:3000";
const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
const at = (h, m = 0) => new Date(`${today}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+02:00`).toISOString(); // l'heure d'été ne change pas le test : on compare des jours, pas des heures

const browser = await chromium.launch();
const results = [];
const run = async (name, fn) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const state = { tasks: [{ id: 1, title: "Acheter du pain", due_at: null, priority: 2, notes: null, status: "todo" }], meals: [], txs: [], calls: [] };
  await page.route("**/api/**", async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname;
    const m = req.method();
    const body = m === "GET" || m === "DELETE" ? null : req.postDataJSON?.() ?? null;
    state.calls.push(`${m} ${p}`);
    const json = (b) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });
    if (p === "/api/tasks") {
      if (m === "PATCH") state.tasks = state.tasks.map((t) => (t.id === body.id ? { ...t, status: body.done ? "done" : "todo" } : t));
      return json(m === "GET" ? { tasks: state.tasks } : { ok: true });
    }
    if (p === "/api/messages") return json({ messages: [] });
    if (p === "/api/undo") return json({ ok: true, undone: 1 });
    if (p === "/api/chat") {
      const last = body.messages.at(-1).content;
      if (/riz/i.test(last)) state.meals.push({ id: 1, label: "Riz blanc cuit", grams: 50, kcal: 72.5, protein: 1.5, carbs: 15.9, fat: 0.2, estimated: 0 });
      if (/dépensé/i.test(last)) state.txs.push({ id: 5, date: today, label: "Boulangerie", amount: -4.5, category: "Courses" });
      if (/tâche/i.test(last)) state.tasks.push({ id: 2, title: "Appeler Paul", due_at: null, priority: 2, notes: null, status: "todo" });
      const undo = [{ label: "Ajout", steps: [{ op: "delete", table: "tasks", id: 2 }] }];
      return route.fulfill({ status: 200, contentType: "text/plain", body: "C'est noté." + String.fromCharCode(30) + JSON.stringify(undo) });
    }
    if (p === "/api/forme") return json({ ready: true, sleeps: [], workouts: [], steps: [], nutrition: { meals: state.meals, goals: { kcal: 2200, protein: 140, carbs: 250, fat: 70 } } });
    if (p === "/api/finances") return json({ ready: true, transactions: state.txs, budgets: [], goals: [], bank: { ready: false }, snapshot: null });
    return json({});
  });
  await page.goto(url);
  await page.evaluate(() => localStorage.setItem("majordome-access-code", "test-local"));
  await page.reload();
  await page.waitForSelector("nav");
  try {
    await fn(page, state);
    results.push([name, true]);
    console.log(`✓ ${name}`);
  } catch (e) {
    results.push([name, false]);
    console.log(`✗ ${name}\n   ${String(e.message).split("\n")[0]}`);
    await page.screenshot({ path: `captures/e2e-echec-${results.length}.png` });
  } finally {
    await page.close();
  }
};
const say = async (page, text) => {
  await page.getByLabel("Écrire à Majordome").click();
  await page.locator("textarea").fill(text);
  await page.keyboard.press("Enter");
  await page.getByText("C'est noté.").first().waitFor();
};
const closeChat = (page) => page.getByLabel("Fermer la conversation").click();

await run("1. Parler, créer une tâche, puis annuler", async (page, s) => {
  await say(page, "Ajoute une tâche : appeler Paul");
  const undo = page.getByRole("button", { name: /Annuler/ });
  await undo.waitFor();
  await undo.click();
  await page.waitForTimeout(400);
  assert.ok(s.calls.includes("POST /api/undo"), "l'annulation n'a pas appelé /api/undo");
});

await run("2. Cocher une tâche sur l'Accueil", async (page, s) => {
  await page.getByRole("button", { name: "Terminer : Acheter du pain" }).click();
  await page.waitForTimeout(900); // animation (case remplie, la ligne glisse)
  assert.ok(s.calls.includes("PATCH /api/tasks"), "la tâche n'a pas été cochée côté serveur");
  assert.equal(await page.getByText("Acheter du pain").count(), 0, "la ligne cochée devrait avoir disparu");
});

await run("3. Ajouter un repas (à la voix) et le voir dans Forme", async (page) => {
  await say(page, "J'ai mangé 50 g de riz");
  await closeChat(page);
  await page.locator("nav button", { hasText: "Forme" }).click();
  await page.getByText("Riz blanc cuit").waitFor();
  assert.ok((await page.getByText("73").count()) + (await page.getByText("72").count()) > 0, "les kcal du repas ne s'affichent pas");
});

await run("4. Ajouter une dépense (à la voix) et la voir dans Finances", async (page) => {
  await say(page, "J'ai dépensé 4,50 € à la boulangerie");
  await closeChat(page);
  await page.locator("nav button", { hasText: "Finances" }).click();
  await page.getByText("Boulangerie").first().waitFor(); // affiché dans « Dernières opérations » et « Par catégorie »
});

await run("5. Changer de jour dans le Planning (flèche et glissement)", async (page) => {
  await page.locator("nav button", { hasText: "Planning" }).click();
  const title = page.locator("h2").first();
  await title.waitFor();
  const first = await title.innerText();
  await page.getByLabel("Jour suivant").click();
  await page.waitForFunction((t) => document.querySelector("h2, nav ~ div button")?.textContent !== t, first, { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(700);
  const headerAfterArrow = await page.locator("button[aria-label*='revenir à aujourd']").innerText();
  assert.notEqual(headerAfterArrow, first, "la date n'a pas changé après la flèche");
  await page.locator("button[aria-label*='revenir à aujourd']").click(); // toucher la date ramène à aujourd'hui
  await page.waitForTimeout(700);
  assert.equal(await page.locator("h2").first().innerText(), first, "toucher la date n'a pas ramené à aujourd'hui");
  await page.mouse.move(320, 560);
  await page.mouse.down();
  await page.mouse.move(150, 560, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(700);
  assert.equal(await page.locator("h2").count(), 0, "le glissement n'a pas changé de jour (le titre « aujourd'hui » est resté)");
});

await browser.close();
const failed = results.filter(([, ok]) => !ok).length;
console.log(failed ? `\n${failed} parcours en échec.` : "\nLes 5 parcours passent.");
process.exit(failed ? 1 : 0);
