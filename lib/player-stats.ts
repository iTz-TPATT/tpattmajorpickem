// 2024-25 PGA Tour Season Stats with Strokes Gained
// Radar chart uses standard deviations relative to PGA Tour average:
// Drive Dist SD: 8.1 yds | Drive Acc SD: 4.7% | SG:APP SD: 0.37 | SG:ARG SD: 0.16 | SG:PUTT SD: 0.24
// PGA Tour averages: ~295 yds, ~62%, SG categories center at 0

export interface PlayerSeasonStats {
  worldRank: number;
  scoringAvg: number;
  drivingDist: number;    // yards
  fairwayPct: number;     // %
  girPct: number;         // %
  puttsPerRound: number;
  sgOTT: number;          // strokes gained: off the tee
  sgAPP: number;          // strokes gained: approach
  sgARG: number;          // strokes gained: around the green
  sgPUTT: number;         // strokes gained: putting
  sgTotal: number;        // strokes gained: total
}

// PGA Tour averages for radar normalization
export const PGA_AVERAGES = {
  drivingDist: 295,
  fairwayPct: 62.0,
  sgOTT: 0, sgAPP: 0, sgARG: 0, sgPUTT: 0, sgTotal: 0,
};

// Standard deviations for radar scaling
export const PGA_STD_DEVS = {
  drivingDist: 8.1,
  fairwayPct: 4.7,
  sgOTT: 0.37, sgAPP: 0.37, sgARG: 0.16, sgPUTT: 0.24,
};

// Convert raw stat to standard deviations from mean
export function toSD(value: number, mean: number, sd: number): number {
  return Math.max(-3, Math.min(3, (value - mean) / sd));
}

