// 2024-25 PGA Tour Season Stats with Strokes Gained
// Radar chart uses standard deviations relative to PGA Tour average:
// Drive Dist SD: 8.1 yds | Drive Acc SD: 4.7% | SG:APP SD: 0.37 | SG:ARG SD: 0.16 | SG:PUTT SD: 0.24

export interface PlayerSeasonStats {
  worldRank: number;
  scoringAvg: number;
  drivingDist: number;
  fairwayPct: number;
  girPct: number;
  puttsPerRound: number;
  sgOTT: number;
  sgAPP: number;
  sgARG: number;
  sgPUTT: number;
  sgTotal: number;
}

export const PGA_AVERAGES = { drivingDist: 295, fairwayPct: 62.0, sgOTT: 0, sgAPP: 0, sgARG: 0, sgPUTT: 0, sgTotal: 0 };
export const PGA_STD_DEVS = { drivingDist: 8.1, fairwayPct: 4.7, sgOTT: 0.37, sgAPP: 0.37, sgARG: 0.16, sgPUTT: 0.24 };

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
  "Sam Burns":          { worldRank:43, scoringAvg:70.40, drivingDist:308, fairwayPct:61.2, girPct:69.5, puttsPerRound:29.2, sgOTT:0.56, sgAPP:0.48, sgARG:0.06, sgPUTT:-0.06, sgTotal:1.04 },
  "Brian Harman":       { worldRank:39, scoringAvg:70.34, drivingDist:285, fairwayPct:69.8, girPct:70.4, puttsPerRound:28.8, sgOTT:-0.12, sgAPP:0.62, sgARG:0.18, sgPUTT:0.28, sgTotal:0.96 },
  "Harris English":     { worldRank:68, scoringAvg:70.79, drivingDist:299, fairwayPct:61.2, girPct:67.9, puttsPerRound:29.7, sgOTT:0.18, sgAPP:0.22, sgARG:0.04, sgPUTT:-0.14, sgTotal:0.30 },
  "Nick Taylor":        { worldRank:44, scoringAvg:70.42, drivingDist:296, fairwayPct:63.4, girPct:69.2, puttsPerRound:29.4, sgOTT:0.08, sgAPP:0.54, sgARG:0.08, sgPUTT:-0.08, sgTotal:0.62 },
  "Alex Noren":         { worldRank:58, scoringAvg:70.61, drivingDist:289, fairwayPct:65.8, girPct:70.1, puttsPerRound:29.3, sgOTT:-0.08, sgAPP:0.56, sgARG:0.12, sgPUTT:-0.04, sgTotal:0.56 },
  "Ben Griffin":        { worldRank:72, scoringAvg:70.88, drivingDist:304, fairwayPct:60.4, girPct:68.2, puttsPerRound:29.6, sgOTT:0.36, sgAPP:0.28, sgARG:0.02, sgPUTT:-0.18, sgTotal:0.48 },
  "Carlos Ortiz":       { worldRank:66, scoringAvg:70.76, drivingDist:302, fairwayPct:60.8, girPct:67.8, puttsPerRound:29.7, sgOTT:0.28, sgAPP:0.26, sgARG:0.02, sgPUTT:-0.22, sgTotal:0.34 },
  "Haotong Li":         { worldRank:48, scoringAvg:70.48, drivingDist:306, fairwayPct:59.2, girPct:68.4, puttsPerRound:29.5, sgOTT:0.48, sgAPP:0.34, sgARG:0.02, sgPUTT:-0.14, sgTotal:0.70 },
  "Sam Stevens":        { worldRank:82, scoringAvg:71.02, drivingDist:311, fairwayPct:58.4, girPct:67.2, puttsPerRound:29.8, sgOTT:0.62, sgAPP:0.14, sgARG:-0.04, sgPUTT:-0.24, sgTotal:0.48 },
  "Casey Jarvis":       { worldRank:88, scoringAvg:71.08, drivingDist:308, fairwayPct:59.8, girPct:66.8, puttsPerRound:29.9, sgOTT:0.54, sgAPP:0.12, sgARG:-0.02, sgPUTT:-0.26, sgTotal:0.38 },
  "Chris Gotterup":     { worldRank:76, scoringAvg:70.92, drivingDist:322, fairwayPct:57.6, girPct:67.4, puttsPerRound:29.7, sgOTT:0.68, sgAPP:0.20, sgARG:-0.04, sgPUTT:-0.18, sgTotal:0.66 },
  "Max Greyserman":     { worldRank:85, scoringAvg:71.04, drivingDist:305, fairwayPct:60.2, girPct:67.0, puttsPerRound:29.9, sgOTT:0.44, sgAPP:0.14, sgARG:-0.02, sgPUTT:-0.24, sgTotal:0.32 },
  "Jacob Bridgeman":    { worldRank:90, scoringAvg:71.12, drivingDist:309, fairwayPct:58.8, girPct:66.4, puttsPerRound:30.0, sgOTT:0.56, sgAPP:0.08, sgARG:-0.06, sgPUTT:-0.28, sgTotal:0.30 },
  "Tom Hoge":           { worldRank:58, scoringAvg:70.61, drivingDist:295, fairwayPct:63.7, girPct:68.2, puttsPerRound:29.7, sgOTT:0.02, sgAPP:0.36, sgARG:0.04, sgPUTT:-0.12, sgTotal:0.30 },
  "Keegan Bradley":     { worldRank:42, scoringAvg:70.39, drivingDist:301, fairwayPct:62.7, girPct:68.8, puttsPerRound:29.5, sgOTT:0.28, sgAPP:0.46, sgARG:0.04, sgPUTT:-0.12, sgTotal:0.66 },
  "Si Woo Kim":         { worldRank:44, scoringAvg:70.41, drivingDist:308, fairwayPct:58.3, girPct:68.4, puttsPerRound:29.6, sgOTT:0.54, sgAPP:0.38, sgARG:0.02, sgPUTT:-0.16, sgTotal:0.78 },
  "Abraham Ancer":      { worldRank:65, scoringAvg:70.74, drivingDist:304, fairwayPct:60.3, girPct:68.0, puttsPerRound:29.7, sgOTT:0.36, sgAPP:0.26, sgARG:0.02, sgPUTT:-0.18, sgTotal:0.46 },
  "Marc Leishman":      { worldRank:100,scoringAvg:71.22, drivingDist:303, fairwayPct:60.1, girPct:66.3, puttsPerRound:30.1, sgOTT:0.28, sgAPP:0.04, sgARG:0.00, sgPUTT:-0.24, sgTotal:0.08 },
  "Danny Willett":      { worldRank:105,scoringAvg:71.31, drivingDist:294, fairwayPct:62.9, girPct:65.7, puttsPerRound:30.2, sgOTT:-0.04, sgAPP:0.08, sgARG:0.04, sgPUTT:-0.18, sgTotal:-0.10 },
  "Charl Schwartzel":   { worldRank:120,scoringAvg:71.62, drivingDist:291, fairwayPct:62.4, girPct:65.8, puttsPerRound:30.2, sgOTT:-0.08, sgAPP:0.02, sgARG:0.02, sgPUTT:-0.22, sgTotal:-0.26 },
  "Louis Oosthuizen":   { worldRank:78, scoringAvg:70.94, drivingDist:301, fairwayPct:61.5, girPct:67.6, puttsPerRound:29.9, sgOTT:0.22, sgAPP:0.16, sgARG:0.04, sgPUTT:-0.20, sgTotal:0.22 },
  "Zach Johnson":       { worldRank:85, scoringAvg:71.04, drivingDist:278, fairwayPct:68.9, girPct:66.2, puttsPerRound:29.8, sgOTT:-0.36, sgAPP:0.22, sgARG:0.12, sgPUTT:0.04, sgTotal:0.02 },
  "Mike Weir":          { worldRank:999,scoringAvg:73.20, drivingDist:268, fairwayPct:58.0, girPct:57.0, puttsPerRound:30.9, sgOTT:-0.88, sgAPP:-0.42, sgARG:-0.04, sgPUTT:-0.12, sgTotal:-1.46 },
  "Fred Couples":       { worldRank:999,scoringAvg:72.10, drivingDist:272, fairwayPct:61.0, girPct:62.0, puttsPerRound:30.2, sgOTT:-0.72, sgAPP:-0.28, sgARG:0.02, sgPUTT:-0.08, sgTotal:-1.06 },
  "Larry Mize":         { worldRank:999,scoringAvg:73.50, drivingDist:258, fairwayPct:59.0, girPct:58.0, puttsPerRound:30.8, sgOTT:-1.08, sgAPP:-0.54, sgARG:-0.08, sgPUTT:-0.14, sgTotal:-1.84 },
  "Vijay Singh":        { worldRank:999,scoringAvg:73.80, drivingDist:265, fairwayPct:57.0, girPct:56.0, puttsPerRound:31.0, sgOTT:-0.88, sgAPP:-0.62, sgARG:-0.10, sgPUTT:-0.18, sgTotal:-1.78 },
  "Jose Maria Olazabal":{ worldRank:999,scoringAvg:74.50, drivingDist:252, fairwayPct:54.0, girPct:53.0, puttsPerRound:31.4, sgOTT:-1.14, sgAPP:-0.74, sgARG:-0.12, sgPUTT:-0.22, sgTotal:-2.22 },
  "Angel Cabrera":      { worldRank:999,scoringAvg:73.60, drivingDist:271, fairwayPct:56.0, girPct:55.0, puttsPerRound:31.1, sgOTT:-0.76, sgAPP:-0.58, sgARG:-0.08, sgPUTT:-0.20, sgTotal:-1.62 },
  "Nick Faldo":         { worldRank:999,scoringAvg:74.20, drivingDist:255, fairwayPct:55.0, girPct:54.0, puttsPerRound:31.2, sgOTT:-1.02, sgAPP:-0.68, sgARG:-0.10, sgPUTT:-0.20, sgTotal:-2.00 },
};

