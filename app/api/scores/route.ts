import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";
import { staticPlayersAsScores } from "@/lib/golfers";

const CACHE_MS = 60 * 1000; // 60 seconds — refresh frequently during live play

export interface GolferScore {
  name: string; espnId: string; headshot: string | null;
  totalScore: number; position: string; status: string;
  r1: number | null; r2: number | null; r3: number | null; r4: number | null;
  teeTime: string | null; thru: string | null;
}

const PAR = 72; // Masters par

/**
 * Convert an ESPN score string to to-par integer.
 * ESPN linescores[n].value = raw strokes ("68") or to-par ("-4","E","+2").
 * Raw strokes are always > 50. To-par values are in range [-20, +30].
 */
function toPar(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  if (!s || s === "--") return null;
  if (s === "E") return 0;
  const n = parseInt(s, 10);
  if (isNaN(n)) return null;
  // Raw strokes (e.g. 68) → convert to to-par. To-par values never exceed 50.
  return n > 50 ? n - PAR : n;
}

/**
 * Convert ESPN's cumulative score string to to-par.
 * comp.score is typically already to-par ("-8","E","+2") but can be raw strokes.
 * We check the individual round scores to determine which.
 */
function toParTotal(rawScore: unknown, roundScores: (number|null)[]): number {
  if (rawScore === "E" || rawScore === 0) return 0;
  const s = String(rawScore ?? "").trim();
  if (!s || s === "--") {
    // Derive from rounds
    return roundScores.reduce((sum: number, r) => sum + (r ?? 0), 0);
  }
  const n = parseInt(s, 10);
  if (isNaN(n)) return 0;
  const played = roundScores.filter(r => r !== null).length;
  // If n > 50 it's raw total strokes — subtract par for each round played
  return n > 50 && played > 0 ? n - PAR * played : n;
}

function parseESPN(data: unknown): GolferScore[] {
  const players: GolferScore[] = [];
  try {
    const d = data as Record<string, unknown>;
    const events = (d.events as unknown[]) ?? [];
    if (!events.length) return players;
    const event = events[0] as Record<string, unknown>;
    const comps = ((event.competitions as unknown[])?.[0] as Record<string, unknown>)?.competitors as unknown[];
    if (!comps?.length) return players;

    for (const raw of comps) {
      const comp = raw as Record<string, unknown>;
      const athlete = (comp.athlete as Record<string, unknown>) ?? {};
      const linescores = (comp.linescores as unknown[]) ?? [];
      const statusObj = (comp.status as Record<string, unknown>) ?? {};
      const statusType = ((statusObj.type as Record<string, unknown>)?.name as string ?? "active").toLowerCase();

      // Parse individual round scores — try displayValue first (to-par string), fall back to value (raw strokes)
      const rounds: (number | null)[] = [null, null, null, null];
      linescores.forEach((ls, i) => {
        if (i >= 4) return;
        const l = ls as Record<string, unknown>;
        rounds[i] = toPar(l.displayValue) ?? toPar(l.value);
      });

      const totalScore = toParTotal(comp.score, rounds);
      const headshotObj = athlete.headshot as Record<string, unknown> | undefined;

      let teeTime: string | null = null;
      // Parse tee time — statusObj.teeTime or comp.startDate are ISO strings, convert to ET
      const rawTeeTime = statusObj.teeTime ?? comp.startDate ?? null;
      if (rawTeeTime) {
        try {
          teeTime = new Date(rawTeeTime as string).toLocaleTimeString("en-US", {
            timeZone: "America/New_York", hour: "numeric", minute: "2-digit", hour12: true,
          });
        } catch { /* ignore */ }
      }
      if (!teeTime && comp.teeTime) teeTime = String(comp.teeTime);

      const thru = statusObj.thru;
      const name = (athlete.displayName as string) ?? "";
      if (!name) continue;

      players.push({
        name,
        espnId: String(athlete.id ?? ""),
        headshot: headshotObj?.href as string ?? null,
        totalScore,
        position: (statusObj.position as Record<string, unknown>)?.displayName as string
          ?? statusObj.displayValue as string ?? "",
        status: statusType.includes("cut") ? "cut" : statusType.includes("wd") ? "wd" : "active",
        r1: rounds[0], r2: rounds[1], r3: rounds[2], r4: rounds[3],
        teeTime,
        thru: thru != null ? String(thru) : null,
      });
    }
  } catch (e) {
    console.error("ESPN parse error:", e);
  }
  return players;
}

