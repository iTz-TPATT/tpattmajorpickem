import { NextResponse } from "next/server";

// Raw debug endpoint - shows exactly what ESPN returns for a given player
// Only accessible with admin password
// Usage: /api/debug-stats?name=Scottie+Scheffler&password=YOUR_ADMIN_PASSWORD

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const password = searchParams.get("password");
  const playerName = searchParams.get("name") ?? "Scottie Scheffler";
  const espnId = searchParams.get("id") ?? "4686091"; // Scheffler's known ID

  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Origin": "https://www.espn.com",
    "Referer": "https://www.espn.com/golf/",
  };

  const results: Record<string, unknown> = {};

  // Test every URL format
  const urls = {
    stats_v2: `https://site.api.espn.com/apis/site/v2/sports/golf/pga/athletes/${espnId}/statistics`,
    stats_common_v3: `https://site.api.espn.com/apis/common/v3/sports/golf/pga/athletes/${espnId}/statistics`,
    stats_core_2025: `https://sports.core.api.espn.com/v2/sports/golf/leagues/pga/seasons/2025/athletes/${espnId}/statistics/0`,
    stats_core_2026: `https://sports.core.api.espn.com/v2/sports/golf/leagues/pga/seasons/2026/athletes/${espnId}/statistics/0`,
    athlete_profile: `https://site.api.espn.com/apis/site/v2/sports/golf/pga/athletes/${espnId}`,
    search: `https://site.api.espn.com/apis/site/v2/sports/golf/pga/athletes?search=${encodeURIComponent(playerName)}&limit=3`,
    leaderboard: `https://site.api.espn.com/apis/site/v2/sports/golf/leaderboard?league=pga`,
  };

  for (const [key, url] of Object.entries(urls)) {
    try {
      const res = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(6000),
        cache: "no-store",
      });
      const status = res.status;
      if (res.ok) {
        const data = await res.json() as Record<string, unknown>;
        // Return top-level keys so we can see structure without flooding response
        results[key] = {
          status,
          url,
          topLevelKeys: Object.keys(data),
          // Show first 500 chars of raw response
          preview: JSON.stringify(data).slice(0, 500),
        };
      } else {
        results[key] = { status, url, error: `HTTP ${status}` };
      }
    } catch (err) {
      results[key] = { url, error: String(err) };
    }
  }

  return NextResponse.json({ player: playerName, espnId, results }, { status: 200 });
}
