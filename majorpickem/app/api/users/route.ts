import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";

// Public endpoint — only returns id and username (no sensitive data)
export async function GET() {
  const supabase = createServerSupabase();
  const { data: users } = await supabase
    .from("users")
    .select("id, username")
    .order("username");
  return NextResponse.json({ users: users ?? [] });
}
