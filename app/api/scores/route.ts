import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";

const CACHE_MS = 2 * 60 * 1000;

export interface GolferScore {
  name: string; espnId: string; headshot: string | null;
  totalScore: number; position: string; status: string;
  r1: number | null; r2: number | null; r3: number | null; r4: number | null;
}

function parseESPN(data: unknown): GolferScore[] {
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
        const val = l.value as string;
        rounds[i + 1] = (!val || val === "--") ? null : val === "E" ? 0 : parseInt(val) || null;
      });
      const headshotObj = athlete.headshot as Record<string, unknown> | undefined;
      const rawScore = comp.score as string;
      players.push({
        name: athlete.displayName as string ?? "",
        espnId: String(athlete.id ?? ""),
        headshot: headshotObj?.href as string ?? null,
        totalScore: rawScore === "E" ? 0 : parseInt(rawScore) || 0,
        position: ((statusObj as Record<string, unknown>).position as Record<string, unknown>)?.displayName as string ?? statusObj.displayValue as string ?? "",
        status: statusType.includes("cut") ? "cut" : statusType.includes("wd") ? "wd" : "active",
        r1: rounds[1], r2: rounds[2], r3: rounds[3], r4: rounds[4],
      });
    }
  } catch (e) { console.error("ESPN parse error:", e); }
  return players;
}

async function fetchFromESPN(): Promise<GolferScore[]> {
  const urls = [
    "https://site.api.espn.com/apis/site/v2/sports/golf/leaderboard?league=pga&event=401811941",
    "https://site.api.espn.com/apis/site/v2/sports/golf/leaderboard?league=pga",
    "https://site.api.espn.com/apis/site/v2/sports/golf/pga/leaderboard",
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
      if (!res.ok) continue;
      const parsed = parseESPN(await res.json());
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

  // If admin has set manual scores, use those
  if (adminOverrides.useManualScores) {
    const { data: manualScores } = await supabase
      .from("score_cache")
      .select("data")
      .eq("tournament", `manual_scores_${tournament}`)
      .single();
    if (manualScores?.data) {
      return NextResponse.json({ scores: manualScores.data, source: "manual" });
    }
  }

  // Check ESPN cache
  const { data: cached } = await supabase
    .from("score_cache")
    .select("data, updated_at")
    .eq("tournament", `scores_${tournament}`)
    .single();

  if (cached) {
    const age = Date.now() - new Date(cached.updated_at as string).getTime();
    if (age < CACHE_MS) return NextResponse.json({ scores: cached.data, source: "cache" });
  }

  const scores = await fetchFromESPN();
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
