import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await supabaseServer();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      displayName: profile?.display_name || user.email?.split("@")[0],
      avatarUrl: profile?.avatar_url || null,
      phone: profile?.phone || null,
      bio: profile?.bio || null,
      shopId: profile?.shop_id || null,
      showOnline: profile?.is_online ?? true,
    },
  });
}
