import { NextResponse } from "next/server";
import { getPlayerStats, getRecentForm, getAugustaHistory, PGA_AVERAGES, PGA_STD_DEVS, toSD } from "@/lib/player-stats";

const KNOWN_ESPN_IDS: Record<string, string> = {
  "Scottie Scheffler": "4686091", "Rory McIlroy": "3470", "Jon Rahm": "3470580",
  "Xander Schauffele": "4001571", "Ludvig Åberg": "4874390", "Collin Morikawa": "4238909",
  "Viktor Hovland": "4393021", "Tommy Fleetwood": "3706348", "Brooks Koepka": "3228",
  "Justin Thomas": "4008612", "Patrick Cantlay": "3232272", "Will Zalatoris": "4050045",
  "Shane Lowry": "3340", "Tony Finau": "3024", "Hideki Matsuyama": "4563",
  "Max Homa": "2154", "Russell Henley": "5765", "Adam Scott": "952",
  "Cameron Smith": "4233606", "Dustin Johnson": "4571", "Bryson DeChambeau": "3232175",
  "Jordan Spieth": "5548", "Matt Fitzpatrick": "3700614", "Tyrrell Hatton": "3706354",
  "Robert MacIntyre": "4687249", "Tom Kim": "4874037", "Sahith Theegala": "4238937",
  "Sungjae Im": "4030168", "Akshay Bhatia": "4874409", "Min Woo Lee": "4691060",
  "Wyndham Clark": "4232058", "Cameron Young": "4232321", "Davis Riley": "4232484",
};

async function getLiveTournamentStats(espnId: string): Promise<Record<string, string> | null> {
  try {
    const res = await fetch(
      "https://site.api.espn.com/apis/site/v2/sports/golf/leaderboard?league=pga",
      { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(5000), cache: "no-store" }
    );
    if (!res.ok) return null;
    const data = await res.json() as Record<string, unknown>;
    const events = (data.events as unknown[]) ?? [];
    if (!events.length) return null;
    const event = events[0] as Record<string, unknown>;
    if (!event.hasPlayerStats) return null;
    const comps = ((event.competitions as unknown[])?.[0] as Record<string, unknown>)?.competitors as unknown[];
    if (!comps) return null;
    const player = comps.find((c) =>
      String(((c as Record<string, unknown>).athlete as Record<string, unknown>)?.id) === espnId
    ) as Record<string, unknown> | undefined;
    if (!player) return null;

    const result: Record<string, string> = {};
    const score = (player.score as Record<string, unknown>)?.displayValue as string;
    if (score) result["Score"] = score === "0" ? "E" : score;
    const status = player.status as Record<string, unknown>;
    if (status?.position) result["Position"] = (status.position as Record<string, unknown>).displayName as string;
    const linescores = (player.linescores as unknown[]) ?? [];
    const rounds = linescores.map(ls => (ls as Record<string, unknown>).displayValue as string).filter(v => v && v !== "--");
    if (rounds.length) result["Rounds"] = rounds.join(" · ");
    if (status?.thru) result["Thru"] = `Hole ${status.thru}`;
    return Object.keys(result).length > 0 ? result : null;
  } catch { return null; }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const playerName = searchParams.get("name") ?? "";
  let espnId = searchParams.get("espnId") ?? "";
  if (!espnId || espnId === "undefined") espnId = KNOWN_ESPN_IDS[playerName] ?? "";

  const seasonStats = getPlayerStats(playerName);
  const liveStats = espnId ? await getLiveTournamentStats(espnId) : null;

  if (!seasonStats && !liveStats) return NextResponse.json({ stats: null });

  const stats: Record<string, string> = {};

  // Live tournament stats
  if (liveStats) {
    stats["── This Week ──"] = "";
    Object.assign(stats, liveStats);
  }

  // Season stats
  if (seasonStats) {
    stats["── 2024-25 Season ──"] = "";
    stats["World Rank"] = seasonStats.worldRank >= 888 ? "N/A" : `#${seasonStats.worldRank}`;
    stats["Scoring Avg"] = seasonStats.scoringAvg.toFixed(2);
    stats["Drive Dist"] = `${seasonStats.drivingDist} yds`;
    stats["Fairways"] = `${seasonStats.fairwayPct.toFixed(1)}%`;
    stats["GIR"] = `${seasonStats.girPct.toFixed(1)}%`;
    stats["Putts/Rd"] = seasonStats.puttsPerRound.toFixed(1);
    stats["SG: Total"] = (seasonStats.sgTotal >= 0 ? "+" : "") + seasonStats.sgTotal.toFixed(2);
    stats["SG: OTT"] = (seasonStats.sgOTT >= 0 ? "+" : "") + seasonStats.sgOTT.toFixed(2);
    stats["SG: App"] = (seasonStats.sgAPP >= 0 ? "+" : "") + seasonStats.sgAPP.toFixed(2);
    stats["SG: ARG"] = (seasonStats.sgARG >= 0 ? "+" : "") + seasonStats.sgARG.toFixed(2);
    stats["SG: Putt"] = (seasonStats.sgPUTT >= 0 ? "+" : "") + seasonStats.sgPUTT.toFixed(2);

    // Radar data — 5 axes as standard deviations
    const radarData = [
      { label: "Drive\nDist", value: toSD(seasonStats.drivingDist, PGA_AVERAGES.drivingDist, PGA_STD_DEVS.drivingDist) },
      { label: "Approach", value: toSD(seasonStats.sgAPP, 0, PGA_STD_DEVS.sgAPP) },
      { label: "Putting", value: toSD(seasonStats.sgPUTT, 0, PGA_STD_DEVS.sgPUTT) },
      { label: "Around\nGreen", value: toSD(seasonStats.sgARG, 0, PGA_STD_DEVS.sgARG) },
      { label: "Drive\nAcc", value: toSD(seasonStats.fairwayPct, PGA_AVERAGES.fairwayPct, PGA_STD_DEVS.fairwayPct) },
    ];
    stats["__radar__"] = JSON.stringify(radarData);
  }


  // Recent form
  const recentForm = getRecentForm(playerName);
  if (recentForm) {
    stats["── Recent Form ──"] = "";
    const trendEmoji = recentForm.trend === "hot" ? "🔥" : recentForm.trend === "cold" ? "❄️" : recentForm.trend === "warm" ? "📈" : "〰️";
    stats["Form"] = `${trendEmoji} ${recentForm.trend.charAt(0).toUpperCase() + recentForm.trend.slice(1)}`;
    stats["Last 5"] = recentForm.results.map(([t, r]) => `${r}`).join("  ");
    stats["Events"] = recentForm.results.map(([t]) => t).join("  ");
  }

  // Augusta history
  const augusta = getAugustaHistory(playerName);
  if (augusta) {
    stats["── Augusta History ──"] = "";
    stats["Starts"] = String(augusta.starts);
    stats["Best Finish"] = augusta.bestFinish;
    stats["Cuts Made"] = `${augusta.cuts}/${augusta.starts}`;
    stats["Avg Score/Rd"] = augusta.avgScore >= 0 ? `+${augusta.avgScore.toFixed(1)}` : augusta.avgScore.toFixed(1);
  }

  return NextResponse.json({ stats });
}
