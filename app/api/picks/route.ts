import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";
import { getTokenFromHeader } from "@/lib/auth";
import { TOURNAMENTS, TournamentId, isRoundRevealed, getCurrentRound } from "@/lib/tournaments";

async function getAdminOverrides(supabase: ReturnType<typeof createServerSupabase>) {
  const { data } = await supabase
    .from("score_cache")
    .select("data")
    .eq("tournament", "admin_overrides")
    .single();
  return (data?.data ?? {}) as Record<string, unknown>;
}

export async function GET(request: Request) {
  const user = getTokenFromHeader(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const tournamentId = (searchParams.get("tournament") ?? "masters") as TournamentId;
  const tournament = TOURNAMENTS[tournamentId];
  if (!tournament) return NextResponse.json({ error: "Bad tournament" }, { status: 400 });

  const supabase = createServerSupabase();
  const overrides = await getAdminOverrides(supabase);

  const { data: picks, error } = await supabase
    .from("picks")
    .select("username, user_id, round_number, golfer, created_at")
    .eq("tournament", tournamentId)
    .order("round_number");

  if (error) return NextResponse.json({ error: "DB error" }, { status: 500 });

  const filtered = (picks ?? []).filter((p) => {
    if (p.user_id === user.userId) return true;
    // Admin reveal override — show all picks regardless of time
    if (overrides.revealAll) return true;
    return isRoundRevealed(tournament, p.round_number);
  });

  return NextResponse.json({ picks: filtered });
}

export async function POST(request: Request) {
  const user = getTokenFromHeader(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as { tournament: string; round: number; golfers: string[] };
  const { tournament: tid, round, golfers } = body;

  if (!tid || !round || !Array.isArray(golfers) || golfers.length !== 3) {
    return NextResponse.json({ error: "Must pick exactly 3 golfers" }, { status: 400 });
  }

  const tournament = TOURNAMENTS[tid as TournamentId];
  if (!tournament) return NextResponse.json({ error: "Invalid tournament" }, { status: 400 });

  const supabase = createServerSupabase();
  const overrides = await getAdminOverrides(supabase);

  // Allow picking for any round whose deadline hasn't passed yet.
  // This means: during R1, players can already submit R2 picks.
  // Admin skipDeadline override bypasses all deadline checks.
  const deadlinePassed = !overrides.skipDeadline && isRoundRevealed(tournament, round);
  if (deadlinePassed) {
    return NextResponse.json({ error: "Pick deadline has passed for this round" }, { status: 400 });
  }

  // If admin has set a round override, only allow that specific round
  if (overrides.roundOverride && round !== (overrides.roundOverride as number)) {
    return NextResponse.json({ error: `Admin has locked picks to Round ${overrides.roundOverride}` }, { status: 400 });
  }

  // Check burned golfers
  if (round > 1) {
    const { data: prev } = await supabase
      .from("picks")
      .select("golfer")
      .eq("user_id", user.userId)
      .eq("tournament", tid)
      .lt("round_number", round);

    const burned = new Set((prev ?? []).map((p) => p.golfer));
    const conflict = golfers.find((g) => burned.has(g));
    if (conflict) {
      return NextResponse.json({ error: `${conflict} was already used in a previous round` }, { status: 400 });
    }
  }

  if (new Set(golfers).size !== 3) {
    return NextResponse.json({ error: "Cannot pick the same golfer twice" }, { status: 400 });
  }

  await supabase.from("picks").delete()
    .eq("user_id", user.userId).eq("tournament", tid).eq("round_number", round);

  const { error } = await supabase.from("picks").insert(
    golfers.map((golfer) => ({
      user_id: user.userId, username: user.username,
      tournament: tid, round_number: round, golfer,
    }))
  );

  if (error) return NextResponse.json({ error: "Failed to save picks" }, { status: 500 });
  return NextResponse.json({ success: true });
}
