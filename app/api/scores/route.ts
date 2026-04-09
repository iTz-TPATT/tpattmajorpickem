import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";

const CACHE_MS = 2 * 60 * 1000; // 2 min fresh cache

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
 * Convert an ESPN score string to a to-par integer.
 * ESPN linescores[n].value = raw strokes ("68", "72") or to-par ("-4", "E", "+2")
 * We detect raw strokes by checking if the absolute value > 50 (no PGA round is < 55 strokes).
 */
function toParFromString(val: string | undefined | null, par: number): number | null {
  if (!val || val === "--" || val.trim() === "") return null;
  const s = val.trim();
  if (s === "E") return 0;
  const n = parseInt(s, 10);
  if (isNaN(n)) return null;
  // Raw stroke counts are always > 50; to-par values are always in [-20, +30]
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

      // Parse per-round to-par scores — try displayValue first, fall back to value
      const rounds: Record<number, number | null> = { 1: null, 2: null, 3: null, 4: null };
      linescores.forEach((ls, i) => {
        if (i >= 4) return;
        const score = toParFromString(ls.displayValue as string, par)
          ?? toParFromString(ls.value as string, par)
          ?? null;
        rounds[i + 1] = score;
      });

      // Parse cumulative to-par total from comp.score
      const rawScore = (comp.score as string ?? "").trim();
      let totalScore = 0;
      if (rawScore === "" || rawScore === "--") {
        // Derive from rounds
        totalScore = (Object.values(rounds).filter(r => r !== null) as number[]).reduce((s, r) => s + r, 0);
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

      // Tee time
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
      if (!name) continue; // skip malformed entries

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
  } catch (e) {
    console.error("ESPN parse error:", e);
  }
  return players;
}

async function fetchFromESPN(tournamentId = "masters"): Promise<GolferScore[]> {
  // Use generic endpoint first (works for any active PGA event),
  // then fall back to specific event ID for Masters
  const urls = [
    "https://site.api.espn.com/apis/site/v2/sports/golf/leaderboard?league=pga",
    "https://site.api.espn.com/apis/site/v2/sports/golf/leaderboard?league=pga&event=401811941",
    "https://site.api.espn.com/apis/site/v2/sports/golf/pga/leaderboard",
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0" },
        cache: "no-store",
      });
      if (!res.ok) { console.warn(`ESPN ${url} → HTTP ${res.status}`); continue; }
      const json = await res.json();
      const parsed = parseESPN(json, tournamentId);
      if (parsed.length > 0) {
        console.log(`ESPN scores loaded from ${url}: ${parsed.length} players`);
        return parsed;
      }
      console.warn(`ESPN ${url} returned 0 players`);
    } catch (e) {
      console.warn(`ESPN ${url} exception:`, e);
      continue;
    }
  }
  return [];
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tournament = searchParams.get("tournament") ?? "masters";
  const debug = searchParams.get("debug") === "1";
  const supabase = createServerSupabase();

  // ── Admin manual scores override ──────────────────────────────────────────
  const { data: adminCache } = await supabase
    .from("score_cache").select("data").eq("tournament", "admin_overrides").single();
  const adminOverrides = (adminCache?.data ?? {}) as Record<string, unknown>;

  if (adminOverrides.useManualScores) {
    const { data: manualRow } = await supabase
      .from("score_cache").select("data").eq("tournament", `manual_scores_${tournament}`).single();
    const manualData = manualRow?.data;
    if (Array.isArray(manualData) && manualData.length > 0) {
      if (debug) return NextResponse.json({ scores: manualData, source: "manual", count: manualData.length });
      return NextResponse.json({ scores: manualData, source: "manual" });
    }
    // ⚠ Manual mode is ON but scores are empty — auto-clear the flag and fall through to ESPN
    // This prevents a stuck state where no scores show at all
    await supabase.from("score_cache").upsert({
      tournament: "admin_overrides",
      data: { ...adminOverrides, useManualScores: false },
      updated_at: new Date().toISOString(),
    });
    console.warn("useManualScores=true but manual scores empty — auto-cleared flag, falling back to ESPN");
  }

  // ── Supabase ESPN cache ───────────────────────────────────────────────────
  const { data: cached } = await supabase
    .from("score_cache").select("data, updated_at").eq("tournament", `scores_${tournament}`).single();

  const cachedScores = Array.isArray(cached?.data) ? (cached!.data as GolferScore[]) : null;

  if (cachedScores && cachedScores.length > 0 && !debug) {
    const age = Date.now() - new Date((cached!.updated_at as string)).getTime();
    if (age < CACHE_MS) {
      return NextResponse.json({ scores: cachedScores, source: "cache" });
    }
  }

  // ── Fetch from ESPN ───────────────────────────────────────────────────────
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

  // ── ESPN failed — serve stale cache rather than empty ────────────────────
  if (cachedScores && cachedScores.length > 0) {
    console.warn("ESPN returned 0 players — serving stale cache");
    if (debug) return NextResponse.json({ scores: cachedScores, source: "stale", warning: "ESPN returned 0 players" });
    return NextResponse.json({ scores: cachedScores, source: "stale" });
  }

  if (debug) return NextResponse.json({ scores: [], source: "empty", warning: "ESPN returned 0 players and no cache exists" });
  return NextResponse.json({ scores: [], source: "empty" });
}
