import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";
import { TOURNAMENTS, TournamentId, isTournamentComplete, calcRoundScore, isRoundRevealed } from "@/lib/tournaments";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tid = (searchParams.get("tournament") ?? "masters") as TournamentId;
  const year = parseInt(searchParams.get("year") ?? "2026");

  const supabase = createServerSupabase();

  // Check for stored champion
  const { data: stored } = await supabase
    .from("champions")
    .select("champion_name, year")
    .eq("tournament", tid)
    .eq("year", year)
    .single();

  if (stored) {
    return NextResponse.json({ champion: stored.champion_name, year: stored.year });
  }

  // If 2026 tournament is complete, compute from picks + scores
  const tournament = TOURNAMENTS[tid];
  if (tournament && isTournamentComplete(tournament)) {
    // Get all picks
    const { data: picks } = await supabase
      .from("picks")
      .select("username, user_id, round_number, golfer")
      .eq("tournament", tid);

    // Get cached scores
    const { data: scoreCache } = await supabase
      .from("score_cache")
      .select("data")
      .eq("tournament", `scores_${tid}`)
      .single();

    if (picks && scoreCache) {
      const scores = scoreCache.data as Record<string, unknown>[];
      const scoreMap: Record<string, Record<number, number | null>> = {};
      for (const s of scores) {
        const g = s as { name: string; r1: number|null; r2: number|null; r3: number|null; r4: number|null };
        scoreMap[g.name] = { 1: g.r1, 2: g.r2, 3: g.r3, 4: g.r4 };
      }

      // Compute each user's total
      const userTotals: Record<string, { username: string; total: number }> = {};
      const userMap: Record<string, string> = {};
      for (const p of picks) {
        userMap[p.user_id] = p.username;
        if (!userTotals[p.user_id]) userTotals[p.user_id] = { username: p.username, total: 0 };
      }

      for (let r = 1; r <= 4; r++) {
        if (!isRoundRevealed(tournament, r)) continue;
        const roundPicks = picks.filter((p) => p.round_number === r);
        const byUser: Record<string, string[]> = {};
        for (const p of roundPicks) {
          if (!byUser[p.user_id]) byUser[p.user_id] = [];
          byUser[p.user_id].push(p.golfer);
        }
        for (const [uid, golfers] of Object.entries(byUser)) {
          const roundScores = golfers.map((g) => scoreMap[g]?.[r as 1|2|3|4] ?? null);
          userTotals[uid].total += calcRoundScore(roundScores, r);
        }
      }

      const sorted = Object.values(userTotals).sort((a, b) => a.total - b.total);
      if (sorted.length > 0) {
        const winner = sorted[0].username;
        // Store it
        await supabase.from("champions").upsert({ tournament: tid, year: 2026, champion_name: winner });
        return NextResponse.json({ champion: winner, year: 2026 });
      }
    }
  }

  return NextResponse.json({ champion: null });
}