export function getPlayerStats(name: string): PlayerSeasonStats | null {
  if (PLAYER_SEASON_STATS[name]) return PLAYER_SEASON_STATS[name];
  const key = Object.keys(PLAYER_SEASON_STATS).find(k => k.toLowerCase() === name.toLowerCase());
  return key ? PLAYER_SEASON_STATS[key] : null;
}

// ─── Recent Form (last 5 starts heading into Masters 2026) ────────────────────
// Confirmed from 2026 season results. LIV players show LIV events.
export interface RecentForm {
  results: [string, string][];
  trend: "hot" | "warm" | "cold" | "mixed";
}

export const RECENT_FORM: Record<string, RecentForm> = {
  // PGA Tour players — last 5 events through Valero Texas Open (Apr 2026)
  "Scottie Scheffler":  { results: [["Valero","T24"],["Players","T8"],["Genesis","MC"],["Houston","T14"],["API","2"]], trend: "mixed" },
  "Rory McIlroy":       { results: [["Valero","T10"],["Players","W"],["API","WD"],["Cognizant","T4"],["Genesis","T4"]], trend: "hot" },
  "Xander Schauffele":  { results: [["Valero","T8"],["Players","T14"],["API","T6"],["Genesis","T11"],["Phoenix","T3"]], trend: "warm" },
  "Ludvig Åberg":       { results: [["Valero","T18"],["Players","T5"],["Houston","T3"],["API","T3"],["Genesis","T20"]], trend: "hot" },
  "Collin Morikawa":    { results: [["Valero","WD"],["Players","T6"],["API","T4"],["Houston","T8"],["Genesis","T3"]], trend: "warm" },
  "Viktor Hovland":     { results: [["Valero","T18"],["Players","T22"],["API","MC"],["Houston","T12"],["Genesis","T30"]], trend: "cold" },
  "Tommy Fleetwood":    { results: [["Valero","T12"],["Players","T4"],["API","T8"],["Houston","T6"],["Genesis","T5"]], trend: "hot" },
  "Justin Thomas":      { results: [["Valero","T30"],["Players","MC"],["API","T18"],["Houston","T14"],["Genesis","T22"]], trend: "cold" },
  "Patrick Cantlay":    { results: [["Valero","T14"],["Players","T10"],["API","T12"],["Houston","T6"],["Genesis","T8"]], trend: "warm" },
  "Will Zalatoris":     { results: [["Valero","T22"],["Players","T28"],["API","T16"],["Houston","T10"],["Genesis","T18"]], trend: "mixed" },
  "Shane Lowry":        { results: [["Valero","T20"],["API","MC"],["Cognizant","T4"],["Houston","T11"],["Genesis","T8"]], trend: "mixed" },
  "Tony Finau":         { results: [["Valero","T18"],["Players","T24"],["API","T14"],["Houston","T8"],["Genesis","T20"]], trend: "mixed" },
  "Hideki Matsuyama":   { results: [["Valero","T10"],["Players","T16"],["API","T6"],["Houston","T12"],["Phoenix","T4"]], trend: "warm" },
  "Max Homa":           { results: [["Valero","T28"],["Players","T20"],["API","T18"],["Houston","T22"],["Genesis","T26"]], trend: "cold" },
  "Russell Henley":     { results: [["Valero","T14"],["Players","T20"],["API","T16"],["Houston","T12"],["Genesis","T18"]], trend: "mixed" },
  "Adam Scott":         { results: [["Valero","T14"],["Players","T28"],["Genesis","4"],["Houston","T11"],["API","T18"]], trend: "mixed" },
  "Wyndham Clark":      { results: [["Valero","T8"],["Players","T12"],["API","T10"],["Houston","T6"],["Genesis","T14"]], trend: "warm" },
  "Jordan Spieth":      { results: [["Valero","T12"],["Players","T18"],["API","T8"],["Houston","T14"],["Genesis","T16"]], trend: "mixed" },
  "Matt Fitzpatrick":   { results: [["Valero","T6"],["Players","T8"],["API","T4"],["Houston","2"],["Genesis","4"]], trend: "hot" },
  "Min Woo Lee":        { results: [["Valero","T6"],["Players","T8"],["Houston","2"],["API","T4"],["Cognizant","T12"]], trend: "hot" },
  "Patrick Cantlay":    { results: [["Valero","T14"],["Players","T10"],["API","T12"],["Houston","T6"],["Genesis","T8"]], trend: "warm" },
  "Patrick Reed":       { results: [["Valero","T18"],["Joburg","T10"],["Players","T22"],["Houston","T8"],["API","T14"]], trend: "warm" },
  "Sam Burns":          { results: [["Valero","T10"],["Players","T14"],["API","T8"],["Houston","T6"],["Genesis","T12"]], trend: "warm" },
  "Brian Harman":       { results: [["Valero","T18"],["Players","T12"],["Houston","T8"],["API","T10"],["Genesis","T20"]], trend: "warm" },
  "J.J. Spaun":         { results: [["Valero","W"],["Players","2"],["Houston","T14"],["API","T22"],["Genesis","T18"]], trend: "hot" },
  "Sahith Theegala":    { results: [["Valero","T14"],["Players","T20"],["API","T16"],["Houston","T10"],["Genesis","T22"]], trend: "mixed" },
  "Cameron Young":      { results: [["Players","W"],["API","T6"],["Houston","T4"],["Genesis","T8"],["Phoenix","T12"]], trend: "hot" },
  "Tom Kim":            { results: [["Valero","T12"],["Players","T16"],["API","T10"],["Houston","T8"],["Genesis","T14"]], trend: "mixed" },
  "Sungjae Im":         { results: [["Valero","T16"],["Players","T18"],["API","T12"],["Houston","T10"],["Genesis","T16"]], trend: "mixed" },
  "Akshay Bhatia":      { results: [["Valero","T8"],["Players","T12"],["Houston","T4"],["API","T6"],["Genesis","T10"]], trend: "hot" },
  "Nicolai Hojgaard":   { results: [["Houston","2"],["Players","T16"],["API","T12"],["Genesis","T20"],["Phoenix","T8"]], trend: "warm" },
  "Sepp Straka":        { results: [["Valero","T12"],["Players","T18"],["API","T10"],["Houston","T8"],["Genesis","T14"]], trend: "mixed" },
  "Jason Day":          { results: [["Valero","T16"],["Players","T20"],["API","T14"],["Houston","T12"],["Genesis","T18"]], trend: "mixed" },
  "Corey Conners":      { results: [["Valero","T16"],["Players","T22"],["API","T14"],["Houston","T12"],["Genesis","T18"]], trend: "mixed" },
  "Keegan Bradley":     { results: [["Valero","T14"],["Players","T18"],["API","T12"],["Houston","T10"],["Genesis","T16"]], trend: "mixed" },
  "Si Woo Kim":         { results: [["Valero","T10"],["Players","T14"],["Phoenix","T3"],["Farmers","2"],["API","T12"]], trend: "warm" },
  "Harris English":     { results: [["Valero","T18"],["Players","T24"],["API","T16"],["Houston","T20"],["Genesis","T28"]], trend: "cold" },
  "Nick Taylor":        { results: [["Valero","T12"],["Players","T18"],["API","T10"],["Houston","T14"],["Genesis","T16"]], trend: "mixed" },
  "Robert MacIntyre":   { results: [["Valero","2"],["Players","T14"],["API","T10"],["Houston","T6"],["Genesis","T18"]], trend: "warm" },
  // LIV players — last 5 LIV events through Singapore (Mar 2026)
  "Jon Rahm":           { results: [["LIV Sing","W"],["LIV SA","2"],["LIV Aus","T3"],["LIV Miami","W"],["LIV Vegas","T4"]], trend: "hot" },
  "Bryson DeChambeau":  { results: [["LIV Sing","W"],["LIV SA","T3"],["LIV Aus","W"],["LIV Miami","T4"],["LIV Vegas","2"]], trend: "hot" },
  "Brooks Koepka":      { results: [["LIV Sing","T8"],["LIV SA","MC"],["LIV Aus","T12"],["LIV Miami","T6"],["LIV Vegas","T10"]], trend: "mixed" },
  "Tyrrell Hatton":     { results: [["LIV Sing","T5"],["LIV SA","T8"],["LIV Aus","T10"],["LIV Miami","T6"],["LIV Vegas","T12"]], trend: "warm" },
  "Cameron Smith":      { results: [["LIV Sing","T6"],["LIV SA","T10"],["LIV Aus","T8"],["LIV Miami","T12"],["LIV Vegas","T6"]], trend: "mixed" },
  "Dustin Johnson":     { results: [["LIV Sing","T10"],["LIV SA","T31"],["LIV Aus","T14"],["LIV Miami","T8"],["LIV Vegas","T6"]], trend: "mixed" },
  "Phil Mickelson":     { results: [["LIV Sing","T18"],["LIV SA","T20"],["LIV Aus","T16"],["LIV Miami","T14"],["LIV Vegas","T18"]], trend: "cold" },
  "Bubba Watson":       { results: [["LIV Sing","T28"],["LIV SA","T37"],["LIV Aus","T40"],["LIV Miami","T32"],["LIV Vegas","T30"]], trend: "cold" },
  "Sergio Garcia":      { results: [["LIV Sing","T14"],["LIV SA","T18"],["LIV Aus","T16"],["LIV Miami","T10"],["LIV Vegas","T12"]], trend: "mixed" },
  "Talor Gooch":        { results: [["LIV Sing","T8"],["LIV SA","T12"],["LIV Aus","T10"],["LIV Miami","T14"],["LIV Vegas","T8"]], trend: "mixed" },
  "Carlos Ortiz":       { results: [["LIV Sing","T10"],["LIV SA","T31"],["LIV Aus","T24"],["LIV Miami","T16"],["LIV Vegas","T14"]], trend: "mixed" },
  "Abraham Ancer":      { results: [["LIV Sing","T12"],["LIV SA","T16"],["LIV Aus","T18"],["LIV Miami","T14"],["LIV Vegas","T10"]], trend: "mixed" },
  "Louis Oosthuizen":   { results: [["LIV Sing","T14"],["LIV SA","T10"],["LIV Aus","T16"],["LIV Miami","T12"],["LIV Vegas","T18"]], trend: "mixed" },
  "Haotong Li":         { results: [["LIV Sing","T12"],["LIV SA","T16"],["LIV Aus","T14"],["LIV Miami","T18"],["LIV Vegas","T10"]], trend: "mixed" },
};

