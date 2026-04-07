import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const espnId = searchParams.get("espnId");
  if (!espnId) return NextResponse.json({ stats: null });

  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/golf/pga/athletes/${espnId}/statistics`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error("Stats fetch failed");

    const data = await res.json() as Record<string, unknown>;
    const stats: Record<string, string> = {};

    // ESPN athlete stats
    const athlete = data.athlete as Record<string, unknown> | undefined;
    if (athlete?.displayName) stats["Player"] = athlete.displayName as string;

    const splits = data.splits as Record<string, unknown> | undefined;
    const categories = (splits?.categories as unknown[]) ?? [];

    const statNameMap: Record<string, string> = {
      scoringAverage: "Scoring Avg",
      drivingAccuracy: "Fairways Hit",
      greensInRegulation: "GIR %",
      puttingAverage: "Putts/Round",
      drivingDistance: "Drive Distance",
      rank: "World Rank",
    };

    for (const cat of categories) {
      const c = cat as Record<string, unknown>;
      for (const s of (c.stats as unknown[]) ?? []) {
        const stat = s as Record<string, unknown>;
        const label = statNameMap[stat.name as string];
        if (label && stat.displayValue) {
          stats[label] = stat.displayValue as string;
        }
      }
    }

    // If no stats parsed, return placeholder
    if (Object.keys(stats).length === 0) {
      return NextResponse.json({ stats: null });
    }

    return NextResponse.json({ stats });
  } catch {
    return NextResponse.json({ stats: null });
  }
}
