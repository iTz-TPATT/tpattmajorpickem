export type TournamentId = "masters" | "pga" | "usopen" | "theopen";

export interface RoundConfig {
  date: string;
  revealTimeUTC: string;
}

export interface CoursePhoto {
  url: string;
  caption: string;
}

export interface TournamentTheme {
  bg: string; bgDark: string; bgMid: string;
  accent: string; accentLight: string;
  cream: string; creamDim: string;
  cardBg: string; cardBorder: string;
  scoreLow: string; scoreHigh: string;
  emoji: string; gradient: string;
  photos: CoursePhoto[];
}

export interface Tournament {
  id: TournamentId; name: string; shortName: string; location: string; year: number;
  rounds: Record<1|2|3|4, RoundConfig>;
  priorChampion: { name: string; year: number };
  theme: TournamentTheme;
  oddsKey: string;
}

export const TOURNAMENTS: Record<TournamentId, Tournament> = {
  masters: {
    id: "masters", name: "The Masters Tournament", shortName: "The Masters",
    location: "Augusta National Golf Club · Augusta, GA", year: 2026,
    rounds: {
      1: { date: "2026-04-10", revealTimeUTC: "2026-04-10T12:00:00Z" },
      2: { date: "2026-04-11", revealTimeUTC: "2026-04-11T12:00:00Z" },
      3: { date: "2026-04-12", revealTimeUTC: "2026-04-12T13:30:00Z" },
      4: { date: "2026-04-13", revealTimeUTC: "2026-04-13T13:30:00Z" },
    },
    priorChampion: { name: "Wyatt T.O. Robson", year: 2025 },
    theme: {
      bg: "#071510", bgDark: "#0f2318", bgMid: "#1a3a28",
      accent: "#c9a84c", accentLight: "#e2c97e",
      cream: "#f0e9d6", creamDim: "#c8bfa8",
      cardBg: "rgba(255,255,255,0.04)", cardBorder: "rgba(201,168,76,0.18)",
      scoreLow: "#5dba7e", scoreHigh: "#e07b6f", emoji: "🌿",
      gradient: "linear-gradient(135deg,#071510 0%,#0f2318 50%,#071510 100%)",
      // Wikimedia Commons — verified Augusta National photos
      photos: [
        {
          url: "https://commons.wikimedia.org/wiki/Special:FilePath/Augusta_National_Golf_Club_12th_hole.jpg",
          caption: "12th Hole — Golden Bell · Augusta National",
        },
        {
          url: "https://commons.wikimedia.org/wiki/Special:FilePath/Augusta_National_Golf_Club_13th_hole.jpg",
          caption: "13th Hole — Azalea · Augusta National",
        },
        {
          url: "https://commons.wikimedia.org/wiki/Special:FilePath/Augusta_National_Golf_Club_16th_hole.jpg",
          caption: "16th Hole — Redbud · Augusta National",
        },
        {
          url: "https://commons.wikimedia.org/wiki/Special:FilePath/Augusta_National_Golf_Club.jpg",
          caption: "Augusta National Golf Club · Augusta, Georgia",
        },
      ],
    },
    oddsKey: "golf_masters_tournament_winner",
  },
  pga: {
    id: "pga", name: "PGA Championship", shortName: "PGA Championship",
    location: "Quail Hollow Club · Charlotte, NC", year: 2026,
    rounds: {
      1: { date: "2026-05-21", revealTimeUTC: "2026-05-21T12:00:00Z" },
      2: { date: "2026-05-22", revealTimeUTC: "2026-05-22T12:00:00Z" },
      3: { date: "2026-05-23", revealTimeUTC: "2026-05-23T13:30:00Z" },
      4: { date: "2026-05-24", revealTimeUTC: "2026-05-24T13:30:00Z" },
    },
    priorChampion: { name: "Wyatt T.O. Robson", year: 2025 },
    theme: {
      bg: "#060d1f", bgDark: "#0d1a35", bgMid: "#1a2d55",
      accent: "#8facd4", accentLight: "#b8cee6",
      cream: "#e8eef5", creamDim: "#8a9eb8",
      cardBg: "rgba(255,255,255,0.04)", cardBorder: "rgba(143,172,212,0.2)",
      scoreLow: "#5dba9e", scoreHigh: "#e07b6f", emoji: "🏆",
      gradient: "linear-gradient(135deg,#060d1f 0%,#0d1a35 50%,#060d1f 100%)",
      photos: [
        {
          url: "https://commons.wikimedia.org/wiki/Special:FilePath/Quail_Hollow_Club_18th_hole.jpg",
          caption: "18th Hole — The Green Mile · Quail Hollow Club",
        },
      ],
    },
    oddsKey: "golf_pga_championship_winner",
  },
  usopen: {
    id: "usopen", name: "U.S. Open Championship", shortName: "U.S. Open",
    location: "Oakmont Country Club · Oakmont, PA", year: 2026,
    rounds: {
      1: { date: "2026-06-18", revealTimeUTC: "2026-06-18T12:00:00Z" },
      2: { date: "2026-06-19", revealTimeUTC: "2026-06-19T12:00:00Z" },
      3: { date: "2026-06-20", revealTimeUTC: "2026-06-20T13:30:00Z" },
      4: { date: "2026-06-21", revealTimeUTC: "2026-06-21T13:30:00Z" },
    },
    priorChampion: { name: 'Corbin "Lite It Up" Blount', year: 2025 },
    theme: {
      bg: "#0a0d18", bgDark: "#0f1428", bgMid: "#1c2040",
      accent: "#c8303e", accentLight: "#e05060",
      cream: "#f0f0f5", creamDim: "#9090a8",
      cardBg: "rgba(255,255,255,0.04)", cardBorder: "rgba(200,48,62,0.22)",
      scoreLow: "#5dba7e", scoreHigh: "#e07b6f", emoji: "🇺🇸",
      gradient: "linear-gradient(135deg,#0a0d18 0%,#0f1428 50%,#0a0d18 100%)",
      photos: [
        {
          url: "https://commons.wikimedia.org/wiki/Special:FilePath/Oakmont_Country_Club_church_pew_bunkers.jpg",
          caption: "Church Pew Bunkers · Oakmont Country Club",
        },
      ],
    },
    oddsKey: "golf_us_open_winner",
  },
  theopen: {
    id: "theopen", name: "The Open Championship", shortName: "The Open",
    location: "Royal Portrush Golf Club · Portrush, N. Ireland", year: 2026,
    rounds: {
      1: { date: "2026-07-16", revealTimeUTC: "2026-07-16T10:00:00Z" },
      2: { date: "2026-07-17", revealTimeUTC: "2026-07-17T10:00:00Z" },
      3: { date: "2026-07-18", revealTimeUTC: "2026-07-18T11:00:00Z" },
      4: { date: "2026-07-19", revealTimeUTC: "2026-07-19T11:00:00Z" },
    },
    priorChampion: { name: 'Corbin "Lite It Up" Blount', year: 2025 },
    theme: {
      bg: "#0c0c0c", bgDark: "#181818", bgMid: "#282828",
      accent: "#e8c030", accentLight: "#f5d860",
      cream: "#f0f0e8", creamDim: "#a0a090",
      cardBg: "rgba(255,255,255,0.04)", cardBorder: "rgba(232,192,48,0.2)",
      scoreLow: "#5dba7e", scoreHigh: "#e07b6f", emoji: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
      gradient: "linear-gradient(135deg,#0c0c0c 0%,#181818 50%,#0c0c0c 100%)",
      photos: [
        {
          url: "https://commons.wikimedia.org/wiki/Special:FilePath/Royal_Portrush_Golf_Club_-_Dunluce_Links.jpg",
          caption: "Dunluce Links · Royal Portrush Golf Club",
        },
      ],
    },
    oddsKey: "golf_the_open_championship_winner",
  },
};

