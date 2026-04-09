import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";

const CACHE_MS = 2 * 60 * 1000;

export interface GolferScore {
  name: string; espnId: string; headshot: string | null;
  totalScore: number; position: string; status: string;
  r1: number | null; r2: number | null; r3: number | null; r4: number | null;
  teeTime: string | null;
  thru: string | null;
}

const PAR: Record<string, number> = {
  masters: 72, pga: 70, usopen: 70, theopen: 71,
};

/**
 * Convert a raw ESPN score string to a to-par integer.
 *
 * ESPN linescores[n].value can be:
 *   "68"   → raw strokes  → to-par = 68 − 72 = −4
 *   "-4"   → already to-par
 *   "+2"   → already to-par
 *   "E"    → even par     → 0
 *   "--"   → not played   → null
 *
 * We determine which by: raw strokes are always > 50; to-par scores
 * for PGA players are always in the range [−15, +25] per round.
 */
function toParFromString(val: string | undefined | null, par: number): number | null {
  if (!val || val === "--" || val === "") return null;
  if (val === "E") return 0;

  // parseInt handles "+2" → 2, "-4" → -4, "68" → 68
  const n = parseInt(val, 10);
  if (isNaN(n)) return null;

  // Raw strokes are always > 50 (no one shoots a 50 in PGA).
  // To-par values per round are always < 30.
  // Multi-round cumulative to-par rarely exceeds ±30.
  return n > 50 ? n - par : n;
}

function parseESPN(data: unknown, tournamentId = "masters"): GolferScore[] {
  const par = PAR[tournamentId] ?? 72;
  const players: GolferScore[] = [];

  try {
    const d = data as Record<string, unknown>;
    const event = ((d.events as unknown[])?.[0]) as Record<string, unknown> | undefined;
    if (!event) return players;
    const comps = ((event.competitions as unknown[])?.[0] as Record<string, unknown>)?.competitors as unknown[];
    if (!comps) return players;

    for (const raw of comps) {
      const comp = raw as Record<string, unknown>;
      const athlete = (comp.athlete as Record<string, unknown>) ?? {};
      const statusObj = (comp.status as Record<string, unknown>) ?? {};
      const statusType = ((statusObj.type as Record<string, unknown>)?.name as string ?? "active").toLowerCase();
      const linescores = (comp.linescores as Record<string, unknown>[]) ?? [];

      // --- Parse individual round scores ---
      // Try displayValue first (ESPN sometimes puts to-par here), then value.
      // Both go through toParFromString which handles raw strokes vs to-par.
      const rounds: Record<number, number | null> = { 1: null, 2: null, 3: null, 4: null };
      linescores.forEach((ls, i) => {
        const dv = ls.displayValue as string | undefined;
        const v  = ls.value      as string | undefined;
        // Use whichever field gives a non-null result
        rounds[i + 1] = toParFromString(dv, par) ?? toParFromString(v, par) ?? null;
      });

      // --- Parse cumulative total score ---
      // comp.score is the official cumulative to-par ("-8", "E", "+2").
      // On some endpoints it can be raw total strokes ("280") — detect by size.
      const rawScore = (comp.score as string ?? "").trim();
      let totalScore = 0;
      if (rawScore === "" || rawScore === "--") {
        // Not yet played — derive from rounds if any exist
        totalScore = (Object.values(rounds).filter(r => r !== null) as number[])
          .reduce((s, r) => s + r, 0);
      } else if (rawScore === "E") {
        totalScore = 0;
      } else {
        const n = parseInt(rawScore, 10);
        if (!isNaN(n)) {
          if (n > 50) {
            // Raw total strokes — subtract par × rounds played
            const played = Object.values(rounds).filter(r => r !== null).length;
            totalScore = played > 0 ? n - par * played : 0;
          } else {
            totalScore = n;
          }
        }
      }

      // --- Tee time ---
      let teeTime: string | null = null;
      const startDate = comp.startDate as string | undefined;
      if (startDate) {
        try {
          teeTime = new Date(startDate).toLocaleTimeString("en-US", {
            timeZone: "America/New_York",
            hour: "numeric", minute: "2-digit", hour12: true,
          });
        } catch { /* ignore */ }
      }
      if (!teeTime && comp.teeTime) teeTime = comp.teeTime as string;

      // --- Thru ---
      const thru = statusObj.thru as string | number | undefined;

      players.push({
        name: (athlete.displayName as string) ?? "",
        espnId: String(athlete.id ?? ""),
        headshot: (athlete.headshot as Record<string, unknown>)?.href as string ?? null,
        totalScore,
        position: (statusObj.position as Record<string, unknown>)?.displayName as string
          ?? statusObj.displayValue as string ?? "",
        status: statusType.includes("cut") ? "cut" : statusType.includes("wd") ? "wd" : "active",
        r1: rounds[1], r2: rounds[2], r3: rounds[3], r4: rounds[4],
        teeTime,
        thru: thru != null ? String(thru) : null,
      });
    }
  } catch (e) { console.error("ESPN parse error:", e); }
  return players;
}

