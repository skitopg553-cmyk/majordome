import { NextResponse } from "next/server";
import webpush from "web-push";
import { dueReminders, reminderPayload, type ReminderTask } from "@/lib/reminders";
import { isMissingTable, supabaseAdmin } from "@/lib/supabase";

// Envoi des rappels : appelé toutes les 5 min par pg_cron (Supabase), avec l'en-tête x-cron-secret.
// Désactivé (404) tant que CRON_SECRET et les clés VAPID ne sont pas dans Vercel. Guide : docs/rappels-setup.md.
export async function POST(req: Request) {
  const { CRON_SECRET, NEXT_PUBLIC_VAPID_PUBLIC_KEY: pub, VAPID_PRIVATE_KEY: priv, VAPID_SUBJECT: subject } = process.env;
  if (!CRON_SECRET || !pub || !priv || !subject) return NextResponse.json({ error: "Rappels non configurés" }, { status: 404 });
  if (req.headers.get("x-cron-secret") !== CRON_SECRET) return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  webpush.setVapidDetails(subject, pub, priv);

  const db = supabaseAdmin();
  const now = new Date();
  // Pré-filtre large en SQL, filtre exact en code (testé).
  const since = new Date(now.getTime() - 2 * 3600_000).toISOString();
  const until = new Date(now.getTime() + 10 * 60_000).toISOString();
  const [tasks, subs] = await Promise.all([
    db.from("tasks").select("id,title,due_at,status,reminded_at").eq("status", "todo").is("reminded_at", null).gte("due_at", since).lte("due_at", until),
    db.from("push_subscriptions").select("endpoint,p256dh,auth"),
  ]);
  const error = tasks.error ?? subs.error;
  // 42703 = colonne reminded_at absente : migration pas appliquée.
  if (isMissingTable(error) || error?.code === "42703") return NextResponse.json({ error: "Migration 0007 à valider" }, { status: 503 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const due = dueReminders((tasks.data ?? []) as ReminderTask[], now);
  if (!due.length || !subs.data?.length) return NextResponse.json({ sent: 0 });

  let sent = 0;
  for (const t of due) {
    const payload = JSON.stringify(reminderPayload(t, now));
    for (const s of subs.data) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600 });
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        // 404/410 : le téléphone s'est désabonné (app désinstallée…) → abonnement mort, on le retire.
        if (status === 404 || status === 410) await db.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        else console.error("Envoi push échoué :", status ?? err);
      }
    }
    await db.from("tasks").update({ reminded_at: now.toISOString() }).eq("id", t.id);
  }
  return NextResponse.json({ sent, tasks: due.length });
}
