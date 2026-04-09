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

async function fetchAllOdds(
  apiKey: string,
  sportKey: string
): Promise<{ odds: Record<string, string>; source: string; log: string[] }> {
  const log: string[] = [];

  // ── Step 1: try live event-level endpoint ──────────────────────────────────
  try {
    const evUrl = `https://api.the-odds-api.com/v4/sports/${sportKey}/events?apiKey=${apiKey}`;
    log.push(`GET ${evUrl.replace(apiKey, "***")}`);
    const evRes = await fetch(evUrl, { cache: "no-store" });
    log.push(`  → HTTP ${evRes.status}`);

    if (evRes.ok) {
      const events = await evRes.json() as unknown[];
      log.push(`  → ${events.length} events`);

      const now = Date.now();
      const started = (events as Record<string, unknown>[])
        .filter(e => new Date(e.commence_time as string).getTime() <= now)
        .sort((a, b) =>
          new Date(b.commence_time as string).getTime() -
          new Date(a.commence_time as string).getTime()
        );

      log.push(`  → ${started.length} events already started`);

      const candidate = started.find(e => !e.completed) ?? started[0];
      if (candidate) {
        const eventId = candidate.id as string;
        log.push(`  → Using event: ${candidate.home_team ?? eventId} (completed=${candidate.completed})`);

        const oUrl = `https://api.the-odds-api.com/v4/sports/${sportKey}/events/${eventId}/odds?apiKey=${apiKey}&regions=us&markets=outrights&oddsFormat=american`;
        log.push(`GET /events/${eventId}/odds`);
        const oRes = await fetch(oUrl, { cache: "no-store" });
        log.push(`  → HTTP ${oRes.status}`);

        if (oRes.ok) {
          const oData = await oRes.json() as Record<string, unknown>;
          const bookmakers = (oData.bookmakers as unknown[]) ?? [];
          log.push(`  → ${bookmakers.length} bookmakers`);
          const odds = extractOdds(bookmakers);
          log.push(`  → ${Object.keys(odds).length} players extracted`);
          if (Object.keys(odds).length > 0) {
            return { odds: addNormalized(odds), source: "live_event", log };
          }
        }
      } else {
        log.push("  → No started events found — trying pre-market");
      }
    }
  } catch (e) {
    log.push(`  EXCEPTION: ${String(e)}`);
  }

  // ── Step 2: try standard outrights / market endpoints ─────────────────────
  for (const market of MARKETS) {
    try {
      const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/?apiKey=${apiKey}&regions=us&markets=${market}&oddsFormat=american`;
      log.push(`GET /odds?markets=${market}`);
      const res = await fetch(url, { cache: "no-store" });
      log.push(`  → HTTP ${res.status}`);

      if (res.status === 422 || res.status === 404) continue;
      if (!res.ok) { log.push(`  → body: ${await res.text().catch(() => "")}`); continue; }

      const data = await res.json() as unknown[];
      log.push(`  → ${Array.isArray(data) ? data.length : "not-array"} events`);
      if (!Array.isArray(data) || !data.length) continue;

      const odds: Record<string, string> = {};
      for (const event of data) {
        const e = event as Record<string, unknown>;
        Object.assign(odds, extractOdds((e.bookmakers as unknown[]) ?? []));
      }
      log.push(`  → ${Object.keys(odds).length} players extracted`);
      if (Object.keys(odds).length > 0) {
        return { odds: addNormalized(odds), source: `pre_market_${market}`, log };
      }
    } catch (e) {
      log.push(`  EXCEPTION: ${String(e)}`);
    }
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

  // Serve fresh non-empty cache (skip when debug or bust)
  if (cached && !debug && !bust) {
    const age = Date.now() - new Date(cached.updated_at as string).getTime();
    const cachedOdds = (cached.data ?? {}) as Record<string, string>;
    if (age < CACHE_MS && Object.keys(cachedOdds).length > 0) {
      return NextResponse.json({ odds: cachedOdds, source: "cache", age_minutes: Math.round(age / 60000) });
    }
  }

  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      odds: (cached?.data ?? {}) as Record<string, string>,
      source: "no_api_key",
      debugInfo: ["ODDS_API_KEY is not set in Vercel environment variables."],
    });
  }

  const sportKey = SPORT_KEYS[tournamentId] ?? tournament.oddsKey;
  const { odds, source, log } = await fetchAllOdds(apiKey, sportKey);

  if (Object.keys(odds).length > 0) {
    await supabase.from("score_cache").upsert({
      tournament: cacheKey,
      data: odds,
      updated_at: new Date().toISOString(),
    });
    const resp: Record<string, unknown> = { odds, source, count: Object.keys(odds).length };
    if (debug) resp.debugInfo = log;
    return NextResponse.json(resp);
  }

  // Nothing returned — serve stale cache but NEVER cache empty
  const stale = (cached?.data ?? {}) as Record<string, string>;
  const resp: Record<string, unknown> = {
    odds: stale,
    source: Object.keys(stale).length > 0 ? "stale_cache" : "empty",
  };
  if (debug) resp.debugInfo = log;
  return NextResponse.json(resp);
}
