import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createServerSupabase } from "@/lib/supabase";
import { signToken } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();
    if (!username || !password) return NextResponse.json({ error: "All fields required" }, { status: 400 });

    const supabase = createServerSupabase();
    const { data: user } = await supabase
      .from("users").select("id, username, password_hash").eq("username", username.trim()).single();

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

    return NextResponse.json({ token: signToken({ userId: user.id, username: user.username }), username: user.username });
  } catch { return NextResponse.json({ error: "Server error" }, { status: 500 }); }
}
