import { NextResponse } from "next/server";

// Returns the raw ESPN field values for the first 3 players so we can
// see exactly what comp.score and linescores[n].value / displayValue contain.
// Hit: /api/debug-espn
export async function GET() {
  const urls = [
    "https://site.api.espn.com/apis/site/v2/sports/golf/leaderboard?league=pga&event=401811941",
    "https://site.api.espn.com/apis/site/v2/sports/golf/leaderboard?league=pga",
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
      if (!res.ok) continue;
      const d = await res.json() as Record<string, unknown>;
      const events = (d.events as unknown[]) ?? [];
      if (!events.length) continue;
      const event = events[0] as Record<string, unknown>;
      const comps = ((event.competitions as unknown[])?.[0] as Record<string, unknown>)?.competitors as unknown[];
      if (!comps?.length) continue;

      const players = (comps as Record<string, unknown>[]).slice(0, 5).map(comp => {
        const athlete = (comp.athlete as Record<string, unknown>) ?? {};
        const linescores = (comp.linescores as Record<string, unknown>[]) ?? [];
        const status = (comp.status as Record<string, unknown>) ?? {};
        return {
          name: athlete.displayName,
          // Raw fields from comp
          "comp.score": comp.score,
          "comp.scoringSystem": comp.scoringSystem,
          "comp.totalScore": comp.totalScore,
          "comp.teeTime": comp.teeTime,
          "comp.startDate": comp.startDate,
          // Status fields
          "status.displayValue": status.displayValue,
          "status.thru": status.thru,
          "status.type.name": (status.type as Record<string, unknown>)?.name,
          // Per-round linescore fields
          linescores: linescores.map((ls, i) => ({
            round: i + 1,
            value: ls.value,
            displayValue: ls.displayValue,
            linescoreValue: ls.linescoreValue,
            period: ls.period,
            clock: ls.clock,
            // dump all keys so nothing is hidden
            allKeys: Object.keys(ls),
          })),
        };
      });

      return NextResponse.json({ url, players });
    } catch (e) {
      return NextResponse.json({ error: String(e) });
    }
  }

  return NextResponse.json({ error: "All ESPN URLs failed" });
}
