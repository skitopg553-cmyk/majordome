import { NextResponse } from "next/server";
import { denied } from "@/lib/access";
import { isRecurringReminder } from "@/lib/recurring-reminders";
import { listRules } from "@/lib/recurring-store";
import { isMissingTable, supabaseAdmin } from "@/lib/supabase";
import { parisDay } from "@/lib/task-groups";

// Cocher (ou décocher) un pense-bête qui revient : « fait aujourd'hui ». Corps : { rule_id, done }. Seul le jour d'AUJOURD'HUI (Paris) est accepté.
// DELETE { rule_id } : arrêter un pense-bête qui revient (après confirmation à l'écran) ; ses « faits » partent avec lui (cascade).
// Le pense-bête revient tout seul au prochain jour prévu (voir src/lib/recurring-reminders.ts). Sans la migration 0016 : 503, l'écran revient en arrière.
export async function DELETE(req: Request) {
  if (denied(req)) return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { rule_id?: unknown };
  if (typeof b.rule_id !== "number" || !Number.isSafeInteger(b.rule_id) || b.rule_id < 1) return NextResponse.json({ error: "rule_id invalide" }, { status: 400 });
  const db = supabaseAdmin();
  const rule = (await listRules(db))?.find((r) => r.id === b.rule_id);
  if (!rule || !isRecurringReminder(rule)) return NextResponse.json({ error: "Pense-bête introuvable" }, { status: 404 }); // jamais un créneau du calendrier
  const { error } = await db.from("recurring_tasks").delete().eq("id", b.rule_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  if (denied(req)) return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { rule_id?: unknown; done?: unknown };
  if (typeof b.rule_id !== "number" || !Number.isSafeInteger(b.rule_id) || b.rule_id < 1) return NextResponse.json({ error: "rule_id invalide" }, { status: 400 });
  const db = supabaseAdmin();
  const rule = (await listRules(db))?.find((r) => r.id === b.rule_id);
  if (!rule || !isRecurringReminder(rule)) return NextResponse.json({ error: "Pense-bête introuvable" }, { status: 404 });
  const day = parisDay(new Date());
  const { error } = b.done === false ? await db.from("recurring_checks").delete().eq("rule_id", b.rule_id).eq("day", day) : await db.from("recurring_checks").upsert({ rule_id: b.rule_id, day }, { onConflict: "rule_id,day" });
  if (isMissingTable(error)) return NextResponse.json({ error: "La base n'est pas prête pour cela (migration 0016 à appliquer)." }, { status: 503 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
