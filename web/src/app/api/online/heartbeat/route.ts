import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";

// POST — heartbeat: mark user online + update last_seen
// Only sets online=true if the user's showOnline preference allows it.
export async function POST() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = supabaseAdmin();
  // Check preference — if user has explicitly disabled online mode, don't override.
  const { data: profile } = await db.from("profiles").select("is_online").eq("id", user.id).single();
  if (profile && profile.is_online === false) return NextResponse.json({ ok: true, skipped: true });

  await db.from("profiles").update({ is_online: true, last_seen: new Date().toISOString() }).eq("id", user.id);

  return NextResponse.json({ ok: true });
}

// DELETE — user went offline (closing tab / logging out)
export async function DELETE() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = supabaseAdmin();
  await db.from("profiles").update({ is_online: false, last_seen: new Date().toISOString() }).eq("id", user.id);

  return NextResponse.json({ ok: true });
}