async function fetchFromESPN(): Promise<GolferScore[]> {
  // Try specific Masters 2026 event ID first (returns full 91-player field)
  // Fall back to generic PGA endpoint
  const urls = [
    "https://site.api.espn.com/apis/site/v2/sports/golf/leaderboard?league=pga&event=401811941",
    "https://site.api.espn.com/apis/site/v2/sports/golf/leaderboard?league=pga",
    "https://site.api.espn.com/apis/site/v2/sports/golf/pga/leaderboard",
  ];
  for (const url of urls) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: ctrl.signal,
        next: { revalidate: 0 },
      });
      clearTimeout(t);
      if (!res.ok) continue;
      const parsed = parseESPN(await res.json());
      console.log(`ESPN ${url.slice(-30)}: ${parsed.length} players`);
      if (parsed.length > 0) return parsed;
    } catch (e) {
      console.warn(`ESPN fetch failed (${url.slice(-30)}):`, e instanceof Error ? e.message : e);
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

  // Admin manual scores override
  const { data: adminCache } = await supabase
    .from("score_cache").select("data").eq("tournament", "admin_overrides").single();
  const adminOverrides = (adminCache?.data ?? {}) as Record<string, unknown>;

  if (adminOverrides.useManualScores) {
    const { data: manualRow } = await supabase
      .from("score_cache").select("data").eq("tournament", `manual_scores_${tournament}`).single();
    const md = manualRow?.data as GolferScore[] | undefined;
    if (md?.length) return NextResponse.json({ scores: md, source: "manual" });
    // Auto-clear stuck flag
    await supabase.from("score_cache").upsert({
      tournament: "admin_overrides",
      data: { ...adminOverrides, useManualScores: false },
      updated_at: new Date().toISOString(),
    });
  }

  // Serve cached scores if fresh
  const { data: cached } = await supabase
    .from("score_cache").select("data, updated_at").eq("tournament", `scores_${tournament}`).single();
  const cachedScores = Array.isArray(cached?.data) ? cached!.data as GolferScore[] : [];

  if (!debug && cachedScores.length > 0) {
    const age = Date.now() - new Date(cached!.updated_at as string).getTime();
    if (age < CACHE_MS) {
      return NextResponse.json({ scores: cachedScores, source: "cache", age_s: Math.round(age / 1000) });
    }
  }

  // Live fetch
  const live = await fetchFromESPN();

  if (live.length > 0) {
    await supabase.from("score_cache").upsert({
      tournament: `scores_${tournament}`,
      data: live,
      updated_at: new Date().toISOString(),
    });
    if (debug) return NextResponse.json({ scores: live, source: "espn", count: live.length, sample: live.slice(0, 3) });
    return NextResponse.json({ scores: live, source: "espn", count: live.length });
  }

  // Stale cache
  if (cachedScores.length > 0) {
    if (debug) return NextResponse.json({ scores: cachedScores, source: "stale_cache", count: cachedScores.length });
    return NextResponse.json({ scores: cachedScores, source: "stale_cache" });
  }

  // Static fallback — never show blank page
  const staticScores = staticPlayersAsScores();
  if (debug) return NextResponse.json({ scores: staticScores, source: "static_fallback", count: staticScores.length });
  return NextResponse.json({ scores: staticScores, source: "static_fallback" });
}
