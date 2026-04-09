import { NextResponse } from "next/server";

// Hit /api/debug-espn to see exactly what ESPN returns for the first 3 players
// This helps diagnose why scoring isn't working
export async function GET() {
  const urls = [
    "https://site.api.espn.com/apis/site/v2/sports/golf/leaderboard?league=pga",
    "https://site.api.espn.com/apis/site/v2/sports/golf/leaderboard?league=pga&event=401811941",
  ];

  const results = [];

  for (const url of urls) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0" },
        cache: "no-store",
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        results.push({ url, status: res.status, error: "HTTP error" });
        continue;
      }

      const d = await res.json() as Record<string, unknown>;
      const events = (d.events as unknown[]) ?? [];
      if (!events.length) {
        results.push({ url, status: res.status, error: "no events in response" });
        continue;
      }

      const event = events[0] as Record<string, unknown>;
      const eventName = event.name ?? event.shortName;
      const comps = ((event.competitions as unknown[])?.[0] as Record<string, unknown>)?.competitors as unknown[];

      if (!comps?.length) {
        results.push({ url, status: res.status, eventName, error: "no competitors" });
        continue;
      }

      const players = (comps as Record<string, unknown>[]).slice(0, 3).map(comp => {
        const athlete = (comp.athlete as Record<string, unknown>) ?? {};
        const linescores = (comp.linescores as Record<string, unknown>[]) ?? [];
        const status = (comp.status as Record<string, unknown>) ?? {};
        return {
          name: athlete.displayName,
          "comp.score": comp.score,
          "has_headshot": !!(athlete.headshot),
          linescores: linescores.slice(0, 2).map((ls, i) => ({
            round: i + 1,
            value: ls.value,
            displayValue: ls.displayValue,
          })),
          "status.displayValue": status.displayValue,
          "status.thru": status.thru,
        };
      });

      results.push({ url, status: res.status, eventName, playerCount: comps.length, sample: players });
      break; // got data, stop trying
    } catch (e) {
      clearTimeout(timer);
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ url, error: msg.includes("abort") ? "TIMED OUT after 6s" : msg });
    }
  }

  return NextResponse.json({ results, timestamp: new Date().toISOString() });
}