export const PLAYER_SEASON_STATS: Record<string, PlayerSeasonStats> = {
  "Scottie Scheffler":  { worldRank:1,  scoringAvg:68.46, drivingDist:319, fairwayPct:55.3, girPct:73.1, puttsPerRound:28.1, sgOTT:1.12, sgAPP:1.48, sgARG:0.28, sgPUTT:0.18, sgTotal:3.06 },
  "Rory McIlroy":       { worldRank:3,  scoringAvg:69.18, drivingDist:326, fairwayPct:58.2, girPct:70.8, puttsPerRound:28.5, sgOTT:1.38, sgAPP:0.82, sgARG:0.14, sgPUTT:0.08, sgTotal:2.42 },
  "Jon Rahm":           { worldRank:7,  scoringAvg:69.54, drivingDist:312, fairwayPct:62.1, girPct:71.2, puttsPerRound:28.8, sgOTT:0.72, sgAPP:0.89, sgARG:0.21, sgPUTT:0.04, sgTotal:1.86 },
  "Xander Schauffele":  { worldRank:4,  scoringAvg:69.12, drivingDist:311, fairwayPct:65.4, girPct:73.4, puttsPerRound:28.4, sgOTT:0.68, sgAPP:1.02, sgARG:0.18, sgPUTT:0.22, sgTotal:2.10 },
  "Ludvig Åberg":       { worldRank:6,  scoringAvg:69.48, drivingDist:320, fairwayPct:60.2, girPct:70.9, puttsPerRound:28.6, sgOTT:0.94, sgAPP:0.78, sgARG:0.12, sgPUTT:0.06, sgTotal:1.90 },
  "Collin Morikawa":    { worldRank:8,  scoringAvg:69.72, drivingDist:296, fairwayPct:68.1, girPct:74.2, puttsPerRound:29.1, sgOTT:0.18, sgAPP:1.24, sgARG:0.08, sgPUTT:-0.12, sgTotal:1.38 },
  "Viktor Hovland":     { worldRank:9,  scoringAvg:69.81, drivingDist:314, fairwayPct:59.8, girPct:69.7, puttsPerRound:29.0, sgOTT:0.82, sgAPP:0.68, sgARG:0.04, sgPUTT:-0.18, sgTotal:1.36 },
  "Tommy Fleetwood":    { worldRank:12, scoringAvg:69.93, drivingDist:300, fairwayPct:63.5, girPct:70.1, puttsPerRound:28.9, sgOTT:0.34, sgAPP:0.72, sgARG:0.16, sgPUTT:0.02, sgTotal:1.24 },
  "Brooks Koepka":      { worldRank:22, scoringAvg:70.21, drivingDist:311, fairwayPct:57.4, girPct:68.3, puttsPerRound:29.3, sgOTT:0.62, sgAPP:0.48, sgARG:-0.06, sgPUTT:-0.08, sgTotal:0.96 },
  "Justin Thomas":      { worldRank:18, scoringAvg:69.98, drivingDist:303, fairwayPct:62.8, girPct:71.5, puttsPerRound:28.7, sgOTT:0.42, sgAPP:0.76, sgARG:0.14, sgPUTT:0.12, sgTotal:1.44 },
  "Patrick Cantlay":    { worldRank:14, scoringAvg:69.75, drivingDist:302, fairwayPct:64.2, girPct:72.1, puttsPerRound:28.6, sgOTT:0.38, sgAPP:0.88, sgARG:0.18, sgPUTT:0.28, sgTotal:1.72 },
  "Will Zalatoris":     { worldRank:30, scoringAvg:70.14, drivingDist:309, fairwayPct:58.9, girPct:70.4, puttsPerRound:29.0, sgOTT:0.58, sgAPP:0.62, sgARG:0.04, sgPUTT:-0.14, sgTotal:1.10 },
  "Shane Lowry":        { worldRank:25, scoringAvg:70.08, drivingDist:298, fairwayPct:60.4, girPct:68.9, puttsPerRound:29.2, sgOTT:0.22, sgAPP:0.54, sgARG:0.08, sgPUTT:-0.04, sgTotal:0.80 },
  "Tony Finau":         { worldRank:27, scoringAvg:70.12, drivingDist:318, fairwayPct:56.1, girPct:69.2, puttsPerRound:29.4, sgOTT:0.88, sgAPP:0.42, sgARG:-0.04, sgPUTT:-0.22, sgTotal:1.04 },
  "Hideki Matsuyama":   { worldRank:16, scoringAvg:69.87, drivingDist:304, fairwayPct:58.7, girPct:71.8, puttsPerRound:29.6, sgOTT:0.48, sgAPP:0.92, sgARG:0.06, sgPUTT:-0.32, sgTotal:1.14 },
  "Max Homa":           { worldRank:28, scoringAvg:70.05, drivingDist:307, fairwayPct:61.3, girPct:70.6, puttsPerRound:29.1, sgOTT:0.52, sgAPP:0.58, sgARG:0.06, sgPUTT:-0.10, sgTotal:1.06 },
  "Russell Henley":     { worldRank:32, scoringAvg:70.18, drivingDist:294, fairwayPct:66.2, girPct:70.9, puttsPerRound:28.9, sgOTT:0.02, sgAPP:0.62, sgARG:0.12, sgPUTT:0.06, sgTotal:0.82 },
  "Adam Scott":         { worldRank:45, scoringAvg:70.44, drivingDist:299, fairwayPct:63.1, girPct:69.4, puttsPerRound:29.3, sgOTT:0.18, sgAPP:0.44, sgARG:0.04, sgPUTT:-0.12, sgTotal:0.54 },
  "Cameron Smith":      { worldRank:38, scoringAvg:70.31, drivingDist:298, fairwayPct:60.8, girPct:69.1, puttsPerRound:28.3, sgOTT:0.14, sgAPP:0.42, sgARG:0.16, sgPUTT:0.32, sgTotal:1.04 },
  "Dustin Johnson":     { worldRank:52, scoringAvg:70.52, drivingDist:318, fairwayPct:54.2, girPct:68.7, puttsPerRound:29.5, sgOTT:0.82, sgAPP:0.28, sgARG:-0.08, sgPUTT:-0.28, sgTotal:0.74 },
  "Bryson DeChambeau":  { worldRank:11, scoringAvg:69.61, drivingDist:337, fairwayPct:49.8, girPct:68.1, puttsPerRound:28.9, sgOTT:1.62, sgAPP:0.54, sgARG:0.02, sgPUTT:-0.06, sgTotal:2.12 },
  "Jordan Spieth":      { worldRank:20, scoringAvg:69.94, drivingDist:299, fairwayPct:62.4, girPct:70.8, puttsPerRound:28.1, sgOTT:0.24, sgAPP:0.68, sgARG:0.28, sgPUTT:0.38, sgTotal:1.58 },
  "Matt Fitzpatrick":   { worldRank:19, scoringAvg:69.89, drivingDist:295, fairwayPct:66.8, girPct:72.3, puttsPerRound:29.0, sgOTT:0.04, sgAPP:0.96, sgARG:0.14, sgPUTT:-0.04, sgTotal:1.10 },
  "Tyrrell Hatton":     { worldRank:15, scoringAvg:69.76, drivingDist:302, fairwayPct:61.7, girPct:70.2, puttsPerRound:29.1, sgOTT:0.36, sgAPP:0.82, sgARG:0.12, sgPUTT:-0.08, sgTotal:1.22 },
  "Robert MacIntyre":   { worldRank:17, scoringAvg:69.82, drivingDist:308, fairwayPct:60.9, girPct:70.5, puttsPerRound:29.2, sgOTT:0.54, sgAPP:0.72, sgARG:0.08, sgPUTT:-0.14, sgTotal:1.20 },
  "Tom Kim":            { worldRank:21, scoringAvg:69.97, drivingDist:306, fairwayPct:59.3, girPct:69.8, puttsPerRound:29.3, sgOTT:0.48, sgAPP:0.58, sgARG:0.06, sgPUTT:-0.08, sgTotal:1.04 },
  "Sahith Theegala":    { worldRank:24, scoringAvg:70.02, drivingDist:313, fairwayPct:57.6, girPct:69.1, puttsPerRound:29.4, sgOTT:0.72, sgAPP:0.46, sgARG:-0.02, sgPUTT:-0.18, sgTotal:0.98 },
  "Sungjae Im":         { worldRank:26, scoringAvg:70.07, drivingDist:301, fairwayPct:63.4, girPct:70.7, puttsPerRound:29.1, sgOTT:0.28, sgAPP:0.56, sgARG:0.08, sgPUTT:-0.04, sgTotal:0.88 },
  "Akshay Bhatia":      { worldRank:23, scoringAvg:70.01, drivingDist:315, fairwayPct:58.1, girPct:68.9, puttsPerRound:29.5, sgOTT:0.82, sgAPP:0.44, sgARG:-0.06, sgPUTT:-0.24, sgTotal:0.96 },
  "Min Woo Lee":        { worldRank:29, scoringAvg:70.11, drivingDist:310, fairwayPct:58.8, girPct:69.3, puttsPerRound:29.4, sgOTT:0.62, sgAPP:0.48, sgARG:0.02, sgPUTT:-0.14, sgTotal:0.98 },
  "Wyndham Clark":      { worldRank:13, scoringAvg:69.68, drivingDist:316, fairwayPct:56.8, girPct:70.1, puttsPerRound:29.0, sgOTT:0.92, sgAPP:0.72, sgARG:0.04, sgPUTT:-0.16, sgTotal:1.52 },
  "Cameron Young":      { worldRank:31, scoringAvg:70.16, drivingDist:321, fairwayPct:55.9, girPct:68.7, puttsPerRound:29.3, sgOTT:1.02, sgAPP:0.38, sgARG:-0.04, sgPUTT:-0.18, sgTotal:1.18 },
  "Davis Riley":        { worldRank:55, scoringAvg:70.58, drivingDist:305, fairwayPct:61.4, girPct:68.9, puttsPerRound:29.5, sgOTT:0.44, sgAPP:0.32, sgARG:-0.02, sgPUTT:-0.22, sgTotal:0.52 },
  "J.J. Spaun":         { worldRank:62, scoringAvg:70.68, drivingDist:298, fairwayPct:62.8, girPct:67.8, puttsPerRound:29.8, sgOTT:0.14, sgAPP:0.28, sgARG:0.02, sgPUTT:-0.28, sgTotal:0.16 },
  "Kurt Kitayama":      { worldRank:50, scoringAvg:70.51, drivingDist:302, fairwayPct:61.9, girPct:68.5, puttsPerRound:29.6, sgOTT:0.28, sgAPP:0.38, sgARG:0.02, sgPUTT:-0.24, sgTotal:0.44 },
  "Sepp Straka":        { worldRank:33, scoringAvg:70.22, drivingDist:303, fairwayPct:61.9, girPct:69.9, puttsPerRound:29.2, sgOTT:0.32, sgAPP:0.56, sgARG:0.06, sgPUTT:-0.08, sgTotal:0.86 },
  "Jason Day":          { worldRank:35, scoringAvg:70.28, drivingDist:305, fairwayPct:60.1, girPct:70.2, puttsPerRound:28.8, sgOTT:0.44, sgAPP:0.52, sgARG:0.08, sgPUTT:0.22, sgTotal:1.26 },
  "Corey Conners":      { worldRank:40, scoringAvg:70.36, drivingDist:297, fairwayPct:67.4, girPct:70.8, puttsPerRound:29.3, sgOTT:0.08, sgAPP:0.62, sgARG:0.06, sgPUTT:-0.14, sgTotal:0.62 },
  "Bubba Watson":       { worldRank:110,scoringAvg:71.42, drivingDist:309, fairwayPct:52.1, girPct:66.4, puttsPerRound:29.9, sgOTT:0.62, sgAPP:-0.12, sgARG:-0.08, sgPUTT:-0.18, sgTotal:0.24 },
  "Phil Mickelson":     { worldRank:95, scoringAvg:71.18, drivingDist:298, fairwayPct:53.8, girPct:65.1, puttsPerRound:30.1, sgOTT:0.18, sgAPP:-0.08, sgARG:0.18, sgPUTT:-0.22, sgTotal:0.06 },
  "Talor Gooch":        { worldRank:46, scoringAvg:70.45, drivingDist:305, fairwayPct:60.9, girPct:69.0, puttsPerRound:29.4, sgOTT:0.44, sgAPP:0.42, sgARG:0.04, sgPUTT:-0.10, sgTotal:0.80 },
  "Nicolai Hojgaard":   { worldRank:34, scoringAvg:70.24, drivingDist:308, fairwayPct:59.4, girPct:69.1, puttsPerRound:29.4, sgOTT:0.54, sgAPP:0.52, sgARG:0.08, sgPUTT:-0.10, sgTotal:1.04 },
  "Rasmus Hojgaard":    { worldRank:37, scoringAvg:70.30, drivingDist:306, fairwayPct:60.1, girPct:68.8, puttsPerRound:29.5, sgOTT:0.48, sgAPP:0.46, sgARG:0.04, sgPUTT:-0.14, sgTotal:0.84 },
  "Ryan Fox":           { worldRank:36, scoringAvg:70.29, drivingDist:311, fairwayPct:58.6, girPct:68.3, puttsPerRound:29.6, sgOTT:0.64, sgAPP:0.38, sgARG:0.00, sgPUTT:-0.20, sgTotal:0.82 },
  "Sergio Garcia":      { worldRank:80, scoringAvg:70.98, drivingDist:298, fairwayPct:60.8, girPct:67.1, puttsPerRound:30.0, sgOTT:0.18, sgAPP:0.12, sgARG:0.04, sgPUTT:-0.28, sgTotal:0.06 },
  "Tiger Woods":        { worldRank:888,scoringAvg:71.80, drivingDist:285, fairwayPct:57.0, girPct:64.0, puttsPerRound:29.8, sgOTT:-0.24, sgAPP:0.08, sgARG:0.12, sgPUTT:0.18, sgTotal:0.14 },
  "Patrick Reed":       { worldRank:75, scoringAvg:70.91, drivingDist:300, fairwayPct:59.7, girPct:67.4, puttsPerRound:29.8, sgOTT:0.22, sgAPP:0.22, sgARG:0.06, sgPUTT:-0.18, sgTotal:0.32 },
};

export function getPlayerStats(name: string): PlayerSeasonStats | null {
  if (PLAYER_SEASON_STATS[name]) return PLAYER_SEASON_STATS[name];
  const key = Object.keys(PLAYER_SEASON_STATS).find(
    k => k.toLowerCase() === name.toLowerCase()
  );
  return key ? PLAYER_SEASON_STATS[key] : null;
}
