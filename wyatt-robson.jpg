import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";
import { getTokenFromHeader } from "@/lib/auth";

export async function GET(request: Request) {
  const user = getTokenFromHeader(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServerSupabase();
  const { data: users } = await supabase
    .from("users")
    .select("id, username")
    .order("username");

  return NextResponse.json({ users: users ?? [] });
}
