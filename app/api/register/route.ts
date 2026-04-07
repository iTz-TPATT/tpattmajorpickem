import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createServerSupabase } from "@/lib/supabase";
import { signToken } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { username, password, inviteCode } = await request.json();

    if (!username || !password || !inviteCode) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    // Check invite code
    if (inviteCode.trim() !== process.env.INVITE_CODE) {
      return NextResponse.json({ error: "Invalid invite code" }, { status: 403 });
    }

    if (username.trim().length < 2) {
      return NextResponse.json({ error: "Name must be at least 2 characters" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const supabase = createServerSupabase();

    // Check if username already taken
    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("username", username.trim())
      .single();

    if (existing) {
      return NextResponse.json({ error: "That name is already taken" }, { status: 409 });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const { data: user, error } = await supabase
      .from("users")
      .insert({ username: username.trim(), password_hash })
      .select("id, username")
      .single();

    if (error || !user) {
      return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
    }

    const token = signToken({ userId: user.id, username: user.username });
    return NextResponse.json({ token, username: user.username });
  } catch (err) {
    console.error("Register error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