export function getActiveTournament(): Tournament {
  const now = new Date();
  const list = Object.values(TOURNAMENTS);
  for (const t of list) {
    const start = new Date(t.rounds[1].date + "T00:00:00Z");
    const end = new Date(t.rounds[4].date + "T23:59:59Z");
    if (now >= start && now <= end) return t;
  }
  const upcoming = list.filter((t) => new Date(t.rounds[1].date + "T00:00:00Z") > now)
    .sort((a, b) => new Date(a.rounds[1].date).getTime() - new Date(b.rounds[1].date).getTime());
  if (upcoming.length > 0) return upcoming[0];
  return TOURNAMENTS.theopen;
}

export function getCurrentRound(t: Tournament): number {
  const now = new Date();
  for (let r = 1; r <= 4; r++) {
    if (now < new Date(t.rounds[r as 1|2|3|4].revealTimeUTC)) return r;
  }
  return 4;
}

export function isRoundRevealed(t: Tournament, round: number): boolean {
  return new Date() >= new Date(t.rounds[round as 1|2|3|4].revealTimeUTC);
}

export function isTournamentStarted(t: Tournament): boolean {
  return new Date() >= new Date(t.rounds[1].revealTimeUTC);
}

export function isTournamentComplete(t: Tournament): boolean {
  return new Date() > new Date(t.rounds[4].date + "T23:59:59Z");
}

export function calcRoundScore(scores: (number|null)[], round: number): number {
  const valid = scores.filter((s): s is number => s !== null);
  if (valid.length === 0) return 0;
  if (round <= 2) return [...valid].sort((a,b) => a-b).slice(0,2).reduce((s,v) => s+v, 0);
  return valid.reduce((s,v) => s+v, 0);
}

export const ROUND_LABELS: Record<number, string> = {
  1: "Round 1", 2: "Round 2", 3: "Round 3", 4: "Round 4",
};
