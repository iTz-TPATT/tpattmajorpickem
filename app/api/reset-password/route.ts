import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createServerSupabase } from "@/lib/supabase";
import { signToken } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { username, newPassword, resetCode } = await request.json();
    if (!username || !newPassword || !resetCode) return NextResponse.json({ error: "All fields required" }, { status: 400 });
    if (resetCode.trim() !== process.env.RESET_CODE) return NextResponse.json({ error: "Invalid reset code" }, { status: 403 });
    if (newPassword.length < 6) return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });

    const supabase = createServerSupabase();
    const { data: user } = await supabase.from("users").select("id, username").eq("username", username.trim()).single();
    if (!user) return NextResponse.json({ error: "No account found with that name" }, { status: 404 });

    await supabase.from("users").update({ password_hash: await bcrypt.hash(newPassword, 10) }).eq("id", user.id);
    return NextResponse.json({ token: signToken({ userId: user.id, username: user.username }), username: user.username });
  } catch { return NextResponse.json({ error: "Server error" }, { status: 500 }); }
}
