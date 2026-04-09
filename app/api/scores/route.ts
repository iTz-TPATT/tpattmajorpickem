import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";
import { staticPlayersAsScores } from "@/lib/golfers";

const CACHE_MS = 2 * 60 * 1000;

export interface GolferScore {
  name: string; espnId: string; headshot: string | null;
  totalScore: number; position: string; status: string;
  r1: number | null; r2: number | null; r3: number | null; r4: number | null;
  teeTime: string | null; thru: string | null;
}

const PAR: Record<string, number> = {
  masters: 72, pga: 70, usopen: 70, theopen: 71,
};

function toParFromString(val: string | undefined | null, par: number): number | null {
  if (!val || val === "--" || val.trim() === "") return null;
  const s = val.trim();
  if (s === "E") return 0;
  const n = parseInt(s, 10);
  if (isNaN(n)) return null;
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
    if (!comps?.length) return players;

    for (const raw of comps) {
      const comp = raw as Record<string, unknown>;
      const athlete = (comp.athlete as Record<string, unknown>) ?? {};
      const statusObj = (comp.status as Record<string, unknown>) ?? {};
      const statusType = ((statusObj.type as Record<string, unknown>)?.name as string ?? "active").toLowerCase();
      const linescores = (comp.linescores as Record<string, unknown>[]) ?? [];

      const rounds: Record<number, number | null> = { 1: null, 2: null, 3: null, 4: null };
      linescores.forEach((ls, i) => {
        if (i >= 4) return;
        rounds[i + 1] =
          toParFromString(ls.displayValue as string, par) ??
          toParFromString(ls.value as string, par) ?? null;
      });

      const rawScore = (comp.score as string ?? "").trim();
      let totalScore = 0;
      if (rawScore === "" || rawScore === "--") {
        totalScore = (Object.values(rounds).filter(r => r !== null) as number[]).reduce((s, r) => s + r, 0);
      } else if (rawScore === "E") {
        totalScore = 0;
      } else {
        const n = parseInt(rawScore, 10);
        if (!isNaN(n)) {
          totalScore = n > 50
            ? n - par * Math.max(1, Object.values(rounds).filter(r => r !== null).length)
            : n;
        }
      }

      let teeTime: string | null = null;
      const startDate = comp.startDate as string | undefined;
      if (startDate) {
        try {
          teeTime = new Date(startDate).toLocaleTimeString("en-US", {
            timeZone: "America/New_York", hour: "numeric", minute: "2-digit", hour12: true,
          });
        } catch { /* ignore */ }
      }
      if (!teeTime && comp.teeTime) teeTime = String(comp.teeTime);

      const thru = statusObj.thru as string | number | undefined;
      const name = (athlete.displayName as string) ?? "";
      if (!name) continue;

      players.push({
        name,
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

// Try multiple ESPN endpoints with different headers to maximize success rate
async function fetchFromESPN(tournamentId = "masters"): Promise<{ scores: GolferScore[]; log: string[] }> {
  const log: string[] = [];
  const attempts: { url: string; headers: Record<string, string> }[] = [
    {
      url: "https://site.api.espn.com/apis/site/v2/sports/golf/leaderboard?league=pga&event=401811941",
      headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15" },
    },
    {
      url: "https://site.api.espn.com/apis/site/v2/sports/golf/leaderboard?league=pga",
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    },
    {
      url: "https://site.api.espn.com/apis/site/v2/sports/golf/leaderboard?league=pga&event=401811941",
      headers: { "Accept": "application/json" },
    },
  ];

  for (const attempt of attempts) {
    try {
      log.push(`Trying: ${attempt.url.slice(0, 80)}`);
      const res = await fetch(attempt.url, {
        headers: attempt.headers,
        cache: "no-store",
      });
      log.push(`  → HTTP ${res.status}`);
      if (!res.ok) continue;
      const json = await res.json();
      const parsed = parseESPN(json, tournamentId);
      log.push(`  → ${parsed.length} players parsed`);
      if (parsed.length > 0) return { scores: parsed, log };
    } catch (e) {
      log.push(`  → ERROR: ${String(e).slice(0, 100)}`);
    }
  }
  return { scores: [], log };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tournament = searchParams.get("tournament") ?? "masters";
  const debug = searchParams.get("debug") === "1";
  const supabase = createServerSupabase();

  // Admin override check
  const { data: adminCache } = await supabase
    .from("score_cache").select("data").eq("tournament", "admin_overrides").single();
  const adminOverrides = (adminCache?.data ?? {}) as Record<string, unknown>;

  if (adminOverrides.useManualScores) {
    const { data: manualRow } = await supabase
      .from("score_cache").select("data").eq("tournament", `manual_scores_${tournament}`).single();
    const manualData = manualRow?.data;
    if (Array.isArray(manualData) && manualData.length > 0) {
      return NextResponse.json({ scores: manualData, source: "manual", count: manualData.length });
    }
    // Auto-clear stuck flag
    await supabase.from("score_cache").upsert({
      tournament: "admin_overrides",
      data: { ...adminOverrides, useManualScores: false },
      updated_at: new Date().toISOString(),
    });
    console.warn("useManualScores ON but empty — auto-cleared, falling back to ESPN");
  }

  // Check cache
  const { data: cached } = await supabase
    .from("score_cache").select("data, updated_at").eq("tournament", `scores_${tournament}`).single();
  const cachedScores = Array.isArray(cached?.data) && (cached!.data as GolferScore[]).length > 0
    ? cached!.data as GolferScore[] : null;

  if (cachedScores && !debug) {
    const age = Date.now() - new Date((cached!.updated_at as string)).getTime();
    if (age < CACHE_MS) {
      return NextResponse.json({ scores: cachedScores, source: "cache", count: cachedScores.length });
    }
  }

  // Fetch from ESPN
  const { scores, log } = await fetchFromESPN(tournament);

  if (scores.length > 0) {
    await supabase.from("score_cache").upsert({
      tournament: `scores_${tournament}`,
      data: scores,
      updated_at: new Date().toISOString(),
    });
    if (debug) return NextResponse.json({ scores, source: "espn", count: scores.length, log, sample: scores.slice(0, 3) });
    return NextResponse.json({ scores, source: "espn", count: scores.length });
  }

  // ESPN failed — try stale cache
  if (cachedScores) {
    if (debug) return NextResponse.json({ scores: cachedScores, source: "stale_cache", count: cachedScores.length, espnLog: log });
    return NextResponse.json({ scores: cachedScores, source: "stale_cache" });
  }

  // Last resort: static field so picks page is never blank
  const staticScores = staticPlayersAsScores();
  if (debug) return NextResponse.json({ scores: staticScores, source: "static_fallback", count: staticScores.length, espnLog: log, warning: "ESPN unreachable — showing static field, no live scores" });
  return NextResponse.json({ scores: staticScores, source: "static_fallback" });
}
