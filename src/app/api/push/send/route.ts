import { NextResponse } from "next/server";
import webpush from "web-push";
import { checkCron } from "@/lib/cron-auth";
import { dueOccurrenceReminders, dueReminders, reminderPayload, type ReminderTask } from "@/lib/reminders";
import { listRules } from "@/lib/recurring-store";
import type { SlotException } from "@/lib/slots";
import { isMissingTable, supabaseAdmin } from "@/lib/supabase";

// Envoi des rappels : appelé chaque minute par pg_cron (Supabase), avec l'en-tête x-cron-secret.
// Désactivé (404) tant que CRON_SECRET et les clés VAPID ne sont pas dans Vercel. Guide : docs/rappels-setup.md.
export async function POST(req: Request) {
  const { NEXT_PUBLIC_VAPID_PUBLIC_KEY: pub, VAPID_PRIVATE_KEY: priv, VAPID_SUBJECT: subject } = process.env;
  const auth = checkCron(req);
  if (auth === "off" || !pub || !priv || !subject) return NextResponse.json({ error: "Rappels non configurés" }, { status: 404 });
  if (auth === "denied") return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  webpush.setVapidDetails(subject, pub, priv);

  const db = supabaseAdmin();
  const now = new Date();
  // Pré-filtre large en SQL, filtre exact en code (testé).
  const since = new Date(now.getTime() - 2 * 3600_000).toISOString();
  const until = new Date(now.getTime() + 10 * 60_000).toISOString();
  const [tasks, subs, rules, exc] = await Promise.all([
    db.from("tasks").select("id,title,due_at,status,reminded_at").eq("status", "todo").is("reminded_at", null).gte("due_at", since).lte("due_at", until),
    db.from("push_subscriptions").select("endpoint,p256dh,auth"),
    listRules(db),
    db.from("recurring_exceptions").select("rule_id,day,action,new_day,new_start,new_end"),
  ]);
  const error = tasks.error ?? subs.error;
  // 42703 = colonne reminded_at absente : migration pas appliquée.
  if (isMissingTable(error) || error?.code === "42703") return NextResponse.json({ error: "Migration 0007 à valider" }, { status: 503 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const due = dueReminders((tasks.data ?? []) as ReminderTask[], now);
  // Créneaux qui reviennent (cours, boxe…) : calculés comme dans le Planning, rappelés une seule fois (voir reminders.ts).
  const slots = dueOccurrenceReminders(rules ?? [], exc.error ? [] : ((exc.data ?? []) as SlotException[]), now);
  if ((!due.length && !slots.length) || !subs.data?.length) return NextResponse.json({ sent: 0 });
  const send = async (payload: string) => {
    let delivered = 0;
    for (const s of subs.data!) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600 });
        delivered++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        // 404/410 : le téléphone s'est désabonné (app désinstallée…) → abonnement mort, on le retire.
        if (status === 404 || status === 410) await db.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        else console.error("Envoi push échoué :", status ?? err);
      }
    }
    return delivered;
  };

  let sent = 0;
  for (const t of due) {
    const delivered = await send(JSON.stringify(reminderPayload(t, now)));
    // Marquée « rappelée » seulement si au moins un téléphone l'a reçue : sinon on réessaie au prochain passage (fenêtre d'1 h).
    if (delivered > 0) await db.from("tasks").update({ reminded_at: now.toISOString() }).eq("id", t.id);
    sent += delivered;
  }
  for (const p of slots) sent += await send(JSON.stringify(p));
  return NextResponse.json({ sent, tasks: due.length, slots: slots.length });
}
