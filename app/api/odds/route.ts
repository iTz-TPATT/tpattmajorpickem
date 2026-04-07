import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";
import { TOURNAMENTS, TournamentId } from "@/lib/tournaments";

const CACHE_MS = 60 * 60 * 1000; // 1 hour

function fmtAmericanOdds(n: number): string {
  if (n === undefined || n === null) return "";
  return n > 0 ? `+${n}` : `${n}`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tournamentId = (searchParams.get("tournament") ?? "masters") as TournamentId;
  const tournament = TOURNAMENTS[tournamentId];
  if (!tournament) return NextResponse.json({ odds: {} });

  const supabase = createServerSupabase();
  const cacheKey = `odds_${tournamentId}`;

  // Check cache
  const { data: cached } = await supabase
    .from("score_cache")
    .select("data, updated_at")
    .eq("tournament", cacheKey)
    .single();

  if (cached) {
    const age = Date.now() - new Date(cached.updated_at as string).getTime();
    if (age < CACHE_MS) return NextResponse.json({ odds: cached.data });
  }

  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return NextResponse.json({ odds: cached?.data ?? {} });

  try {
    const url = `https://api.the-odds-api.com/v4/sports/${tournament.oddsKey}/odds/?apiKey=${apiKey}&regions=us&markets=h2h&oddsFormat=american`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Odds API ${res.status}`);

    const data = await res.json() as unknown[];
    const oddsMap: Record<string, string> = {};

    for (const game of data) {
      const g = game as Record<string, unknown>;
      const bookmakers = (g.bookmakers as unknown[]) ?? [];
      const bookmaker = bookmakers[0] as Record<string, unknown>;
      if (!bookmaker) continue;
      const markets = (bookmaker.markets as unknown[]) ?? [];
      const market = markets[0] as Record<string, unknown>;
      if (!market) continue;
      for (const o of (market.outcomes as unknown[]) ?? []) {
        const outcome = o as Record<string, unknown>;
        if (!oddsMap[outcome.name as string]) {
          oddsMap[outcome.name as string] = fmtAmericanOdds(outcome.price as number);
        }
      }
      break;
    }

    await supabase.from("score_cache").upsert({
      tournament: cacheKey,
      data: oddsMap,
      updated_at: new Date().toISOString(),
    });

    return NextResponse.json({ odds: oddsMap });
  } catch (err) {
    console.error("Odds error:", err);
    return NextResponse.json({ odds: cached?.data ?? {} });
  }
}
