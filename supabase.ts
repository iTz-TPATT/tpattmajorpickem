import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";
import { TOURNAMENTS, TournamentId } from "@/lib/tournaments";

const CACHE_MS = 60 * 60 * 1000; // 1 hour

function fmtAmericanOdds(n: number): string {
  if (n === undefined || n === null || isNaN(n)) return "";
  return n > 0 ? `+${n}` : `${n}`;
}

// The Odds API sport keys to try in order for each tournament
const ODDS_SPORT_KEYS: Record<string, string[]> = {
  masters: [
    "golf_masters_tournament_winner",
    "golf_pga_championship_winner", // fallback during off-week
  ],
  pga: [
    "golf_pga_championship_winner",
  ],
  usopen: [
    "golf_us_open_winner",
    "golf_us_open_championship_winner",
  ],
  theopen: [
    "golf_the_open_championship_winner",
    "golf_british_open_championship_winner",
  ],
};


// Normalize player names for fuzzy matching
// Handles "Rory McIlroy" vs "Rory Mcilroy", accents, etc.
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents (Åberg -> Aberg)
    .replace(/[^a-z\s]/g, "")          // remove non-alpha
    .replace(/\s+/g, " ")
    .trim();
}

// Build a normalized odds map so player name differences don't break lookup
function buildNormalizedOddsMap(raw: Record<string, string>): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [name, odds] of Object.entries(raw)) {
    normalized[normalizeName(name)] = odds;
  }
  return normalized;
}

async function fetchOddsFromAPI(apiKey: string, tournamentId: string): Promise<Record<string, string>> {
  const sportKeys = ODDS_SPORT_KEYS[tournamentId] ?? [TOURNAMENTS[tournamentId as TournamentId]?.oddsKey];

  for (const sportKey of sportKeys) {
    try {
      const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/?apiKey=${apiKey}&regions=us&markets=outrights&oddsFormat=american`;
      const res = await fetch(url, { cache: "no-store" });

      if (res.status === 404) continue; // Sport key not found, try next
      if (!res.ok) {
        console.error(`Odds API error for ${sportKey}: ${res.status}`);
        continue;
      }

      const data = await res.json() as unknown[];
      if (!Array.isArray(data) || data.length === 0) continue;

      const oddsMap: Record<string, string> = {};

      // Outrights market — each "game" is actually a list of outcomes (one per player)
      for (const event of data) {
        const e = event as Record<string, unknown>;
        const bookmakers = (e.bookmakers as unknown[]) ?? [];

        // Prefer DraftKings, then FanDuel, then first available
        const preferred = ["draftkings", "fanduel", "betmgm", "williamhill_us"];
        let bookmaker = bookmakers.find((b) => {
          const bk = b as Record<string, unknown>;
          return preferred.includes((bk.key as string) ?? "");
        }) as Record<string, unknown> | undefined;

        if (!bookmaker) bookmaker = bookmakers[0] as Record<string, unknown>;
        if (!bookmaker) continue;

        const markets = (bookmaker.markets as unknown[]) ?? [];
        const market = markets[0] as Record<string, unknown>;
        if (!market) continue;

        for (const o of (market.outcomes as unknown[]) ?? []) {
          const outcome = o as Record<string, unknown>;
          const name = outcome.name as string;
          const price = outcome.price as number;
          if (name && price !== undefined && !oddsMap[name]) {
            oddsMap[name] = fmtAmericanOdds(price);
          }
        }
      }

      if (Object.keys(oddsMap).length > 0) {
        console.log(`Odds loaded from ${sportKey}: ${Object.keys(oddsMap).length} players`);
        // Also add normalized name entries so lookups work regardless of casing/accents
        for (const [name, odds] of Object.entries(oddsMap)) {
          const norm = normalizeName(name);
          if (!oddsMap[norm]) oddsMap[norm] = odds;
        }
        return oddsMap;
      }
    } catch (err) {
      console.error(`Odds fetch error for ${sportKey}:`, err);
      continue;
    }
  }

  return {};
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tournamentId = (searchParams.get("tournament") ?? "masters") as TournamentId;
  const debug = searchParams.get("debug") === "1";

  const tournament = TOURNAMENTS[tournamentId];
  if (!tournament) return NextResponse.json({ odds: {} });

  const supabase = createServerSupabase();
  const cacheKey = `odds_${tournamentId}`;

  // Check cache first
  const { data: cached } = await supabase
    .from("score_cache")
    .select("data, updated_at")
    .eq("tournament", cacheKey)
    .single();

  if (cached && !debug) {
    const age = Date.now() - new Date(cached.updated_at as string).getTime();
    if (age < CACHE_MS) {
      return NextResponse.json({ odds: cached.data, source: "cache" });
    }
  }

  const apiKey = process.env.ODDS_API_KEY;

  if (!apiKey) {
    console.warn("ODDS_API_KEY not set — odds will be empty");
    return NextResponse.json({
      odds: cached?.data ?? {},
      source: "no_api_key",
    });
  }

  const oddsMap = await fetchOddsFromAPI(apiKey, tournamentId);

  if (Object.keys(oddsMap).length > 0) {
    await supabase.from("score_cache").upsert({
      tournament: cacheKey,
      data: oddsMap,
      updated_at: new Date().toISOString(),
    });
    return NextResponse.json({ odds: oddsMap, source: "live" });
  }

  // Return stale cache if live fetch returned nothing
  return NextResponse.json({
    odds: cached?.data ?? {},
    source: Object.keys(cached?.data ?? {}).length > 0 ? "stale_cache" : "empty",
  });
}