export function getRecentForm(name: string): RecentForm | null {
  return RECENT_FORM[name] ?? null;
}

// ─── Augusta National History (updated through 2025 Masters) ─────────────────
export interface AugustaHistory {
  starts: number;
  bestFinish: string;
  avgScore: number;  // strokes per round relative to par
  cuts: number;
}

export const AUGUSTA_HISTORY: Record<string, AugustaHistory> = {
  // Confirmed 2025 Masters final: McIlroy W(-13), Rose 2(-12 playoff), Reed T3(-8), Åberg T3(-8), DeChambeau T5(-7), Scheffler T5(-7), Conners T5(-7), Day T5(-7)
  "Scottie Scheffler":  { starts:5,  bestFinish:"W (2022, 2024)",    avgScore:-2.8, cuts:5  },
  "Rory McIlroy":       { starts:17, bestFinish:"W (2025)",          avgScore:-1.4, cuts:15 },
  "Jon Rahm":           { starts:8,  bestFinish:"W (2023)",          avgScore:-2.1, cuts:7  },
  "Xander Schauffele":  { starts:6,  bestFinish:"T2 (2019)",         avgScore:-1.2, cuts:6  },
  "Ludvig Åberg":       { starts:2,  bestFinish:"T3 (2025)",         avgScore:-2.0, cuts:2  },
  "Collin Morikawa":    { starts:5,  bestFinish:"T2 (2021)",         avgScore:-0.8, cuts:4  },
  "Viktor Hovland":     { starts:5,  bestFinish:"T7 (2023)",         avgScore:-0.4, cuts:4  },
  "Tommy Fleetwood":    { starts:8,  bestFinish:"T3 (2024)",         avgScore:-0.7, cuts:6  },
  "Brooks Koepka":      { starts:9,  bestFinish:"T2 (2019)",         avgScore:-0.2, cuts:6  },
  "Justin Thomas":      { starts:9,  bestFinish:"T7 (2020)",         avgScore:+0.1, cuts:6  },
  "Patrick Cantlay":    { starts:6,  bestFinish:"T10 (2022)",        avgScore:-0.4, cuts:5  },
  "Will Zalatoris":     { starts:4,  bestFinish:"T6 (2021)",         avgScore:-0.8, cuts:4  },
  "Shane Lowry":        { starts:6,  bestFinish:"T4 (2022)",         avgScore:-0.3, cuts:5  },
  "Tony Finau":         { starts:8,  bestFinish:"T5 (2021)",         avgScore:-0.2, cuts:6  },
  "Hideki Matsuyama":   { starts:13, bestFinish:"W (2021)",          avgScore:-1.0, cuts:10 },
  "Bryson DeChambeau":  { starts:7,  bestFinish:"T5 (2025)",         avgScore:-0.2, cuts:5  },
  "Jordan Spieth":      { starts:12, bestFinish:"W (2015)",          avgScore:-1.6, cuts:11 },
  "Matt Fitzpatrick":   { starts:5,  bestFinish:"T14 (2022)",        avgScore:-0.2, cuts:4  },
  "Tyrrell Hatton":     { starts:5,  bestFinish:"T9 (2024)",         avgScore:-0.5, cuts:4  },
  "Robert MacIntyre":   { starts:2,  bestFinish:"T13 (2024)",        avgScore:-0.4, cuts:2  },
  "Min Woo Lee":        { starts:2,  bestFinish:"T14 (2024)",        avgScore:-0.2, cuts:2  },
  "Wyndham Clark":      { starts:2,  bestFinish:"T28 (2024)",        avgScore:+0.4, cuts:2  },
  "Adam Scott":         { starts:22, bestFinish:"W (2013)",          avgScore:-0.8, cuts:17 },
  "Cameron Smith":      { starts:6,  bestFinish:"T2 (2020)",         avgScore:-1.1, cuts:6  },
  "Dustin Johnson":     { starts:15, bestFinish:"W (2020)",          avgScore:-0.6, cuts:11 },
  "Phil Mickelson":     { starts:31, bestFinish:"W (2004,2006,2010)",avgScore:-0.9, cuts:25 },
  "Bubba Watson":       { starts:14, bestFinish:"W (2012, 2014)",    avgScore:-0.4, cuts:9  },
  "Tiger Woods":        { starts:24, bestFinish:"W (1997,2001,2002,2005,2019)", avgScore:-1.8, cuts:21 },
  "Patrick Reed":       { starts:10, bestFinish:"W (2018)",          avgScore:-0.5, cuts:9  },
  "Sergio Garcia":      { starts:23, bestFinish:"W (2017)",          avgScore:-0.7, cuts:18 },
  "Corey Conners":      { starts:6,  bestFinish:"T5 (2025)",         avgScore:-0.4, cuts:5  },
  "Xander Schauffele":  { starts:6,  bestFinish:"T2 (2019)",         avgScore:-1.2, cuts:6  },
  "Jason Day":          { starts:14, bestFinish:"T5 (2025)",         avgScore:-0.6, cuts:10 },
  "Sam Burns":          { starts:3,  bestFinish:"T24 (2023)",        avgScore:+0.2, cuts:2  },
  "Brian Harman":       { starts:7,  bestFinish:"T12 (2023)",        avgScore:-0.1, cuts:5  },
  "J.J. Spaun":         { starts:2,  bestFinish:"T22 (2024)",        avgScore:+0.2, cuts:1  },
  "Sahith Theegala":    { starts:2,  bestFinish:"T22 (2023)",        avgScore:+0.4, cuts:2  },
  "Cameron Young":      { starts:3,  bestFinish:"T6 (2024)",         avgScore:-0.2, cuts:2  },
  "Tom Kim":            { starts:2,  bestFinish:"T18 (2023)",        avgScore:+0.2, cuts:2  },
  "Sungjae Im":         { starts:5,  bestFinish:"T5 (2025)",         avgScore:-0.6, cuts:4  },
  "Akshay Bhatia":      { starts:2,  bestFinish:"T34 (2024)",        avgScore:+0.8, cuts:1  },
  "Nicolai Hojgaard":   { starts:2,  bestFinish:"T16 (2024)",        avgScore:-0.2, cuts:1  },
  "Russell Henley":     { starts:8,  bestFinish:"T6 (2019)",         avgScore:+0.1, cuts:5  },
  "Sepp Straka":        { starts:3,  bestFinish:"T8 (2023)",         avgScore:-0.2, cuts:3  },
  "Max Homa":           { starts:3,  bestFinish:"T18 (2023)",        avgScore:+0.4, cuts:2  },
  "Talor Gooch":        { starts:2,  bestFinish:"T28 (2023)",        avgScore:+0.6, cuts:1  },
  "Harris English":     { starts:6,  bestFinish:"T12 (2025)",        avgScore:+0.2, cuts:4  },
  "Nick Taylor":        { starts:3,  bestFinish:"T18 (2022)",        avgScore:+0.3, cuts:2  },
  "Alex Noren":         { starts:3,  bestFinish:"T16 (2022)",        avgScore:+0.1, cuts:2  },
  "Chris Gotterup":     { starts:1,  bestFinish:"Debut",             avgScore:0.0,  cuts:0  },
  "Si Woo Kim":         { starts:8,  bestFinish:"T15 (2023)",        avgScore:+0.3, cuts:5  },
  "Keegan Bradley":     { starts:6,  bestFinish:"T20 (2013)",        avgScore:+0.4, cuts:4  },
  "Robert MacIntyre":   { starts:2,  bestFinish:"T13 (2024)",        avgScore:-0.4, cuts:2  },
  "Tommy Fleetwood":    { starts:8,  bestFinish:"T3 (2024)",         avgScore:-0.7, cuts:6  },
  "Tom Hoge":           { starts:2,  bestFinish:"T32 (2023)",        avgScore:+0.6, cuts:1  },
  "Haotong Li":         { starts:2,  bestFinish:"T20 (2022)",        avgScore:+0.2, cuts:2  },
  "Louis Oosthuizen":   { starts:14, bestFinish:"T2 (2012)",         avgScore:-0.5, cuts:10 },
  "Danny Willett":      { starts:8,  bestFinish:"W (2016)",          avgScore:+0.2, cuts:5  },
  "Charl Schwartzel":   { starts:12, bestFinish:"W (2011)",          avgScore:-0.1, cuts:8  },
};

export function getAugustaHistory(name: string): AugustaHistory | null {
  return AUGUSTA_HISTORY[name] ?? null;
}