async function fetchFromESPN(tournamentId = "masters"): Promise<GolferScore[]> {
  const urls = [
    "https://site.api.espn.com/apis/site/v2/sports/golf/leaderboard?league=pga&event=401811941",
    "https://site.api.espn.com/apis/site/v2/sports/golf/leaderboard?league=pga",
    "https://site.api.espn.com/apis/site/v2/sports/golf/pga/leaderboard",
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
      if (!res.ok) continue;
      const parsed = parseESPN(await res.json(), tournamentId);
      if (parsed.length > 0) return parsed;
    } catch { continue; }
  }
  return [];
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tournament = searchParams.get("tournament") ?? "masters";
  const debug = searchParams.get("debug") === "1";
  const supabase = createServerSupabase();

  // Admin manual scores override
  const { data: adminCache } = await supabase
    .from("score_cache").select("data").eq("tournament", "admin_overrides").single();
  const adminOverrides = (adminCache?.data ?? {}) as Record<string, unknown>;

  if (adminOverrides.useManualScores) {
    const { data: manualScores } = await supabase
      .from("score_cache").select("data").eq("tournament", `manual_scores_${tournament}`).single();
    const manualData = manualScores?.data as unknown[] | null;
    // Only use manual scores if they actually contain data
    if (manualData && Array.isArray(manualData) && manualData.length > 0) {
      if (debug) return NextResponse.json({ scores: manualData, source: "manual", count: manualData.length });
      return NextResponse.json({ scores: manualData, source: "manual" });
    }
    // Manual mode is on but no scores saved — fall through to ESPN
    if (debug) console.log("useManualScores=true but manual scores are empty — falling through to ESPN");
  }

  // Cache check
  const { data: cached } = await supabase
    .from("score_cache").select("data, updated_at").eq("tournament", `scores_${tournament}`).single();

  if (cached && !debug) {
    const age = Date.now() - new Date(cached.updated_at as string).getTime();
    if (age < CACHE_MS) {
      const cachedData = cached.data as unknown[];
      if (cachedData?.length > 0) {
        return NextResponse.json({ scores: cachedData, source: "cache" });
      }
    }
  }

  const scores = await fetchFromESPN(tournament);
  if (scores.length > 0) {
    await supabase.from("score_cache").upsert({
      tournament: `scores_${tournament}`,
      data: scores,
      updated_at: new Date().toISOString(),
    });
    if (debug) return NextResponse.json({ scores, source: "espn", count: scores.length, sample: scores.slice(0, 2) });
    return NextResponse.json({ scores, source: "espn" });
  }

  // ESPN returned nothing — return stale cache rather than empty
  if (cached?.data) {
    if (debug) return NextResponse.json({ scores: cached.data, source: "stale", warning: "ESPN returned 0 players — serving stale cache" });
    return NextResponse.json({ scores: cached.data, source: "stale" });
  }
  if (debug) return NextResponse.json({ scores: [], source: "empty", warning: "ESPN returned 0 players and no cache exists" });
  return NextResponse.json({ scores: [], source: "empty" });
}
