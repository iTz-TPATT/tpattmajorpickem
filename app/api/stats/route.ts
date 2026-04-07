import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";

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
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "Origin": "https://www.espn.com",
  "Referer": "https://www.espn.com/golf/",
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-site",
};

interface StatResult {
  "Scoring Avg"?: string;
  "Driving Distance"?: string;
  "Fairways Hit"?: string;
  "GIR %"?: string;
  "Putts/Round"?: string;
  "World Rank"?: string;
  "Wins"?: string;
}

const STAT_NAME_MAP: Record<string, keyof StatResult> = {
  scoringAverage: "Scoring Avg",
  scoring_average: "Scoring Avg",
  scoringavg: "Scoring Avg",
  "Scoring Average": "Scoring Avg",
  drivingDistance: "Driving Distance",
  driving_distance: "Driving Distance",
  "Driving Distance": "Driving Distance",
  drivingAccuracy: "Fairways Hit",
  driving_accuracy: "Fairways Hit",
  "Driving Accuracy": "Fairways Hit",
  greensInRegulation: "GIR %",
  greens_in_regulation: "GIR %",
  "Greens in Regulation": "GIR %",
  puttingAverage: "Putts/Round",
  putting_average: "Putts/Round",
  "Putting Average": "Putts/Round",
  worldRanking: "World Rank",
  world_ranking: "World Rank",
  "World Ranking": "World Rank",
  wins: "Wins",
  "Wins": "Wins",
};

function parseStatsFromData(data: Record<string, unknown>): StatResult {
  const result: StatResult = {};

  // Path 1: splits.categories[].stats[]
  const splits = data.splits as Record<string, unknown> | undefined;
  const cats1 = (splits?.categories as unknown[]) ?? [];

  // Path 2: top-level categories[]
  const cats2 = (data.categories as unknown[]) ?? [];

  // Path 3: statistics[]
  const cats3 = (data.statistics as unknown[]) ?? [];

  // Path 4: athlete.statistics
  const athleteStats = ((data.athlete as Record<string, unknown>)?.statistics as unknown[]) ?? [];

  const allCats = [...cats1, ...cats2, ...cats3, ...athleteStats];

  for (const cat of allCats) {
    const c = cat as Record<string, unknown>;
    const statsArr = (c.stats ?? c.leaders ?? c.values ?? c.statistics ?? []) as unknown[];
    for (const s of statsArr) {
      const stat = s as Record<string, unknown>;
      const nameKey = (stat.name ?? stat.abbreviation ?? stat.displayName ?? stat.label ?? "") as string;
      const label = STAT_NAME_MAP[nameKey];
      if (label && stat.displayValue && !result[label]) {
        result[label] = stat.displayValue as string;
      }
      // Also check value directly
      if (label && stat.value !== undefined && !result[label]) {
        result[label] = String(stat.value);
      }
    }
  }

  // World rank from top-level athlete object
  const athlete = data.athlete as Record<string, unknown> | undefined;
  if (athlete?.rank && !result["World Rank"]) {
    result["World Rank"] = `#${athlete.rank}`;
  }
  if (athlete?.displayRank && !result["World Rank"]) {
    result["World Rank"] = String(athlete.displayRank);
  }

  return result;
}

async function tryFetch(url: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(url, {
      headers: ESPN_HEADERS,
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return await res.json() as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function fetchStats(espnId: string): Promise<StatResult | null> {
  // Try every known ESPN stats URL format
  const urls = [
    // Current ESPN athlete stats endpoint
    `https://site.api.espn.com/apis/site/v2/sports/golf/pga/athletes/${espnId}/statistics`,
    // Common v3 endpoint
    `https://site.api.espn.com/apis/common/v3/sports/golf/pga/athletes/${espnId}/statistics`,
    // Stats log (season breakdown)
    `https://sports.core.api.espn.com/v2/sports/golf/leagues/pga/seasons/2025/athletes/${espnId}/statistics/0`,
    // Current season
    `https://sports.core.api.espn.com/v2/sports/golf/leagues/pga/seasons/2026/athletes/${espnId}/statistics/0`,
    // Athlete overview (often includes stats)
    `https://site.api.espn.com/apis/site/v2/sports/golf/pga/athletes/${espnId}`,
  ];

  for (const url of urls) {
    const data = await tryFetch(url);
    if (!data) continue;

    const result = parseStatsFromData(data);
    if (Object.keys(result).length > 0) return result;
  }

  return null;
}

async function lookupEspnId(playerName: string): Promise<string | null> {
  const urls = [
    `https://site.api.espn.com/apis/site/v2/sports/golf/pga/athletes?search=${encodeURIComponent(playerName)}&limit=5`,
    `https://site.api.espn.com/apis/search/v2?query=${encodeURIComponent(playerName)}&sport=golf&limit=5`,
  ];

  for (const url of urls) {
    const data = await tryFetch(url);
    if (!data) continue;

    const items = (data.items ?? data.athletes ?? data.results ?? []) as unknown[];
    for (const item of items) {
      const a = item as Record<string, unknown>;
      const name = (a.displayName ?? a.fullName ?? a.name ?? a.title ?? "") as string;
      if (name.toLowerCase().includes(playerName.toLowerCase().split(" ")[1] ?? playerName.toLowerCase())) {
        const id = String(a.id ?? a.uid ?? "").replace(/[^0-9]/g, "");
        if (id) return id;
      }
    }
  }
  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  let espnId = searchParams.get("espnId") ?? "";
  const playerName = searchParams.get("name") ?? "";
  const debug = searchParams.get("debug") === "1";

  // 1. Fast path: known IDs
  if ((!espnId || espnId === "undefined" || espnId === "0") && playerName) {
    espnId = KNOWN_ESPN_IDS[playerName] ?? "";
  }

  const supabase = createServerSupabase();

  // 2. Check Supabase cache for previously resolved IDs
  if (!espnId && playerName) {
    const cacheKey = `espnid_${playerName.toLowerCase().replace(/\s+/g, "_")}`;
    const { data: cached } = await supabase
      .from("score_cache")
      .select("data")
      .eq("tournament", cacheKey)
      .single();
    if (cached?.data) espnId = (cached.data as Record<string, string>).espnId ?? "";
  }

  // 3. Dynamic lookup
  if (!espnId && playerName) {
    const found = await lookupEspnId(playerName);
    if (found) {
      espnId = found;
      const cacheKey = `espnid_${playerName.toLowerCase().replace(/\s+/g, "_")}`;
      await supabase.from("score_cache").upsert({
        tournament: cacheKey,
        data: { espnId: found, name: playerName },
        updated_at: new Date().toISOString(),
      });
    }
  }

  if (!espnId) {
    return NextResponse.json({ stats: null, reason: "no_id", playerName, debug: debug ? "no ESPN ID found" : undefined });
  }

  // 4. Fetch stats — with debug info
  const stats = await fetchStats(espnId);

  if (debug) {
    return NextResponse.json({
      stats,
      espnId,
      playerName,
      hasStats: stats !== null && Object.keys(stats ?? {}).length > 0,
      statKeys: stats ? Object.keys(stats) : [],
    });
  }

  return NextResponse.json({ stats: stats ?? {} });
}
