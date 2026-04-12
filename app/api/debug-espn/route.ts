import { NextResponse } from "next/server";

export async function GET() {
  const url = "https://site.api.espn.com/apis/site/v2/sports/golf/leaderboard?league=pga";
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 0 },
    });
    clearTimeout(t);
    if (!res.ok) return NextResponse.json({ error: `HTTP ${res.status}`, url });
    const d = await res.json() as Record<string, unknown>;
    const comps = (((d.events as unknown[])?.[0] as Record<string, unknown>)
      ?.competitions as unknown[])?.[0] as Record<string, unknown>;
    const competitors = (comps?.competitors as unknown[]) ?? [];
    const sample = competitors.slice(0, 5).map((raw) => {
      const c = raw as Record<string, unknown>;
      const a = (c.athlete as Record<string, unknown>) ?? {};
      const s = (c.status as Record<string, unknown>) ?? {};
      const ls = (c.linescores as Record<string, unknown>[]) ?? [];
      return {
        name: a.displayName,
        score: c.score,
        thru: s.thru,
        "status.teeTime": s.teeTime,
        "comp.teeTime": c.teeTime,
        "comp.startDate": c.startDate,
        linescores: ls.slice(0, 4).map(l => ({ value: l.value, displayValue: l.displayValue })),
      };
    });
    return NextResponse.json({ url, playerCount: competitors.length, sample, ok: true });
  } catch (e) {
    clearTimeout(t);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg.includes("abort") ? "TIMED OUT (8s)" : msg, url });
  }
}
