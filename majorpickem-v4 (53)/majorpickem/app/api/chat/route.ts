import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tournament = searchParams.get("tournament") ?? "pga";
  const supabase = createServerSupabase();

  const { data: messages } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("tournament", tournament)
    .order("created_at", { ascending: true });

  const { data: reactions } = await supabase
    .from("chat_reactions")
    .select("*");

  return NextResponse.json({ messages: messages ?? [], reactions: reactions ?? [] });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { tournament, user_id, username, avatar_slug, message, type, metadata } = body;

  if (!message?.trim()) return NextResponse.json({ error: "Empty message" }, { status: 400 });
  if (type === "user" && message.length > 280) return NextResponse.json({ error: "Too long (280 char max)" }, { status: 400 });

  const supabase = createServerSupabase();
  const { data, error } = await supabase.from("chat_messages").insert({
    tournament: tournament ?? "pga",
    user_id: user_id ?? null,
    username: username ?? "System",
    avatar_slug: avatar_slug ?? null,
    message: message.trim(),
    type: type ?? "user",
    metadata: metadata ?? {},
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ message: data });
}
