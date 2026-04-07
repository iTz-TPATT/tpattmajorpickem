import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";
import { getTokenFromHeader } from "@/lib/auth";
import { isRoundRevealed, getCurrentRound } from "@/lib/rounds";

// GET /api/picks — returns picks visible to the authenticated user
export async function GET(request: Request) {
  const user = getTokenFromHeader(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServerSupabase();

  const { data: picks, error } = await supabase
    .from("picks")
    .select("username, user_id, round_number, golfer, created_at")
    .order("round_number", { ascending: true });

  if (error) return NextResponse.json({ error: "Failed to fetch picks" }, { status: 500 });

  // Filter: for each round, only return other users' picks if that round is revealed.
  // Always return the current user's own picks.
  const filtered = (picks ?? []).filter((p) => {
    if (p.user_id === user.userId) return true; // always show own picks
    return isRoundRevealed(p.round_number);
  });

  return NextResponse.json({ picks: filtered });
}

// POST /api/picks — save picks for the current round
export async function POST(request: Request) {
  const user = getTokenFromHeader(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { round, golfers } = await request.json() as { round: number; golfers: string[] };

  if (!round || !Array.isArray(golfers) || golfers.length !== 3) {
    return NextResponse.json({ error: "Must pick exactly 3 golfers" }, { status: 400 });
  }

  const currentRound = getCurrentRound();
  if (round !== currentRound) {
    return NextResponse.json({ error: "Can only pick for the current round" }, { status: 400 });
  }

  if (isRoundRevealed(round)) {
    return NextResponse.json({ error: "Pick deadline has passed for this round" }, { status: 400 });
  }

  const supabase = createServerSupabase();

  // Delete existing picks for this user/round, then insert new ones
  await supabase
    .from("picks")
    .delete()
    .eq("user_id", user.userId)
    .eq("round_number", round);

  const rows = golfers.map((golfer) => ({
    user_id: user.userId,
    username: user.username,
    round_number: round,
    golfer,
  }));

  const { error } = await supabase.from("picks").insert(rows);

  if (error) return NextResponse.json({ error: "Failed to save picks" }, { status: 500 });

  return NextResponse.json({ success: true });
}
