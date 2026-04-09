import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";
import { TOURNAMENTS, TournamentId } from "@/lib/tournaments";

const CACHE_MS = 45 * 60 * 1000; // 45 min — refresh more often during live play

function fmtAmericanOdds(n: number): string {
  if (n === undefined || n === null || isNaN(n)) return "";
  return n > 0 ? `+${n}` : `${n}`;
}

const SPORT_KEYS: Record<string, string> = {
  masters: "golf_masters_tournament_winner",
  pga:     "golf_pga_championship_winner",
  usopen:  "golf_us_open_winner",
  theopen: "golf_the_open_championship_winner",
};

const PREFERRED_BOOKS = ["draftkings", "fanduel", "betmgm", "williamhill_us", "bovada"];

function normalizeName(name: string): string {
  return name.toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ").trim();
}

function pickBookmaker(bookmakers: unknown[]): Record<string, unknown> | null {
  const bk = bookmakers.find((b) => {
    const x = b as Record<string, unknown>;
    return PREFERRED_BOOKS.includes(x.key as string);
  }) ?? bookmakers[0];
  return (bk as Record<string, unknown>) ?? null;
}

function extractFromEvents(data: unknown[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const event of data) {
    const e = event as Record<string, unknown>;
    const bookmakers = (e.bookmakers as unknown[]) ?? [];
    const bk = pickBookmaker(bookmakers);
    if (!bk) continue;
    for (const mkt of (bk.markets as unknown[]) ?? []) {
      const m = mkt as Record<string, unknown>;
      for (const o of (m.outcomes as unknown[]) ?? []) {
        const outcome = o as Record<string, unknown>;
        const name = outcome.name as string;
        const price = outcome.price as number;
        if (name && price !== undefined && !out[name]) {
          out[name] = fmtAmericanOdds(price);
        }
      }
    }
  }
  return out;
}

function addNormalizedKeys(map: Record<string, string>): Record<string, string> {
  const copy = { ...map };
  for (const [name, odds] of Object.entries(map)) {
    const norm = normalizeName(name);
    if (!copy[norm]) copy[norm] = odds;
  }
  return copy;
}

async function fetchLiveOdds(
  apiKey: string, sportKey: string
): Promise<{ odds: Record<string, string>; source: string } | null> {
  // Step 1 — get list of live/in-play events for this sport
  try {
    const eventsUrl =
      `https://api.the-odds-api.com/v4/sports/${sportKey}/events?apiKey=${apiKey}&dateFormat=iso`;
    const evRes = await fetch(eventsUrl, { cache: "no-store" });
    if (!evRes.ok) return null;

    const events = await evRes.json() as unknown[];
    if (!Array.isArray(events) || !events.length) return null;

    // Find the best candidate event: prefer in-progress (started, not completed),
    // but fall back to the most recently started event regardless of completed flag.
    const now = Date.now();
    const started = events.filter((ev) => {
      const e = ev as Record<string, unknown>;
      return new Date(e.commence_time as string).getTime() <= now;
    }) as Record<string, unknown>[];

    const liveEvent: Record<string, unknown> | undefined =
      started.find(e => !e.completed) ??    // prefer in-progress
      started.sort((a, b) =>                // fall back to most recent
        new Date(b.commence_time as string).getTime() - new Date(a.commence_time as string).getTime()
      )[0];

    if (!liveEvent) return null;

    const eventId = liveEvent.id as string;

    // Step 2 — fetch odds for that specific live event
    const oddsUrl =
      `https://api.the-odds-api.com/v4/sports/${sportKey}/events/${eventId}/odds?apiKey=${apiKey}&regions=us&markets=outrights&oddsFormat=american`;
    const oddsRes = await fetch(oddsUrl, { cache: "no-store" });
    if (!oddsRes.ok) return null;

    const oddsData = await oddsRes.json() as Record<string, unknown>;
    // Event-level endpoint returns a single object, not array
    const bookmakers = (oddsData.bookmakers as unknown[]) ?? [];
    if (!bookmakers.length) return null;

    const bk = pickBookmaker(bookmakers);
    if (!bk) return null;

    const liveOdds: Record<string, string> = {};
    for (const mkt of (bk.markets as unknown[]) ?? []) {
      const m = mkt as Record<string, unknown>;
      for (const o of (m.outcomes as unknown[]) ?? []) {
        const outcome = o as Record<string, unknown>;
        const name = outcome.name as string;
        const price = outcome.price as number;
        if (name && price !== undefined && !liveOdds[name]) {
          liveOdds[name] = fmtAmericanOdds(price);
        }
      }
    }

    if (!Object.keys(liveOdds).length) return null;
    return { odds: addNormalizedKeys(liveOdds), source: "live_event" };
  } catch {
    return null;
  }
}

