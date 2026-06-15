import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";

export async function POST(request: Request) {
  const { message_id, user_id, username, emoji, action } = await request.json();
  const supabase = createServerSupabase();

  if (action === "remove") {
    await supabase.from("chat_reactions")
      .delete()
      .eq("message_id", message_id)
      .eq("user_id", user_id)
      .eq("emoji", emoji);
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabase.from("chat_reactions").upsert({
    message_id, user_id, username, emoji,
  }, { onConflict: "message_id,user_id,emoji" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
