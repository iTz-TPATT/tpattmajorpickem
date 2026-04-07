import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";

// Known ESPN IDs as a fast-path cache for top players
const KNOWN_ESPN_IDS: Record<string, string> = {
  "Scottie Scheffler": "4686091",
  "Rory McIlroy": "3470",
  "Jon Rahm": "3470580",
  "Xander Schauffele": "4001571",
  "Ludvig Åberg": "4874390",
  "Collin Morikawa": "4238909",
  "Viktor Hovland": "4393021",
  "Tommy Fleetwood": "3706348",
  "Brooks Koepka": "3228",
  "Justin Thomas": "4008612",
  "Patrick Cantlay": "3232272",
  "Will Zalatoris": "4050045",
  "Shane Lowry": "3340",
  "Tony Finau": "3024",
  "Hideki Matsuyama": "4563",
  "Max Homa": "2154",
  "Russell Henley": "5765",
  "Adam Scott": "952",
  "Cameron Smith": "4233606",
  "Dustin Johnson": "4571",
  "Bryson DeChambeau": "3232175",
  "Jordan Spieth": "5548",
  "Matt Fitzpatrick": "3700614",
  "Tyrrell Hatton": "3706354",
  "Robert MacIntyre": "4687249",
  "Tom Kim": "4874037",
  "Sahith Theegala": "4238937",
  "Sungjae Im": "4030168",
  "Akshay Bhatia": "4874409",
  "Min Woo Lee": "4691060",
};

const ESPN_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json",
  "Origin": "https://www.espn.com",
  "Referer": "https://www.espn.com/",
};

// Search ESPN for a player by name and return their athlete ID
async function lookupEspnId(playerName: string): Promise<string | null> {
  try {
    const encoded = encodeURIComponent(playerName);
    const url = `https://site.api.espn.com/apis/site/v2/sports/golf/pga/athletes?search=${encoded}&limit=5`;
    const res = await fetch(url, { headers: ESPN_HEADERS, cache: "no-store" });
    if (!res.ok) return null;

    const data = await res.json() as Record<string, unknown>;
    const items = (data.items as unknown[]) ?? (data.athletes as unknown[]) ?? [];

    for (const item of items) {
      const a = item as Record<string, unknown>;
      const name = (a.displayName ?? a.fullName ?? a.name ?? "") as string;
      // Case-insensitive name match
      if (name.toLowerCase() === playerName.toLowerCase()) {
        return String(a.id ?? "");
      }
    }

    // If no exact match, return first result
    if (items.length > 0) {
      const first = items[0] as Record<string, unknown>;
      return String(first.id ?? "");
    }
  } catch {
    return null;
  }
  return null;
}

interface StatResult {
  "Scoring Avg"?: string;
  "Driving Distance"?: string;
  "Fairways Hit"?: string;
  "GIR %"?: string;
  "Putts/Round"?: string;
  "World Rank"?: string;
}

async function fetchESPNStats(espnId: string): Promise<StatResult | null> {
  const urls = [
    `https://site.api.espn.com/apis/site/v2/sports/golf/pga/athletes/${espnId}/statistics`,
    `https://site.api.espn.com/apis/common/v3/sports/golf/pga/athletes/${espnId}/statisticslog`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: ESPN_HEADERS, cache: "no-store" });
      if (!res.ok) continue;
      const data = await res.json() as Record<string, unknown>;
      const result: StatResult = {};

      const splits = data.splits as Record<string, unknown> | undefined;
      const categories = (splits?.categories as unknown[]) ?? (data.categories as unknown[]) ?? [];

      const statNameMap: Record<string, keyof StatResult> = {
        scoringAverage: "Scoring Avg",
        scoring_average: "Scoring Avg",
        drivingDistance: "Driving Distance",
        driving_distance: "Driving Distance",
        drivingAccuracy: "Fairways Hit",
        driving_accuracy: "Fairways Hit",
        greensInRegulation: "GIR %",
        greens_in_regulation: "GIR %",
        puttingAverage: "Putts/Round",
        putting_average: "Putts/Round",
        worldRanking: "World Rank",
        world_ranking: "World Rank",
      };

      for (const cat of categories) {
        const c = cat as Record<string, unknown>;
        for (const s of (c.stats as unknown[]) ?? []) {
          const stat = s as Record<string, unknown>;
          const name = (stat.name ?? stat.abbreviation ?? "") as string;
          const label = statNameMap[name];
          if (label && stat.displayValue) result[label] = stat.displayValue as string;
        }
      }

      const athlete = data.athlete as Record<string, unknown> | undefined;
      if (athlete?.rank) result["World Rank"] = `#${athlete.rank}`;

      if (Object.keys(result).length > 0) return result;
    } catch { continue; }
  }
  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  let espnId = searchParams.get("espnId") ?? "";
  const playerName = searchParams.get("name") ?? "";

  // 1. Try the known fast-path ID map first
  if ((!espnId || espnId === "undefined" || espnId === "0") && playerName) {
    espnId = KNOWN_ESPN_IDS[playerName] ?? "";
  }

  // 2. If still no ID, check Supabase cache for previously looked-up IDs
  const supabase = createServerSupabase();
  if (!espnId && playerName) {
    const cacheKey = `espnid_${playerName.toLowerCase().replace(/\s+/g, "_")}`;
    const { data: cached } = await supabase
      .from("score_cache")
      .select("data")
      .eq("tournament", cacheKey)
      .single();

    if (cached?.data) {
      espnId = (cached.data as Record<string, string>).espnId ?? "";
    }
  }

  // 3. If still no ID, do a live ESPN search by name and cache the result
  if (!espnId && playerName) {
    const found = await lookupEspnId(playerName);
    if (found) {
      espnId = found;
      // Cache it so we don't search again
      const cacheKey = `espnid_${playerName.toLowerCase().replace(/\s+/g, "_")}`;
      await supabase.from("score_cache").upsert({
        tournament: cacheKey,
        data: { espnId: found, name: playerName },
        updated_at: new Date().toISOString(),
      });
    }
  }

  if (!espnId) {
    return NextResponse.json({ stats: null, reason: "player_not_found" });
  }

  // 4. Fetch and return stats
  try {
    const stats = await fetchESPNStats(espnId);
    return NextResponse.json({ stats });
  } catch {
    return NextResponse.json({ stats: null, reason: "fetch_error" });
  }
}