async function fetchPreMarketOdds(
  apiKey: string, sportKey: string
): Promise<{ odds: Record<string, string>; source: string } | null> {
  const markets = ["outrights", "h2h", "winner"];
  for (const market of markets) {
    try {
      const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/?apiKey=${apiKey}&regions=us&markets=${market}&oddsFormat=american`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const data = await res.json() as unknown[];
      if (!Array.isArray(data) || !data.length) continue;
      const odds = extractFromEvents(data);
      if (Object.keys(odds).length > 0) {
        return { odds: addNormalizedKeys(odds), source: `pre_market_${market}` };
      }
    } catch { continue; }
  }
  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tournamentId = (searchParams.get("tournament") ?? "masters") as TournamentId;
  const debug = searchParams.get("debug") === "1";
  const bust  = searchParams.get("bust")  === "1";

  const tournament = TOURNAMENTS[tournamentId];
  if (!tournament) return NextResponse.json({ odds: {} });

  const supabase = createServerSupabase();
  const cacheKey = `odds_${tournamentId}`;

  const { data: cached } = await supabase
    .from("score_cache").select("data, updated_at").eq("tournament", cacheKey).single();

  // Serve fresh non-empty cache (skip on debug/bust)
  if (cached && !debug && !bust) {
    const age = Date.now() - new Date(cached.updated_at as string).getTime();
    const cachedOdds = (cached.data ?? {}) as Record<string, string>;
    if (age < CACHE_MS && Object.keys(cachedOdds).length > 0) {
      return NextResponse.json({ odds: cachedOdds, source: "cache", age_minutes: Math.round(age / 60000) });
    }
  }

  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ odds: (cached?.data ?? {}) as Record<string, string>, source: "no_api_key" });
  }

  const sportKey = SPORT_KEYS[tournamentId] ?? TOURNAMENTS[tournamentId as TournamentId]?.oddsKey;

  // Try live event odds first, then fall back to pre-market
  const result =
    (await fetchLiveOdds(apiKey, sportKey)) ??
    (await fetchPreMarketOdds(apiKey, sportKey));

  if (result && Object.keys(result.odds).length > 0) {
    await supabase.from("score_cache").upsert({
      tournament: cacheKey,
      data: result.odds,
      updated_at: new Date().toISOString(),
    });

    const resp: Record<string, unknown> = {
      odds: result.odds,
      source: result.source,
      count: Object.keys(result.odds).length,
    };
    if (debug) resp.sportKey = sportKey;
    return NextResponse.json(resp);
  }

  // Nothing live or pre-market — serve stale cache (never cache empty)
  const stale = (cached?.data ?? {}) as Record<string, string>;
  const staleSource = Object.keys(stale).length > 0 ? "stale_cache" : "empty";
  if (debug) {
    return NextResponse.json({ odds: stale, source: staleSource, sportKey, hint: "Both live and pre-market returned 0 players. Check sportKey and that ODDS_API_KEY is valid." });
  }
  return NextResponse.json({ odds: stale, source: staleSource });
}
