import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";
import { TOURNAMENTS, TournamentId } from "@/lib/tournaments";

const CACHE_MS = 45 * 60 * 1000;

function fmtOdds(n: number): string {
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
const MARKETS = ["outrights", "h2h", "winner"];

function normalizeName(name: string): string {
  return name.toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ").trim();
}

function pickBookmaker(bookmakers: unknown[]): Record<string, unknown> | null {
  return (bookmakers.find((b) => {
    const x = b as Record<string, unknown>;
    return PREFERRED_BOOKS.includes(x.key as string);
  }) ?? bookmakers[0] ?? null) as Record<string, unknown> | null;
}

function extractOdds(bookmakers: unknown[]): Record<string, string> {
  const out: Record<string, string> = {};
  const bk = pickBookmaker(bookmakers);
  if (!bk) return out;
  for (const mkt of (bk.markets as unknown[]) ?? []) {
    const m = mkt as Record<string, unknown>;
    for (const o of (m.outcomes as unknown[]) ?? []) {
      const outcome = o as Record<string, unknown>;
      const name = outcome.name as string;
      const price = outcome.price as number;
      if (name && price !== undefined && !out[name]) {
        out[name] = fmtOdds(price);
      }
    }
  }
  return out;
}

function addNormalized(map: Record<string, string>): Record<string, string> {
  const copy = { ...map };
  for (const [name, odds] of Object.entries(map)) {
    const norm = normalizeName(name);
    if (!copy[norm]) copy[norm] = odds;
  }
  return copy;
}

type FetchOddsResult = {
  odds: Record<string, string>;
  source: string;
  log: string[];
  quotaExceeded?: boolean;
};

async function fetchAllOdds(apiKey: string, sportKey: string): Promise<FetchOddsResult> {
  const log: string[] = [];

  async function checkQuota(res: Response): Promise<boolean> {
    if (res.status === 401 || res.status === 429) {
      const body = await res.clone().text().catch(() => "");
      if (body.includes("OUT_OF_USAGE_CREDITS") || body.includes("quota") || res.status === 429) {
        log.push(`  ⚠ QUOTA EXCEEDED (HTTP ${res.status}) — need to upgrade plan at the-odds-api.com`);
        return true;
      }
    }
    return false;
  }

  // Step 1: live event-level odds
  try {
    const evUrl = `https://api.the-odds-api.com/v4/sports/${sportKey}/events?apiKey=${apiKey}`;
    log.push(`GET .../events (key=***)`);
    const evRes = await fetch(evUrl, { cache: "no-store" });
    log.push(`  → HTTP ${evRes.status}`);

    if (await checkQuota(evRes)) return { odds: {}, source: "quota_exceeded", log, quotaExceeded: true };

    if (evRes.ok) {
      const events = await evRes.json() as unknown[];
      log.push(`  → ${events.length} event(s) returned`);
      const now = Date.now();
      const started = (events as Record<string, unknown>[])
        .filter(e => new Date(e.commence_time as string).getTime() <= now)
        .sort((a, b) =>
          new Date(b.commence_time as string).getTime() - new Date(a.commence_time as string).getTime()
        );
      log.push(`  → ${started.length} event(s) already started`);
      const candidate = started.find(e => !e.completed) ?? started[0];
      if (candidate) {
        const eventId = candidate.id as string;
        log.push(`  → Event ID: ${eventId}`);
        const oUrl = `https://api.the-odds-api.com/v4/sports/${sportKey}/events/${eventId}/odds?apiKey=${apiKey}&regions=us&markets=outrights&oddsFormat=american`;
        log.push(`GET .../events/${eventId}/odds`);
        const oRes = await fetch(oUrl, { cache: "no-store" });
        log.push(`  → HTTP ${oRes.status}`);
        if (await checkQuota(oRes)) return { odds: {}, source: "quota_exceeded", log, quotaExceeded: true };
        if (oRes.ok) {
          const oData = await oRes.json() as Record<string, unknown>;
          const bookmakers = (oData.bookmakers as unknown[]) ?? [];
          log.push(`  → ${bookmakers.length} bookmaker(s)`);
          const odds = extractOdds(bookmakers);
          log.push(`  → ${Object.keys(odds).length} players extracted`);
          if (Object.keys(odds).length > 0) return { odds: addNormalized(odds), source: "live_event", log };
        }
      }
    }
  } catch (e) { log.push(`  EXCEPTION: ${String(e)}`); }

  // Step 2: standard market endpoints
  for (const market of MARKETS) {
    try {
      const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/?apiKey=${apiKey}&regions=us&markets=${market}&oddsFormat=american`;
      log.push(`GET /odds?markets=${market}`);
      const res = await fetch(url, { cache: "no-store" });
      log.push(`  → HTTP ${res.status}`);
      if (await checkQuota(res)) return { odds: {}, source: "quota_exceeded", log, quotaExceeded: true };
      if (res.status === 422 || res.status === 404) { log.push("  → not supported, skipping"); continue; }
      if (!res.ok) { log.push(`  → ${await res.text().catch(() => "")}`); continue; }
      const data = await res.json() as unknown[];
      log.push(`  → ${Array.isArray(data) ? data.length : "not-array"} event(s)`);
      if (!Array.isArray(data) || !data.length) continue;
      const odds: Record<string, string> = {};
      for (const event of data) {
        const e = event as Record<string, unknown>;
        Object.assign(odds, extractOdds((e.bookmakers as unknown[]) ?? []));
      }
      log.push(`  → ${Object.keys(odds).length} players extracted`);
      if (Object.keys(odds).length > 0) return { odds: addNormalized(odds), source: `pre_market_${market}`, log };
    } catch (e) { log.push(`  EXCEPTION: ${String(e)}`); }
  }

  return { odds: {}, source: "no_results", log };
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

  const cachedOdds = (cached?.data ?? {}) as Record<string, string>;
  const cacheHasData = Object.keys(cachedOdds).length > 0;

  // Serve fresh cache (skip when debug or bust)
  if (cached && !debug && !bust && cacheHasData) {
    const age = Date.now() - new Date(cached.updated_at as string).getTime();
    if (age < CACHE_MS) {
      return NextResponse.json({ odds: cachedOdds, source: "cache", age_minutes: Math.round(age / 60000) });
    }
  }

  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      odds: cachedOdds,
      source: cacheHasData ? "stale_cache_no_key" : "no_api_key",
      debugInfo: ["ODDS_API_KEY is not set in Vercel environment variables."],
    });
  }

  const sportKey = SPORT_KEYS[tournamentId] ?? tournament.oddsKey;
  const { odds, source, log, quotaExceeded } = await fetchAllOdds(apiKey, sportKey);

  if (Object.keys(odds).length > 0) {
    // Save to cache only when we have real data
    await supabase.from("score_cache").upsert({
      tournament: cacheKey,
      data: odds,
      updated_at: new Date().toISOString(),
    });
    const resp: Record<string, unknown> = { odds, source, count: Object.keys(odds).length };
    if (debug) resp.debugInfo = log;
    return NextResponse.json(resp);
  }

  // No fresh odds — return stale cache with explanation
  if (quotaExceeded && cacheHasData) {
    const resp: Record<string, unknown> = {
      odds: cachedOdds,
      source: "stale_cache_quota_exceeded",
      count: Object.keys(cachedOdds).length,
    };
    if (debug) { resp.debugInfo = log; resp.hint = "Quota exceeded — showing last cached odds. Upgrade at the-odds-api.com to refresh."; }
    return NextResponse.json(resp);
  }

  const resp: Record<string, unknown> = {
    odds: cachedOdds,
    source: quotaExceeded ? "quota_exceeded_no_cache" : (cacheHasData ? "stale_cache" : "empty"),
  };
  if (debug) resp.debugInfo = log;
  return NextResponse.json(resp);
}
