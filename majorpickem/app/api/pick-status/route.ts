import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";
import { getTokenFromHeader } from "@/lib/auth";
import { TournamentId } from "@/lib/tournaments";

// Returns pick STATUS only (who has submitted for which round) — NOT what they picked.
// Used to show green checkmarks on the leaderboard before picks are revealed.
export async function GET(request: Request) {
  const user = getTokenFromHeader(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const tournamentId = (searchParams.get("tournament") ?? "masters") as TournamentId;

  const supabase = createServerSupabase();

  // Fetch user_id + round_number only — no golfer names exposed
  const { data, error } = await supabase
    .from("picks")
    .select("user_id, round_number")
    .eq("tournament", tournamentId);

  if (error) return NextResponse.json({ error: "DB error" }, { status: 500 });

  // Build map: { [userId]: Set<roundNumber> }
  // Return as { [userId]: [1, 2, ...] }
  const statusMap: Record<string, number[]> = {};
  for (const row of data ?? []) {
    if (!statusMap[row.user_id]) statusMap[row.user_id] = [];
    if (!statusMap[row.user_id].includes(row.round_number)) {
      statusMap[row.user_id].push(row.round_number);
    }
  }

  return NextResponse.json({ status: statusMap });
}
