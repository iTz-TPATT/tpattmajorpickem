import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";

const CACHE_MS = 2 * 60 * 1000;

export interface GolferScore {
  name: string; espnId: string; headshot: string | null;
  totalScore: number; position: string; status: string;
  r1: number | null; r2: number | null; r3: number | null; r4: number | null;
  teeTime: string | null; // e.g. "1:48 PM" local Augusta time
  thru: string | null;    // e.g. "F" or "9" or "*3"
}

// Par per tournament — used to convert raw strokes to to-par if ESPN
// doesn't return a displayValue
const TOURNAMENT_PAR: Record<string, number> = {
  masters: 72,
  pga:     70,
  usopen:  70,
  theopen: 71,
};

function parseESPN(data: unknown, tournamentId = "masters"): GolferScore[] {
  const par = TOURNAMENT_PAR[tournamentId] ?? 72;
  const players: GolferScore[] = [];
  try {
    const d = data as Record<string, unknown>;
    const events = (d.events as unknown[]) ?? [];
    if (!events.length) return players;
    const event = events[0] as Record<string, unknown>;
    const comps = ((event.competitions as unknown[])?.[0] as Record<string, unknown>)?.competitors as unknown[];
    if (!comps) return players;
    for (const raw of comps) {
      const comp = raw as Record<string, unknown>;
      const athlete = (comp.athlete as Record<string, unknown>) ?? {};
      const linescores = (comp.linescores as unknown[]) ?? [];
      const statusObj = (comp.status as Record<string, unknown>) ?? {};
      const statusType = ((statusObj.type as Record<string, unknown>)?.name as string ?? "active").toLowerCase();

      const rounds: Record<number, number | null> = { 1: null, 2: null, 3: null, 4: null };
      linescores.forEach((ls, i) => {
        const l = ls as Record<string, unknown>;

        // ESPN returns displayValue as the to-par string ("-4", "E", "+2")
        // and value as raw strokes ("68", "72").
        // Prefer displayValue; fall back to converting raw strokes with par.
        const displayVal = l.displayValue as string | undefined;
        const rawVal = l.value as string | undefined;

        let toPar: number | null = null;

        if (displayVal && displayVal !== "--" && displayVal !== "") {
          toPar = displayVal === "E" ? 0 : parseInt(displayVal) || null;
        } else if (rawVal && rawVal !== "--" && rawVal !== "") {
          const strokes = parseInt(rawVal);
          if (!isNaN(strokes)) {
            // If the value looks like raw strokes (>30), convert using par
            toPar = strokes > 30 ? strokes - par : strokes;
          }
        }

        rounds[i + 1] = toPar;
      });

      const headshotObj = athlete.headshot as Record<string, unknown> | undefined;

      // comp.score is cumulative to-par as string ("-8", "E", "+2", or occasionally raw total)
      const rawScore = (comp.score as string ?? "").trim();
      let totalScore = 0;
      if (rawScore === "E" || rawScore === "") {
        totalScore = 0;
      } else {
        const parsed = parseInt(rawScore);
        if (!isNaN(parsed)) {
          // If >30 it's probably raw total strokes — convert using rounds played
          const roundsPlayed = Object.values(rounds).filter(r => r !== null).length;
          totalScore = parsed > 30 && roundsPlayed > 0 ? parsed - par * roundsPlayed : parsed;
        }
      }

      // Tee time
      let teeTime: string | null = null;
      const startDate = comp.startDate as string | undefined;
      if (startDate) {
        try {
          teeTime = new Date(startDate).toLocaleTimeString("en-US", {
            timeZone: "America/New_York",
            hour: "numeric", minute: "2-digit", hour12: true,
          });
        } catch { teeTime = null; }
      }
      if (!teeTime && (comp.teeTime as string)) teeTime = comp.teeTime as string;

      // Thru
      const thru = statusObj.thru as string | number | undefined;
      const thruStr = thru !== undefined && thru !== null ? String(thru) : null;

      players.push({
        name: athlete.displayName as string ?? "",
        espnId: String(athlete.id ?? ""),
        headshot: headshotObj?.href as string ?? null,
        totalScore,
        position: ((statusObj as Record<string, unknown>).position as Record<string, unknown>)?.displayName as string ?? statusObj.displayValue as string ?? "",
        status: statusType.includes("cut") ? "cut" : statusType.includes("wd") ? "wd" : "active",
        r1: rounds[1], r2: rounds[2], r3: rounds[3], r4: rounds[4],
        teeTime,
        thru: thruStr,
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
  const supabase = createServerSupabase();

  // Check for admin manual scores override
  const { data: adminCache } = await supabase
    .from("score_cache")
    .select("data, updated_at")
    .eq("tournament", "admin_overrides")
    .single();

  const adminOverrides = (adminCache?.data ?? {}) as Record<string, unknown>;

  // If admin has set manual scores, ONLY return manual scores — never ESPN
  if (adminOverrides.useManualScores) {
    const { data: manualScores } = await supabase
      .from("score_cache")
      .select("data")
      .eq("tournament", `manual_scores_${tournament}`)
      .single();
    // Return manual scores if saved, or empty array — never fall through to ESPN
    return NextResponse.json({
      scores: manualScores?.data ?? [],
      source: manualScores?.data ? "manual" : "manual_empty"
    });
  }

  // Check ESPN cache (only reached when manual mode is OFF)
  const { data: cached } = await supabase
    .from("score_cache")
    .select("data, updated_at")
    .eq("tournament", `scores_${tournament}`)
    .single();

  if (cached) {
    const age = Date.now() - new Date(cached.updated_at as string).getTime();
    if (age < CACHE_MS) return NextResponse.json({ scores: cached.data, source: "cache" });
  }

  const scores = await fetchFromESPN(tournament);
  if (scores.length > 0) {
    await supabase.from("score_cache").upsert({
      tournament: `scores_${tournament}`,
      data: scores,
      updated_at: new Date().toISOString(),
    });
    return NextResponse.json({ scores, source: "espn" });
  }

  if (cached) return NextResponse.json({ scores: cached.data, source: "stale" });
  return NextResponse.json({ scores: [], source: "empty" });
}
