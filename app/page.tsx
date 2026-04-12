"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  TOURNAMENTS, getActiveTournament, getCurrentRound, isRoundRevealed,
  isTournamentStarted, calcRoundScore, ROUND_LABELS, Tournament, TournamentId,
} from "@/lib/tournaments";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Pick { username: string; user_id: string; round_number: number; golfer: string; }
interface GolferScore {
  name: string; espnId: string; headshot: string | null;
  totalScore: number; position: string; status: string;
  r1: number | null; r2: number | null; r3: number | null; r4: number | null;
  teeTime: string | null;
  thru: string | null;
}
type Tab = "picks" | "leaderboard" | "tournament" | "history" | "course" | "newsroom";

// ─── Utilities ────────────────────────────────────────────────────────────────
function normalizeName(name: string): string {
  return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
}


// ─── Avatar ───────────────────────────────────────────────────────────────────
// Aliases for users who signed up with only a first name.
// Maps the stored username → { displayName, avatarSlug }
const USER_ALIASES: Record<string, { displayName: string; avatarSlug: string }> = {
  "Corbin":  { displayName: "Corbin Blount",  avatarSlug: "corbin-blount" },
  "Spencer": { displayName: "Spencer Ledwith", avatarSlug: "spencer-ledwith" },
};

function resolveUser(username: string): { displayName: string; avatarSlug: string } {
  const alias = USER_ALIASES[username.trim()];
  if (alias) return alias;
  const slug = username.trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, "-");
  return { displayName: username, avatarSlug: slug };
}

function avatarUrl(username: string): string {
  const { avatarSlug } = resolveUser(username);
  return `/avatars/${avatarSlug}.jpg`;
}

function PlayerAvatar({ username, size = 32, style }: {
  username: string;
  size?: number;
  style?: React.CSSProperties;
}) {
  const [srcIndex, setSrcIndex] = useState(0);
  const { displayName, avatarSlug } = resolveUser(username);
  const initials = displayName.trim().split(/\s+/).map(w => w[0]?.toUpperCase() ?? "").slice(0, 2).join("");
  const hue = username.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;

  const srcs = [`/avatars/${avatarSlug}.jpg`, `/avatars/${avatarSlug}.png`];
  const currentSrc = srcs[srcIndex];

  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      overflow: "hidden", flexShrink: 0, position: "relative",
      background: `hsl(${hue}, 45%, 30%)`,
      border: "1px solid rgba(255,255,255,0.15)",
      display: "flex", alignItems: "center", justifyContent: "center",
      ...style,
    }}>
      {currentSrc ? (
        
        <img
          src={currentSrc}
          alt={username}
          onError={() => setSrcIndex(prev => prev + 1)}
          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 20%" }}
        />
      ) : (
        <span style={{ fontSize: size * 0.38, color: "rgba(255,255,255,0.85)", fontFamily: "Playfair Display, serif", fontWeight: 600, userSelect: "none" }}>
          {initials}
        </span>
      )}
    </div>
  );
}

function fmtScore(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  if (n === 0) return "E";
  return n > 0 ? `+${n}` : `${n}`;
}

function fmtCountdown(to: Date): string {
  const diff = to.getTime() - Date.now();
  if (diff <= 0) return "Picks locked";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return `${h}h ${m}m ${s}s`;
}

function getRoundScore(golfer: GolferScore | undefined, round: number): number | null {
  if (!golfer) return null;
  return [null, golfer.r1, golfer.r2, golfer.r3, golfer.r4][round] ?? null;
}

// ─── Theme helpers ────────────────────────────────────────────────────────────
function themeVars(t: Tournament): React.CSSProperties {
  const th = t.theme;
  return {
    "--bg": th.bg, "--bg-dark": th.bgDark, "--bg-mid": th.bgMid,
    "--accent": th.accent, "--accent-light": th.accentLight,
    "--cream": th.cream, "--cream-dim": th.creamDim,
    "--card-bg": th.cardBg, "--card-border": th.cardBorder,
    "--score-low": th.scoreLow, "--score-high": th.scoreHigh,
  } as React.CSSProperties;
}

const inp: React.CSSProperties = {
  width: "100%", padding: "10px 14px",
  background: "rgba(255,255,255,0.05)", border: "1px solid var(--card-border)",
  borderRadius: 8, color: "var(--cream)", fontSize: 15, outline: "none",
  fontFamily: "EB Garamond, serif",
};

// ─── Shared card style ────────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background: "var(--card-bg)", border: "1px solid var(--card-border)",
  borderRadius: 10, padding: "20px 22px", marginBottom: 16,
};

// ─── Score color ──────────────────────────────────────────────────────────────
function scoreColor(n: number | null): string {
  if (n === null) return "var(--cream-dim)";
  if (n < 0) return "var(--score-low)";
  if (n > 0) return "var(--score-high)";
  return "var(--cream)";
}


// ─── Course Data ──────────────────────────────────────────────────────────────
interface HoleInfo {
  hole: number; name: string; par: number; yards: number;
  description: string; notes: string;
}

const COURSE_DATA: Record<string, { name: string; location: string; par: number; yards: number; holes: HoleInfo[] }> = {
  masters: {
    name: "Augusta National Golf Club",
    location: "Augusta, Georgia",
    par: 72,
    yards: 7510,
    holes: [
      { hole:1,  name:"Tea Olive",     par:4, yards:445, description:"Dogleg right downhill opener. Drive must avoid the fairway bunker on the right. Approach uphill to a narrow green with a ridge dividing it front to back.", notes:"Scoring hole — a par here settles the nerves." },
      { hole:2,  name:"Pink Dogwood",  par:5, yards:575, description:"Long par-5 bending left. Second shot over a hill leaves a tricky downhill lie. The green is sharply contoured — two-putts from above the hole are dangerous.", notes:"Reachable in two but the green slopes severely." },
      { hole:3,  name:"Flowering Peach",par:4,yards:350, description:"Short par-4 tempting aggressive drives. The small green is well-bunkered and sits above the fairway. A bump-and-run is often preferred over a high iron.", notes:"Shortest par-4 — birdie opportunity." },
      { hole:4,  name:"Flowering Crab Apple",par:3,yards:240, description:"Long par-3 playing to a severely banked green. The left bunker is almost impossible; missing right leaves a chip back toward a steep fall-off.", notes:"One of the hardest par-3s on the PGA Tour." },
      { hole:5,  name:"Magnolia",      par:4, yards:455, description:"Uphill par-4 with a fairway bunker at the landing zone. The green sits above the fairway with a ridge — front pin positions demand precise distance control.", notes:"Uphill all the way — plays longer than the card says." },
      { hole:6,  name:"Juniper",       par:3, yards:180, description:"Downhill par-3 over a valley. The green slopes back-to-front — above the hole means a treacherous putt. Wind swirls unpredictably in the pines.", notes:"Distance club selection is critical." },
      { hole:7,  name:"Pampas",        par:4, yards:450, description:"Short dogleg left requiring a precise tee shot. The tight green is guarded by bunkers and falls off sharply left. One of the most demanding approach shots on the course.", notes:"Tighter than it looks off the tee." },
      { hole:8,  name:"Yellow Jasmine", par:5, yards:570, description:"Uphill par-5. Second shot over a ridge makes it nearly impossible to reach in two. Third shot to a crowned green — anything above the hole leaves a near-impossible putt.", notes:"Most three-putts on the course." },
      { hole:9,  name:"Carolina Cherry",par:4, yards:460, description:"Downhill dogleg left with fairway bunkers flanking the driving zone. The approach plays downhill to a wildly sloping green — front and back pins are completely different challenges.", notes:"One of the most demanding approach shots at Augusta." },
      { hole:10, name:"Camellia",      par:4, yards:495, description:"Opening hole of the back nine — sharp dogleg left downhill. Long hitters can cut the corner. The green is perched on a hillside and slopes dramatically from back to front.", notes:"Tee shot down the hill sets up everything." },
      { hole:11, name:"White Dogwood", par:4, yards:520, description:"First hole of Amen Corner. Long par-4 with a pond guarding the left side of the green. The famous Sunday pin position dares players to attack — most end up in the water.", notes:"Where Masters are won and lost." },
      { hole:12, name:"Golden Bell",   par:3, yards:155, description:"The most famous par-3 in golf. Rae's Creek runs in front; bunkers behind. Wind swirls from every direction in the trees. The green has almost no margin for error.", notes:"Never the same wind twice. Club selection is a guess." },
      { hole:13, name:"Azalea",        par:5, yards:510, description:"Dogleg left par-5 that is the signature risk/reward hole. Rae's Creek crosses in front of the green — reaching in two requires carrying the creek and avoiding the left bunker. Azaleas bloom pink and red behind the green.", notes:"The most beautiful hole in golf. Go for it." },
      { hole:14, name:"Chinese Fir",   par:4, yards:440, description:"Straight par-4 with no bunkers — unusual for Augusta. The challenge is entirely the green, which has several tiers and some of the most severe undulation on the course.", notes:"The green is the most treacherous on the course." },
      { hole:15, name:"Firethorn",     par:5, yards:550, description:"Short par-5 reachable for almost everyone with a good drive. The pond in front of the green has claimed countless approach shots from players going for the eagle. Gateway to the famous back nine stretch.", notes:"Safe layup or aggressive attack — decide early." },
      { hole:16, name:"Redbud",        par:3, yards:170, description:"Par-3 over water. The massive green allows creative shot-making — players often aim for the middle and let the slope feed the ball to the pin. The front-right Sunday pin is the most dramatic in golf.", notes:"When the Sunday pin is front-right, the gallery roars." },
      { hole:17, name:"Nandina",       par:4, yards:440, description:"Dogleg right par-4. The green is long and narrow, running front-to-back on a plateau. An approach from the fairway bunker leaves a very difficult angle. The right side of the green drops off sharply.", notes:"Underestimated hole — subtle difficulties everywhere." },
      { hole:18, name:"Holly",         par:4, yards:465, description:"Uphill closing par-4 in front of the iconic clubhouse. The fairway bunkers on the left demand a right-side tee shot. The elevated green has two tiers — above the hole means a downhill slider to close with.", notes:"The grandstand roar here is unlike anything in golf." },
    ],
  },
};

function getCourseData(tournamentId: string) {
  return COURSE_DATA[tournamentId] ?? null;
}

// ─── Golf Ball Icon ────────────────────────────────────────────────────────────
function TexasIcon({ size = 28, color = "white" }: { size?: number; color?: string }) {
  // Gold golf ball outline with dimple pattern
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Outer circle */}
      <circle cx="20" cy="20" r="17" stroke={color} strokeWidth="2" fill="none" />
      {/* Dimple pattern — small circles */}
      <circle cx="20" cy="10" r="1.8" fill={color} opacity="0.7" />
      <circle cx="20" cy="30" r="1.8" fill={color} opacity="0.7" />
      <circle cx="10" cy="20" r="1.8" fill={color} opacity="0.7" />
      <circle cx="30" cy="20" r="1.8" fill={color} opacity="0.7" />
      <circle cx="13" cy="13" r="1.8" fill={color} opacity="0.7" />
      <circle cx="27" cy="13" r="1.8" fill={color} opacity="0.7" />
      <circle cx="13" cy="27" r="1.8" fill={color} opacity="0.7" />
      <circle cx="27" cy="27" r="1.8" fill={color} opacity="0.7" />
      <circle cx="20" cy="20" r="1.8" fill={color} opacity="0.5" />
    </svg>
  );
}

// ─── Radar Chart ──────────────────────────────────────────────────────────────
function RadarChart({ data, accent }: {
  data: { label: string; value: number }[]; // value in SDs (-3 to 3)
  accent: string;
}) {
  const size = 180;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = 58;
  const n = data.length;

  function polar(angle: number, r: number) {
    const a = (angle - 90) * (Math.PI / 180);
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  }

  function sdToR(sd: number) {
    return Math.max(4, Math.min(maxR, (sd + 3) / 6 * maxR));
  }

  const angleStep = 360 / n;
  const points = data.map((d, i) => polar(i * angleStep, sdToR(d.value)));
  const polygon = points.map(p => `${p.x},${p.y}`).join(" ");
  const rings = [-2, -1, 0, 1, 2, 3].map(sd => sdToR(sd));

  function splitLabel(label: string): [string, string | null] {
    const words = label.split(" ");
    if (words.length === 1) return [label, null];
    const mid = Math.ceil(words.length / 2);
    return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
  }

  return (
    <svg width={150} height={150} viewBox={`0 0 ${size} ${size}`} overflow="visible" style={{ overflow: "visible" }}>
      {/* Grid rings */}
      {rings.map((r, i) => (
        <circle key={i} cx={cx} cy={cy} r={r}
          fill="none" stroke={i === 2 ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.08)"}
          strokeWidth={i === 2 ? 1 : 0.5} strokeDasharray={i === 2 ? "none" : "2,2"} />
      ))}
      {/* Spokes */}
      {data.map((_, i) => {
        const p = polar(i * angleStep, maxR);
        return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="rgba(255,255,255,0.1)" strokeWidth={0.5} />;
      })}
      {/* Player polygon */}
      <polygon points={polygon}
        fill={accent} fillOpacity={0.25}
        stroke={accent} strokeWidth={1.5} strokeLinejoin="round" />
      {/* Dots */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill={accent} />
      ))}
      {/* Labels — two lines, pushed further out */}
      {data.map((d, i) => {
        const lp = polar(i * angleStep, maxR + 24);
        const isLeft = lp.x < cx - 8;
        const isRight = lp.x > cx + 8;
        const anchor = isLeft ? "end" : isRight ? "start" : "middle";
        const [line1, line2] = splitLabel(d.label);
        return (
          <text key={i} x={lp.x} y={lp.y} textAnchor={anchor}
            fontSize={9} fill="rgba(255,255,255,0.9)" fontFamily="EB Garamond, serif">
            <tspan x={lp.x} dy="0">{line1}</tspan>
            {line2 && <tspan x={lp.x} dy="11">{line2}</tspan>}
          </text>
        );
      })}
      {/* Center AVG label */}
      <text x={cx} y={cy + 3} textAnchor="middle" fontSize={7} fill="rgba(255,255,255,0.3)">AVG</text>
    </svg>
  );
}

// ─── Player Stats Tooltip ─────────────────────────────────────────────────────
function StatsTooltip({ espnId, playerName, visible }: { espnId: string; playerName: string; visible: boolean }) {
  const [stats, setStats] = useState<Record<string, string> | null>(null);
  const [failed, setFailed] = useState(false);
  const fetched = useRef(false);

  useEffect(() => {
    if (!visible || fetched.current || !playerName) return;
    fetched.current = true;
    const params = new URLSearchParams({ name: playerName });
    if (espnId) params.set("espnId", espnId);
    fetch(`/api/stats?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => { setStats(d.stats ?? {}); })
      .catch(() => { setFailed(true); setStats({}); });
  }, [visible, espnId, playerName]);

  if (!visible) return null;

  // Build radar data from stats if available
  const radarData = stats && stats["__radar__"] ? JSON.parse(stats["__radar__"]) : null;

  return (
    <div style={{
      position: "absolute", bottom: "110%", left: "50%", transform: "translateX(-50%)",
      background: "var(--bg-dark)", border: "1px solid var(--card-border)",
      borderRadius: 10, padding: "12px 14px", zIndex: 1000,
      minWidth: radarData ? 340 : 200, maxWidth: "min(420px, 90vw)",
      boxShadow: "0 8px 32px rgba(0,0,0,0.7)", pointerEvents: "none",
    }}>
      {!stats ? (
        <div style={{ fontSize: 13, color: "var(--cream-dim)", fontStyle: "italic", padding: "4px 0" }}>Loading stats…</div>
      ) : failed || Object.keys(stats).filter(k => !k.startsWith("__")).length === 0 ? (
        <div style={{ fontSize: 13, color: "var(--cream-dim)", fontStyle: "italic" }}>Stats unavailable</div>
      ) : (
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          {/* Radar chart */}
          {radarData && (
            <div style={{ flexShrink: 0 }}>
              <div style={{ fontSize: 9, color: "var(--accent)", letterSpacing: "0.1em", textAlign: "center", marginBottom: 4, textTransform: "uppercase" }}>
                Skill Profile
              </div>
              <RadarChart data={radarData} accent="var(--accent)" />
              <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", textAlign: "center", marginTop: 2 }}>
                SDs from PGA avg · 2024-25
              </div>
            </div>
          )}
          {/* Stats list */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {Object.entries(stats).filter(([k]) => !k.startsWith("__")).map(([k, v]) => {
              if (k.startsWith("──")) return (
                <div key={k} style={{ fontSize: 10, color: "var(--accent)", letterSpacing: "0.08em", marginTop: 8, marginBottom: 3, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 5 }}>
                  {k.replace(/──/g, "").trim()}
                </div>
              );
              if (v === "") return null;

              // Last 5 results — render as colored mini-badges
              if (k === "Last 5") {
                const results = v.split(/\s+/);
                return (
                  <div key={k} style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: "var(--cream-dim)", minWidth: 38 }}>Last 5</span>
                    <div style={{ display: "flex", gap: 3 }}>
                      {results.map((r, i) => {
                        const isWin = r === "W";
                        const isMC = r === "MC" || r === "WD";
                        const num = parseInt(r.replace("T",""));
                        const isTop5 = !isNaN(num) && num <= 5;
                        const isTop10 = !isNaN(num) && num <= 10;
                        const bg = isWin ? "var(--accent)" : isMC ? "rgba(192,57,43,0.4)" : isTop5 ? "rgba(93,186,126,0.35)" : isTop10 ? "rgba(93,186,126,0.18)" : "rgba(255,255,255,0.08)";
                        const col = isWin ? "var(--bg)" : isMC ? "#e07b6f" : isTop5 ? "var(--score-low)" : "var(--cream-dim)";
                        return (
                          <span key={i} style={{ fontSize: 10, padding: "2px 5px", borderRadius: 4, background: bg, color: col, fontWeight: isWin ? 700 : 400 }}>
                            {r}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              // Events row — render smaller below Last 5
              if (k === "Events") {
                return (
                  <div key={k} style={{ display: "flex", gap: 4, marginBottom: 4, marginTop: -2 }}>
                    <span style={{ fontSize: 11, color: "var(--cream-dim)", minWidth: 38 }}></span>
                    <div style={{ display: "flex", gap: 3 }}>
                      {v.split(/\s+/).map((e, i) => (
                        <span key={i} style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", width: 28, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e}</span>
                      ))}
                    </div>
                  </div>
                );
              }

              return (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 3, fontSize: 12 }}>
                  <span style={{ color: "var(--cream-dim)", whiteSpace: "nowrap" }}>{k}</span>
                  <span style={{ color: "var(--cream)", fontWeight: 500, whiteSpace: "nowrap" }}>{v}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div style={{ position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)", width: 0, height: 0, borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderTop: "6px solid var(--card-border)" }} />
    </div>
  );
}

// ─── Golfer Card ──────────────────────────────────────────────────────────────
function GolferCard({
  name, score, selected, burned, cut, disabled, odds, espnId, headshot, usagePct, onClick,
}: {
  name: string; score: GolferScore | undefined; selected: boolean; burned: boolean;
  cut: boolean; disabled: boolean; odds: string; espnId: string; headshot: string | null;
  usagePct: number | null;
  onClick: () => void;
}) {
  const [statsOpen, setStatsOpen] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const totalScore = score?.totalScore ?? null;

  // Desktop: hover to show stats
  function handleMouseEnter() { setStatsOpen(true); }
  function handleMouseLeave() { setStatsOpen(false); }

  // Mobile: long press to toggle stats
  function handleTouchStart() {
    longPressTimer.current = setTimeout(() => setStatsOpen(prev => !prev), 500);
  }
  function handleTouchEnd() {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }

  // Close stats when tapping elsewhere
  useEffect(() => {
    if (!statsOpen) return;
    const close = () => setStatsOpen(false);
    document.addEventListener("touchstart", close, { once: true, capture: true });
    return () => document.removeEventListener("touchstart", close, { capture: true });
  }, [statsOpen]);

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{ position: "relative" }}
    >
      <button
        onClick={onClick}
        disabled={disabled || burned || cut}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
          background: selected ? "rgba(var(--accent-rgb, 201,168,76), 0.15)" : burned || cut ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.04)",
          border: `1px solid ${selected ? "var(--accent)" : burned || cut ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.08)"}`,
          borderRadius: 8, cursor: burned || cut || disabled ? "not-allowed" : "pointer",
          opacity: burned || cut ? 0.45 : 1, transition: "all 0.15s", textAlign: "left",
        }}
      >
        {/* Headshot */}
        <div style={{ width: 36, height: 36, borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: "rgba(255,255,255,0.08)" }}>
          {headshot ? (
            
            <img src={headshot} alt={name} width={36} height={36} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 20%" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "var(--cream-dim)" }}>
              {name[0]}
            </div>
          )}
        </div>

        {/* Name & badges */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ fontSize: 14, color: selected ? "var(--accent)" : burned || cut ? "var(--cream-dim)" : "var(--cream)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {name}
            </div>
            {/* Stats hint on mobile */}
            {espnId && !burned && !cut && (
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", flexShrink: 0 }}>hold</span>
            )}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 2, alignItems: "center" }}>
            {burned && <span style={{ fontSize: 10, background: "rgba(255,255,255,0.08)", color: "var(--cream-dim)", padding: "1px 6px", borderRadius: 10, letterSpacing: "0.06em" }}>USED</span>}
            {cut && <span style={{ fontSize: 10, background: "rgba(192,57,43,0.15)", color: "#e07b6f", padding: "1px 6px", borderRadius: 10, letterSpacing: "0.06em" }}>CUT</span>}
            {odds && !burned && !cut && <span style={{ fontSize: 11, color: "var(--accent-light, var(--accent))", opacity: 0.8 }}>{odds}</span>}
            {score?.position && !burned && !cut && <span style={{ fontSize: 11, color: "var(--cream-dim)" }}>{score.position}</span>}
            {usagePct !== null && !burned && !cut && (
              <span style={{
                fontSize: 10, padding: "1px 5px", borderRadius: 4,
                background: usagePct >= 75 ? "rgba(201,168,76,0.15)" : "rgba(255,255,255,0.06)",
                color: usagePct >= 75 ? "#c9a84c" : usagePct >= 50 ? "var(--cream-dim)" : "rgba(255,255,255,0.3)",
                fontFamily: "monospace", letterSpacing: "0.02em",
              }}>{usagePct}%</span>
            )}
            {score?.teeTime && !burned && !cut && score.r1 === null && (
              <span style={{ fontSize: 10, color: "rgba(201,168,76,0.7)", letterSpacing: "0.04em" }}>⏱ {score.teeTime}</span>
            )}
          </div>
        </div>

        {/* Score */}
        <div style={{ fontSize: 15, fontFamily: "monospace", color: scoreColor(totalScore), flexShrink: 0 }}>
          {fmtScore(totalScore)}
        </div>
      </button>

      {/* Stats tooltip — hover on desktop, long press on mobile */}
      {statsOpen && espnId && !burned && !cut && (
        <StatsTooltip espnId={espnId} playerName={name} visible={statsOpen} />
      )}
    </div>
  );
}

// ─── Login / Register / Reset Screen ─────────────────────────────────────────
function AuthScreen({ tournament, onLogin }: { tournament: Tournament; onLogin: (token: string, username: string) => void }) {
  const [mode, setMode] = useState<"login" | "register" | "reset">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const th = tournament.theme;

  function switchMode(m: typeof mode) {
    setMode(m); setError("");
    setUsername(""); setPassword(""); setConfirm(""); setCode("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError("");
    if ((mode === "register" || mode === "reset") && password !== confirm) { setError("Passwords don't match"); return; }
    if ((mode === "register" || mode === "reset") && password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setLoading(true);
    try {
      const endpoints = { login: "/api/auth", register: "/api/register", reset: "/api/reset-password" };
      const bodies = {
        login: { username: username.trim(), password },
        register: { username: username.trim(), password, inviteCode: code.trim() },
        reset: { username: username.trim(), newPassword: password, resetCode: code.trim() },
      };
      const res = await fetch(endpoints[mode], { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bodies[mode]) });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Something went wrong"); return; }
      onLogin(data.token, data.username);
    } catch { setError("Network error — please try again"); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ minHeight: "100vh", background: th.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, ...themeVars(tournament) }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ marginBottom: 10, display: "flex", justifyContent: "center" }}>{tournament.id === "masters" ? <TexasIcon size={52} color={th.accent} /> : <span style={{ fontSize: 52 }}>{th.emoji}</span>}</div>
          <h1 style={{ fontSize: 26, color: th.accent, fontFamily: "Playfair Display, serif", marginBottom: 4 }}>Major Pick&apos;em</h1>
          <p style={{ color: th.creamDim, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase" }}>{tournament.shortName} {tournament.year}</p>
        </div>

        {mode !== "reset" && (
          <div style={{ display: "flex", background: "rgba(255,255,255,0.04)", border: "1px solid var(--card-border)", borderRadius: 8, padding: 4, marginBottom: 18 }}>
            {(["login", "register"] as const).map((m) => (
              <button key={m} onClick={() => switchMode(m)} style={{
                flex: 1, padding: "9px 0", border: "none", borderRadius: 6,
                background: mode === m ? th.accent : "transparent",
                color: mode === m ? th.bg : th.creamDim,
                fontSize: 14, fontFamily: "Playfair Display, serif",
                fontWeight: mode === m ? 600 : 400, cursor: "pointer",
              }}>
                {m === "login" ? "Sign In" : "Create Account"}
              </button>
            ))}
          </div>
        )}

        {mode === "reset" && (
          <button onClick={() => switchMode("login")} style={{ background: "none", border: "none", color: th.creamDim, cursor: "pointer", fontSize: 13, marginBottom: 14, padding: 0 }}>
            ← Back to sign in
          </button>
        )}

        <div style={{ ...card }}>
          <p style={{ fontSize: 14, color: th.creamDim, marginBottom: 20, fontStyle: "italic" }}>
            {mode === "login" ? "Sign in to submit your picks" : mode === "register" ? "Create your account below" : "Reset your password with the commissioner code"}
          </p>

          {error && <div style={{ background: "rgba(192,57,43,0.12)", border: "1px solid rgba(192,57,43,0.3)", borderRadius: 8, padding: "10px 14px", color: "#e07b6f", marginBottom: 14, fontSize: 14 }}>{error}</div>}

          <form onSubmit={submit}>
            {["Name", mode === "reset" ? "New Password" : "Password"].map((label, i) => (
              <div key={label} style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 11, color: th.creamDim, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 5 }}>{label}</label>
                <input
                  type={i === 1 ? "password" : "text"}
                  value={i === 0 ? username : password}
                  onChange={(e) => i === 0 ? setUsername(e.target.value) : setPassword(e.target.value)}
                  style={inp} placeholder={i === 0 ? "Your first name" : "••••••••"}
                  autoComplete={i === 0 ? "username" : mode === "login" ? "current-password" : "new-password"}
                />
              </div>
            ))}

            {(mode === "register" || mode === "reset") && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 11, color: th.creamDim, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 5 }}>Confirm Password</label>
                <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} style={inp} placeholder="••••••••" autoComplete="new-password" />
              </div>
            )}

            {(mode === "register" || mode === "reset") && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 11, color: th.creamDim, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 5 }}>
                  {mode === "register" ? "Invite Code" : "Reset Code (from Trenton)"}
                </label>
                <input value={code} onChange={(e) => setCode(e.target.value)} style={inp} placeholder={mode === "register" ? "From the group chat" : "trentonisthebest"} />
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              width: "100%", padding: "13px", marginTop: 6,
              background: th.accent, color: th.bg,
              border: "none", borderRadius: 8, fontSize: 16,
              fontFamily: "Playfair Display, serif", fontWeight: 600,
              cursor: "pointer", opacity: loading ? 0.7 : 1,
            }}>
              {loading ? "Please wait…" : mode === "login" ? "Sign In" : mode === "register" ? "Create Account" : "Reset Password"}
            </button>
          </form>
        </div>

        {mode === "login" && (
          <p style={{ textAlign: "center", marginTop: 14 }}>
            <button onClick={() => switchMode("reset")} style={{ background: "none", border: "none", color: th.creamDim, cursor: "pointer", fontSize: 13, fontStyle: "italic", textDecoration: "underline" }}>
              Forgot your password?
            </button>
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Course Hero ──────────────────────────────────────────────────────────────
const DISPLAY_MS = 6000;  // how long each photo shows
const FADE_MS    = 800;   // fade duration — consistent for all photos

function CourseHero({ tournament, splashDone }: { tournament: Tournament; splashDone: boolean }) {
  const [photos, setPhotos] = useState<{ url: string; fallbackUrl?: string; caption: string }[]>([]);
  const [idx, setIdx] = useState(0);
  const [opacity, setOpacity] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rotationStarted = useRef(false);

  // Fetch photos on mount
  useEffect(() => {
    setPhotos([]);
    setIdx(0);
    setOpacity(0);
    rotationStarted.current = false;
    fetch(`/api/course-photos?tournament=${tournament.id}`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.photos) && d.photos.length > 0) setPhotos(d.photos); })
      .catch(() => null);
  }, [tournament.id]);

  // Start rotation timer once photos are loaded and visible
  const startTimer = useCallback((delay = DISPLAY_MS) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      // Fade out
      setOpacity(0);
      // After fade, advance index, then fade back in
      setTimeout(() => {
        setIdx(prev => (prev + 1) % photos.length);
        setTimeout(() => setOpacity(1), 50);
      }, FADE_MS);
    }, delay);
  }, [photos.length]);

  // Only start rotating after splash is done
  useEffect(() => {
    if (photos.length > 1 && splashDone && !rotationStarted.current) {
      rotationStarted.current = true;
      // First photo gets 5 extra seconds so it's still showing when splash fades
      startTimer(DISPLAY_MS + 5000);
    } else if (photos.length > 1 && splashDone && rotationStarted.current && idx > 0) {
      startTimer();
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [idx, photos.length, startTimer, splashDone]);

  function goTo(i: number) {
    if (timerRef.current) clearTimeout(timerRef.current);
    setOpacity(0);
    setTimeout(() => { setIdx(i); setTimeout(() => setOpacity(1), 50); }, FADE_MS);
  }

  const photo = photos[idx] ?? null;

  return (
    <div style={{
      position: "relative", width: "100%", height: 260,
      overflow: "hidden",
      background: "linear-gradient(160deg, var(--bg-mid) 0%, var(--bg-dark) 40%, var(--bg-mid) 100%)",
    }}>
      {/* Photo */}
      {photo && (
        
        <img
          key={`${tournament.id}-${idx}`}
          src={photo.url}
          alt={photo.caption}
          onLoad={() => { setOpacity(1); }}
          onError={(e) => {
            const fb = photos[idx]?.fallbackUrl;
            if (fb && (e.target as HTMLImageElement).src !== fb) {
              (e.target as HTMLImageElement).src = fb;
            } else {
              setPhotos(prev => prev.filter((_, i) => i !== idx));
              setIdx(0);
            }
          }}
          style={{
            position: "absolute", inset: 0,
            width: "100%", height: "100%",
            objectFit: "contain", objectPosition: "center center", background: "#0a2a1a",
            transition: `opacity ${FADE_MS}ms ease`,
            opacity,
          }}
        />
      )}

      {/* Gradient overlay */}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.3) 45%, rgba(0,0,0,0.08) 100%)",
        pointerEvents: "none",
      }} />

      {/* Tournament title */}
      <div style={{ position: "absolute", top: 20, left: 20, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ display: "inline-flex", alignItems: "center" }}>{tournament.id === "masters" ? <TexasIcon size={28} color={tournament.theme.accent} /> : <span style={{ fontSize: 28 }}>{tournament.theme.emoji}</span>}</span>
        <div>
          <div style={{ fontSize: 15, color: "var(--accent)", fontFamily: "Playfair Display, serif", fontWeight: 600, lineHeight: 1.2 }}>
            {tournament.shortName} {tournament.year}
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", letterSpacing: "0.08em" }}>
            {tournament.location.split("·")[0].trim()}
          </div>
        </div>
      </div>

      {/* Caption + dots */}
      <div style={{ position: "absolute", bottom: 12, left: 16, right: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", letterSpacing: "0.06em", fontStyle: "italic" }}>
          {photo?.caption ?? ""}
        </span>
        {photos.length > 1 && (
          <div style={{ display: "flex", gap: 5 }}>
            {photos.map((_, i) => (
              <button key={i} onClick={() => goTo(i)} style={{
                width: 6, height: 6, borderRadius: "50%", border: "none", padding: 0, cursor: "pointer",
                background: i === idx ? "var(--accent)" : "rgba(255,255,255,0.35)",
                transition: "background 0.3s",
              }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Champion Banner ──────────────────────────────────────────────────────────
function ChampionBanner({ tournament }: { tournament: Tournament }) {
  const [champion, setChampion] = useState<{ name: string; year: number } | null>(null);

  useEffect(() => {
    // First try 2026 champion (current year)
    fetch(`/api/champion?tournament=${tournament.id}&year=2026`)
      .then((r) => r.json())
      .then((d) => {
        if (d.champion) setChampion({ name: d.champion, year: d.year });
        else setChampion(tournament.priorChampion);
      })
      .catch(() => setChampion(tournament.priorChampion));
  }, [tournament]);

  if (!champion) return null;

  return (
    <div style={{
      background: "rgba(255,255,255,0.03)", borderBottom: "1px solid var(--card-border)",
      padding: "8px 24px", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
    }}>
      <span style={{ fontSize: 16 }}>🏆</span>
      <span style={{ fontSize: 13, color: "var(--cream-dim)", letterSpacing: "0.04em" }}>
        <span style={{ color: "var(--accent)", fontWeight: 600 }}>{champion.year} Champion </span>
        <span style={{ color: "var(--cream)" }}>{champion.name}</span>
      </span>
    </div>
  );
}

// ─── My Picks Tab ─────────────────────────────────────────────────────────────
function MyPicksTab({
  token, userId, tournament, allPicks, scores, odds, currentRound, revealAll, skipDeadline, onPicksChanged,
}: {
  token: string; userId: string; tournament: Tournament;
  allPicks: Pick[]; scores: GolferScore[]; odds: Record<string, string>;
  currentRound: number; revealAll: boolean; skipDeadline: boolean;
  onPicksChanged: () => void;
}) {
  const round = currentRound;
  // Always auto-advance to next round when current round is locked (tee times started)
  // and admin hasn't explicitly unlocked it via skipDeadline.
  // e.g. during R2 (locked) → show R3 picks form automatically.
  // When admin sets roundOverride + skipDeadline, that combo keeps the current round open.
  const currentRevealed = isRoundRevealed(tournament, round);
  const displayRound = (currentRevealed && !skipDeadline && round < 4) ? round + 1 : round;
  const roundDeadlinePassed = isRoundRevealed(tournament, displayRound);
  // skipDeadline (from admin) forces the form open regardless of clock time
  const revealed = roundDeadlinePassed && !revealAll && !skipDeadline;
  const revealDate = new Date(tournament.rounds[displayRound as 1|2|3|4].revealTimeUTC);
  const [countdown, setCountdown] = useState(fmtCountdown(revealDate));
  const [selected, setSelected] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saved, setSaved] = useState(false);
  const [sortMode, setSortMode] = useState<"leaderboard" | "alpha">("alpha");
  const [searchQuery, setSearchQuery] = useState("");

  const scoreMap = Object.fromEntries(scores.map((s) => [s.name, s]));

  // Pool usage % per golfer — only count revealed rounds so future picks stay hidden
  const revealedRoundsForUsage = [1, 2, 3, 4].filter(r => isRoundRevealed(tournament, r));
  const totalPoolUsers = new Set(allPicks.map(p => p.user_id)).size;
  const golferPoolCount: Record<string, Set<string>> = {};
  allPicks
    .filter(p => revealedRoundsForUsage.includes(p.round_number))
    .forEach(p => {
      if (!golferPoolCount[p.golfer]) golferPoolCount[p.golfer] = new Set();
      golferPoolCount[p.golfer].add(p.user_id);
    });
  const poolUsagePct = (n: string): number | null => {
    if (!totalPoolUsers || !golferPoolCount[n]) return null;
    return Math.round((golferPoolCount[n].size / totalPoolUsers) * 100);
  };

  // My picks for the round being displayed
  const myCurrentPicks = allPicks.filter((p) => p.user_id === userId && p.round_number === displayRound).map((p) => p.golfer);

  // All golfers I've used in previous rounds (burned)
  const burnedSet = new Set(
    allPicks.filter((p) => p.user_id === userId && p.round_number < displayRound).map((p) => p.golfer)
  );

  // Cut players (status !== 'active')
  const cutSet = new Set(scores.filter((s) => s.status !== "active").map((s) => s.name));

  useEffect(() => {
    setSelected(myCurrentPicks);
    setSaved(myCurrentPicks.length === 3);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allPicks, userId, displayRound]);

  useEffect(() => {
    const t = setInterval(() => setCountdown(fmtCountdown(revealDate)), 1000);
    return () => clearInterval(t);
  }, [revealDate]);

  function toggle(g: string) {
    if (revealed || burnedSet.has(g) || (displayRound >= 3 && cutSet.has(g))) return;
    if (selected.includes(g)) { setSelected(selected.filter((x) => x !== g)); setSaved(false); return; }
    if (selected.length >= 3) return;
    setSelected([...selected, g]); setSaved(false);
  }

  async function submit() {
    if (selected.length !== 3) return;
    setSubmitting(true); setError(""); setSuccess("");
    try {
      const res = await fetch("/api/picks", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tournament: tournament.id, round: displayRound, golfers: selected }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setSaved(true); setSuccess("Picks saved!"); onPicksChanged();
    } catch { setError("Network error"); }
    finally { setSubmitting(false); }
  }

  // Build sorted golfer list based on sortMode, filtered by search
  const sortedGolfers = [...scores]
    .filter(s => {
      if (!searchQuery.trim()) return true;
      return s.name.toLowerCase().includes(searchQuery.toLowerCase());
    })
    .sort((a, b) => {
      const aAvail = !burnedSet.has(a.name) && a.status === "active";
      const bAvail = !burnedSet.has(b.name) && b.status === "active";
      if (aAvail && !bAvail) return -1;
      if (!aAvail && bAvail) return 1;
      if (sortMode === "alpha") {
        // Sort by first name
        const aFirst = a.name.split(" ")[0] ?? a.name;
        const bFirst = b.name.split(" ")[0] ?? b.name;
        return aFirst.localeCompare(bFirst);
      }
      return a.totalScore - b.totalScore;
    });

  const scoringNote = displayRound <= 2
    ? "Lowest 2 of your 3 golfer scores count this round"
    : "All 3 of your golfer scores count this round";

  return (
    <div>
      {/* Round header */}
      <div style={{ ...card }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
          <div>
            <h2 style={{ fontSize: 18, color: "var(--accent)", fontFamily: "Playfair Display, serif" }}>
              {ROUND_LABELS[displayRound]} {revealed ? "— Locked" : "— Open"}
            </h2>
            <p style={{ fontSize: 13, color: "var(--cream-dim)", marginTop: 4, fontStyle: "italic" }}>{scoringNote}</p>
          </div>
          {!revealed && (
            <div style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--card-border)", borderRadius: 6, padding: "6px 12px", fontSize: 13, color: "var(--accent)", textAlign: "right", flexShrink: 0 }}>
              🔒 {countdown}
            </div>
          )}
        </div>

        {/* Selected picks summary */}
        {selected.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 11, color: "var(--cream-dim)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
              {revealed ? "Your picks" : `Selected (${selected.length}/3)`}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {selected.map((g) => {
                const sc = scoreMap[g];
                return (
                  <div key={g} style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.06)", border: "1px solid var(--accent)", borderRadius: 20, padding: "5px 12px" }}>
                    <span style={{ fontSize: 14, color: "var(--accent)" }}>{g}</span>
                    {sc && <span style={{ fontSize: 13, fontFamily: "monospace", color: scoreColor(sc.totalScore) }}>{fmtScore(sc.totalScore)}</span>}
                    {!revealed && (
                      <button onClick={() => toggle(g)} style={{ background: "none", border: "none", color: "var(--cream-dim)", cursor: "pointer", padding: 0, fontSize: 14, lineHeight: 1 }}>✕</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {error && <div style={{ background: "rgba(192,57,43,0.12)", border: "1px solid rgba(192,57,43,0.3)", borderRadius: 8, padding: "10px 14px", color: "#e07b6f", marginBottom: 12, fontSize: 14 }}>{error}</div>}
        {success && <div style={{ background: "rgba(93,186,126,0.12)", border: "1px solid rgba(93,186,126,0.3)", borderRadius: 8, padding: "10px 14px", color: "var(--score-low)", marginBottom: 12, fontSize: 14 }}>✓ {success}</div>}

        {/* Golfer list — always visible; disabled when picks are locked */}
        {(
          <>
            <div style={{ height: 1, background: "var(--card-border)", margin: "12px 0" }} />

            {/* Search + sort controls */}
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" as const }}>
              {/* Search bar */}
              <div style={{ flex: 1, minWidth: 160, position: "relative" as const }}>
                <span style={{ position: "absolute" as const, left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "var(--cream-dim)", pointerEvents: "none" as const }}>🔍</span>
                <input
                  type="text"
                  placeholder="Search players…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    width: "100%", paddingLeft: 32, paddingRight: 10, paddingTop: 8, paddingBottom: 8,
                    background: "rgba(255,255,255,0.06)", border: "1px solid var(--card-border)",
                    borderRadius: 8, color: "var(--cream)", fontSize: 14, outline: "none",
                  }}
                />
              </div>
              {/* Sort toggle */}
              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                {(["alpha", "leaderboard"] as const).map(mode => (
                  <button key={mode} onClick={() => setSortMode(mode)} style={{
                    padding: "6px 10px", borderRadius: 6, fontSize: 12,
                    background: sortMode === mode ? "var(--accent)" : "rgba(255,255,255,0.06)",
                    color: sortMode === mode ? "var(--bg)" : "var(--cream-dim)",
                    border: `1px solid ${sortMode === mode ? "var(--accent)" : "var(--card-border)"}`,
                    cursor: "pointer", fontWeight: sortMode === mode ? 600 : 400,
                  }}>
                    {mode === "alpha" ? "A–Z" : "Rank"}
                  </button>
                ))}
              </div>
            </div>

            <p style={{ fontSize: 12, color: "var(--cream-dim)", marginBottom: 10, fontStyle: "italic" }}>
              Pick 3 golfers. Hover/hold for season stats. Grayed = already used or cut.
            </p>

            {sortedGolfers.length === 0 && scores.length === 0 && (
              <div style={{ textAlign: "center", padding: "24px 16px", color: "var(--cream-dim)" }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>⛳</div>
                <div style={{ fontSize: 15, marginBottom: 6 }}>Loading player data…</div>
                <div style={{ fontSize: 12, fontStyle: "italic" }}>
                  If this persists, go to Admin → ⚡ Fix Scores to clear the cache and reload from ESPN.
                </div>
              </div>
            )}

            {sortedGolfers.length === 0 && scores.length > 0 && searchQuery && (
              <p style={{ color: "var(--cream-dim)", fontSize: 14, textAlign: "center", padding: "16px 0" }}>
                No players match &ldquo;{searchQuery}&rdquo;
              </p>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 }}>
              {sortedGolfers.map((gs) => (
                <GolferCard
                  key={gs.name}
                  name={gs.name}
                  score={gs}
                  selected={selected.includes(gs.name)}
                  burned={burnedSet.has(gs.name)}
                  cut={displayRound >= 3 && gs.status !== "active"}
                  disabled={!selected.includes(gs.name) && selected.length >= 3}
                  odds={odds[gs.name] ?? odds[normalizeName(gs.name)] ?? ""}
                  espnId={gs.espnId}
                  headshot={gs.headshot}
                  usagePct={poolUsagePct(gs.name)}
                  onClick={() => toggle(gs.name)}
                />
              ))}
            </div>

            {!revealed && (
              <button
                onClick={submit}
                disabled={selected.length !== 3 || submitting}
                style={{
                  width: "100%", padding: "13px", marginTop: 16,
                  background: "var(--accent)", color: "var(--bg)",
                  border: "none", borderRadius: 8, fontSize: 16,
                  fontFamily: "Playfair Display, serif", fontWeight: 600,
                  cursor: selected.length !== 3 ? "not-allowed" : "pointer",
                  opacity: selected.length !== 3 || submitting ? 0.5 : 1,
                }}
              >
                {submitting ? "Saving…" : saved ? "Update Picks" : "Lock In Picks"}
              </button>
            )}
          </>
        )}
      </div>

      {/* Prior rounds summary */}
      {[1, 2, 3, 4].filter((r) => r < displayRound && allPicks.some(p => p.round_number === r)).map((r) => {
        const myPicks = allPicks.filter((p) => p.user_id === userId && p.round_number === r).map((p) => p.golfer);
        if (!myPicks.length) return null;
        const roundScores = myPicks.map((g) => getRoundScore(scoreMap[g], r));
        const roundTotal = calcRoundScore(roundScores, r);
        const usedCount = r <= 2 ? 2 : 3;

        return (
          <div key={r} style={{ ...card, opacity: 0.85 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <h3 style={{ fontSize: 15, color: "var(--accent)", fontFamily: "Playfair Display, serif" }}>
                {ROUND_LABELS[r]} <span style={{ fontSize: 12, color: "var(--cream-dim)", fontWeight: 400 }}>({r <= 2 ? "best 2 of 3" : "all 3"})</span>
              </h3>
              <span style={{ fontFamily: "monospace", fontSize: 16, color: scoreColor(roundTotal) }}>{fmtScore(roundTotal)}</span>
            </div>
            {myPicks.map((g, i) => {
              const sc = scoreMap[g];
              const rs = getRoundScore(sc, r);
              // Drop the worst (highest to-par) score only when all 3 picks have scores.
              // If any pick hasn't played yet (null), nothing is crossed out.
              const allScored = r <= 2 && roundScores.length === 3 && roundScores.every(s => s !== null);
              const droppedIndex = allScored
                ? roundScores
                    .map((s, idx) => ({ s: s as number, idx }))
                    .sort((a, b) => b.s - a.s || b.idx - a.idx)[0].idx
                : -1;
              const notCounted = droppedIndex === i;
              return (
                <div key={g} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: notCounted ? "var(--cream-dim)" : "var(--cream)", textDecoration: notCounted ? "line-through" : "none" }}>{g}</span>
                    {notCounted && <span style={{ fontSize: 11, color: "var(--cream-dim)" }}>not counted</span>}
                  </div>
                  <span style={{ fontFamily: "monospace", color: scoreColor(rs), opacity: notCounted ? 0.5 : 1 }}>{fmtScore(rs)}</span>
                </div>
              );
            })}
            {/* show unused picks count */}
            <p style={{ fontSize: 12, color: "var(--cream-dim)", marginTop: 8, fontStyle: "italic" }}>{usedCount} of {myPicks.length} scores counted</p>
          </div>
        );
      })}
    </div>
  );
}

// ─── Leaderboard Tab ──────────────────────────────────────────────────────────
function LeaderboardTab({
  tournament, allPicks, scores, playerCount, registeredUsers, currentRound, pickStatus,
}: {
  tournament: Tournament; allPicks: Pick[]; scores: GolferScore[];
  playerCount: number; registeredUsers: {id: string; username: string}[];
  currentRound: number; pickStatus: Record<string, number[]>;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const scoreMap = Object.fromEntries(scores.map((s) => [s.name, s]));
  const purse = playerCount * 50;

  // Build userMap from BOTH picks AND registered users
  const userMap: Record<string, string> = {};
  registeredUsers.forEach((u) => { userMap[u.id] = u.username; });
  allPicks.forEach((p) => { userMap[p.user_id] = p.username; });

  // Use pickStatus (from /api/pick-status) which shows all rounds regardless of reveal time
  // This ensures green checkmarks always reflect actual submission state
  const nextRound = currentRound + 1;
  const submittedCurrentRound = new Set(
    Object.entries(pickStatus)
      .filter(([, rounds]) => rounds.includes(currentRound))
      .map(([uid]) => uid)
  );
  const submittedNextRound = new Set(
    Object.entries(pickStatus)
      .filter(([, rounds]) => nextRound <= 4 && rounds.includes(nextRound))
      .map(([uid]) => uid)
  );

  const standings = Object.entries(userMap).map(([uid, uname]) => {
    let total = 0;
    const roundBreakdowns: Record<number, { picks: string[]; score: number }> = {};

    for (let r = 1; r <= 4; r++) {
      const rPicks = allPicks.filter((p) => p.user_id === uid && p.round_number === r).map((p) => p.golfer);
      if (rPicks.length === 0) continue;
      if (!rPicks.length) continue;
      const roundScores = rPicks.map((g) => getRoundScore(scoreMap[g], r));
      const roundScore = calcRoundScore(roundScores, r);
      total += roundScore;
      roundBreakdowns[r] = { picks: rPicks, score: roundScore };
    }

    return { uid, username: uname, total, rounds: roundBreakdowns };
  }).sort((a, b) => {
    if (a.total !== b.total) return a.total - b.total;
    if (a.username === "Trenton Patterson") return -1;
    if (b.username === "Trenton Patterson") return 1;
    return a.username.localeCompare(b.username);
  });

  // Golfer usage % across the pool — only count revealed rounds so future picks stay hidden
  const revealedRoundsForUsage = [1, 2, 3, 4].filter(r => isRoundRevealed(tournament, r));
  const totalUsersInPool = Object.keys(userMap).length;
  const golferPickCount: Record<string, Set<string>> = {};
  allPicks
    .filter(p => revealedRoundsForUsage.includes(p.round_number))
    .forEach(p => {
      if (!golferPickCount[p.golfer]) golferPickCount[p.golfer] = new Set();
      golferPickCount[p.golfer].add(p.user_id);
    });
  const golferUsagePct = (golfer: string): number | null => {
    if (!totalUsersInPool || !golferPickCount[golfer]) return null;
    return Math.round((golferPickCount[golfer].size / totalUsersInPool) * 100);
  };

  if (!standings.length) {
    return (
      <div style={card}>
        <p style={{ color: "var(--cream-dim)", fontStyle: "italic", textAlign: "center", padding: 16 }}>
          Standings will appear once picks are submitted and revealed.
        </p>
        <p style={{ color: "var(--cream-dim)", fontSize: 12, textAlign: "center", padding: "0 16px 16px" }}>
          If you&apos;re testing: go to Admin → 🧪 Enable Full Test Mode, have all users submit picks, then Fill &amp; Save manual scores.
        </p>
      </div>
    );
  }

  // Masters-style score color: red = under par, black/white = even, gray = over
  function mastersColor(score: number | null) {
    if (score === null) return "#999";
    if (score < 0) return "#c0392b";   // Masters red for under par
    if (score === 0) return "#e8dcc8"; // cream for even
    return "#888";                      // gray for over par
  }

  function mastersScore(score: number | null) {
    if (score === null) return "-";
    if (score === 0) return "E";
    return score > 0 ? `+${score}` : `${score}`;
  }

  const latestRound = standings.length > 0
    ? Math.max(...standings.flatMap(u => Object.keys(u.rounds).map(Number)), 0)
    : 0;

  return (
    <div style={{ fontFamily: "'EB Garamond', serif" }}>

      {/* Masters-style header bar */}
      <div style={{
        background: "linear-gradient(180deg, #1a4a2e 0%, #0f3320 100%)",
        border: "1px solid #2d6b40",
        borderRadius: "10px 10px 0 0",
        padding: "10px 0 0",
        marginBottom: 0,
      }}>
        {/* Purse row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 20px 10px" }}>
          <div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", letterSpacing: "0.12em", textTransform: "uppercase" as const }}>Pool Purse</div>
            <div style={{ fontSize: 22, color: "#c9a84c", fontFamily: "Playfair Display, serif", fontWeight: 600 }}>${purse.toLocaleString()}</div>
          </div>
          <div style={{ textAlign: "right" as const }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{playerCount} players · $50 buy-in</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2, fontStyle: "italic" }}>Lowest cumulative score wins</div>
          </div>
        </div>

        {/* Column headers — Masters scoreboard style */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "min(28px,7vw) min(28px,7vw) 1fr min(34px,9vw) min(34px,9vw) min(34px,9vw) min(34px,9vw) min(46px,12vw)",
          alignItems: "center",
          padding: "6px 8px",
          background: "rgba(0,0,0,0.25)",
          borderTop: "1px solid rgba(255,255,255,0.08)",
        }}>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", letterSpacing: "0.1em", textAlign: "center" as const }}>POS</div>
          <div />
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", letterSpacing: "0.1em" }}>PLAYER</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", letterSpacing: "0.06em", textAlign: "center" as const }}>R1</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", letterSpacing: "0.06em", textAlign: "center" as const }}>R2</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", letterSpacing: "0.06em", textAlign: "center" as const }}>R3</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", letterSpacing: "0.06em", textAlign: "center" as const }}>R4</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", letterSpacing: "0.06em", textAlign: "center" as const }}>TOTAL</div>
        </div>
      </div>

      {/* Standings rows */}
      <div style={{ border: "1px solid #2d6b40", borderTop: "none", borderRadius: "0 0 10px 10px", overflow: "hidden", marginBottom: 16 }}>
        {standings.map((u, i) => {
          const isOpen = expanded === u.uid;
          const isLeader = i === 0;
          // True rank = number of players with a strictly better score + 1
          const trueRank = standings.filter(s => s.total < u.total).length + 1;
          const isTied = standings.filter(s => s.total === u.total).length > 1;
          const posLabel = isTied ? `T${trueRank}` : `${trueRank}`;

          return (
            <div key={u.uid} style={{ borderBottom: i < standings.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
              {/* Main row */}
              <button
                onClick={() => setExpanded(isOpen ? null : u.uid)}
                style={{
                  width: "100%",
                  display: "grid",
                  gridTemplateColumns: "min(28px,7vw) min(28px,7vw) 1fr min(34px,9vw) min(34px,9vw) min(34px,9vw) min(34px,9vw) min(46px,12vw)",
                  alignItems: "center",
                  padding: "10px 8px",
                  background: isLeader
                    ? "linear-gradient(90deg, rgba(201,168,76,0.12) 0%, rgba(201,168,76,0.04) 100%)"
                    : i % 2 === 0 ? "rgba(255,255,255,0.015)" : "transparent",
                  border: "none", cursor: "pointer", textAlign: "left" as const,
                  transition: "background 0.15s",
                }}
              >
                {/* Position */}
                <div style={{
                  fontSize: 14, fontWeight: 700, textAlign: "center" as const,
                  color: isLeader ? "#c9a84c" : "rgba(255,255,255,0.5)",
                  fontFamily: "monospace",
                }}>{posLabel}</div>

                {/* Avatar */}
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <PlayerAvatar username={u.username} size={30} />
                </div>

                {/* Name */}
                <div style={{ paddingLeft: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{
                      fontSize: 14, fontWeight: isLeader ? 600 : 400,
                      color: isLeader ? "#c9a84c" : "#e8dcc8",
                      fontFamily: "Playfair Display, serif",
                      overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.2,
                    }}>{resolveUser(u.username).displayName}</div>
                    {/* Round pick status badges — show status for each active round */}
                    {currentRound <= 4 && (() => {
                      const hasCurrentPick = submittedCurrentRound.has(u.uid);
                      const hasNextPick = nextRound <= 4 && submittedNextRound.has(u.uid);
                      return (
                        <>
                          {/* Current round: green check or red NO PICK */}
                          {hasCurrentPick ? (
                            <span title={`R${currentRound} picks submitted`} style={{
                              fontSize: 9, padding: "1px 5px", borderRadius: 4,
                              background: "rgba(93,186,126,0.18)",
                              border: "1px solid rgba(93,186,126,0.35)",
                              color: "#5dba7e", letterSpacing: "0.06em", fontFamily: "monospace",
                              flexShrink: 0,
                            }}>R{currentRound} ✓</span>
                          ) : (
                            <span title={`R${currentRound} picks not submitted`} style={{
                              fontSize: 9, padding: "1px 5px", borderRadius: 4,
                              background: "rgba(192,57,43,0.15)",
                              border: "1px solid rgba(192,57,43,0.3)",
                              color: "#c0392b", letterSpacing: "0.06em", fontFamily: "monospace",
                              flexShrink: 0,
                            }}>R{currentRound} —</span>
                          )}
                          {/* Next round: green check if already submitted */}
                          {hasNextPick && (
                            <span title={`R${nextRound} picks already in`} style={{
                              fontSize: 9, padding: "1px 5px", borderRadius: 4,
                              background: "rgba(93,186,126,0.10)",
                              border: "1px solid rgba(93,186,126,0.25)",
                              color: "#5dba7e", letterSpacing: "0.06em", fontFamily: "monospace",
                              flexShrink: 0, opacity: 0.8,
                            }}>R{nextRound} ✓</span>
                          )}
                        </>
                      );
                    })()}
                  </div>
                  {isOpen && (
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>tap to collapse</div>
                  )}
                </div>

                {/* R1 */}
                <div style={{ textAlign: "center" as const, fontFamily: "monospace", fontSize: 14, fontWeight: 600, color: mastersColor(u.rounds[1]?.score ?? null) }}>
                  {u.rounds[1] ? mastersScore(u.rounds[1].score) : <span style={{ color: "rgba(255,255,255,0.15)" }}>—</span>}
                </div>
                {/* R2 */}
                <div style={{ textAlign: "center" as const, fontFamily: "monospace", fontSize: 14, fontWeight: 600, color: mastersColor(u.rounds[2]?.score ?? null) }}>
                  {u.rounds[2] ? mastersScore(u.rounds[2].score) : <span style={{ color: "rgba(255,255,255,0.15)" }}>—</span>}
                </div>
                {/* R3 */}
                <div style={{ textAlign: "center" as const, fontFamily: "monospace", fontSize: 14, fontWeight: 600, color: mastersColor(u.rounds[3]?.score ?? null) }}>
                  {u.rounds[3] ? mastersScore(u.rounds[3].score) : <span style={{ color: "rgba(255,255,255,0.15)" }}>—</span>}
                </div>
                {/* R4 */}
                <div style={{ textAlign: "center" as const, fontFamily: "monospace", fontSize: 14, fontWeight: 600, color: mastersColor(u.rounds[4]?.score ?? null) }}>
                  {u.rounds[4] ? mastersScore(u.rounds[4].score) : <span style={{ color: "rgba(255,255,255,0.15)" }}>—</span>}
                </div>
                {/* Total */}
                <div style={{
                  textAlign: "center" as const, fontFamily: "monospace", fontSize: 17, fontWeight: 700,
                  color: mastersColor(u.total),
                  background: isLeader ? "rgba(192,57,43,0.12)" : "transparent",
                  borderRadius: 4, padding: "2px 4px",
                }}>
                  {mastersScore(u.total)}
                </div>
              </button>

              {/* Expanded detail */}
              {isOpen && (
                <div style={{ background: "rgba(0,0,0,0.3)", borderTop: "1px solid rgba(255,255,255,0.06)", padding: "12px 16px 16px" }}>
                  {Object.entries(u.rounds).map(([r, rd]) => {
                    const rNum = parseInt(r);
                    const roundScores = rd.picks.map((g) => getRoundScore(scoreMap[g], rNum));
                    const allScoredLb = rNum <= 2 && roundScores.length === 3 && roundScores.every(s => s !== null);
                    const droppedIdxLb = allScoredLb
                      ? roundScores.map((s, idx) => ({ s: s as number, idx })).sort((a, b) => b.s - a.s || b.idx - a.idx)[0].idx
                      : -1;

                    return (
                      <div key={r} style={{ marginBottom: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: 4 }}>
                          <span style={{ fontSize: 11, color: "#c9a84c", letterSpacing: "0.1em", textTransform: "uppercase" as const }}>
                            {ROUND_LABELS[rNum]} · {rNum <= 2 ? "Best 2 of 3" : "All 3 count"}
                          </span>
                          <span style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 700, color: mastersColor(rd.score) }}>{mastersScore(rd.score)}</span>
                        </div>
                        {rd.picks.map((g, pi) => {
                          const rs = roundScores[pi];
                          const notCounted = droppedIdxLb === pi;
                          const gs = scoreMap[g];
                          const usagePct = golferUsagePct(g);

                          // Thru info: show hole # or "F" for finished, tee time for not started
                          let thruLabel: React.ReactNode = null;
                          if (gs) {
                            if (gs.thru && gs.thru !== "0") {
                              const thruText = gs.thru === "F" || gs.thru === "18" ? "F" : `Thru ${gs.thru}`;
                              thruLabel = (
                                <span style={{ fontSize: 10, color: gs.thru === "F" || gs.thru === "18" ? "rgba(255,255,255,0.3)" : "#c9a84c", fontFamily: "monospace" }}>
                                  {thruText}
                                </span>
                              );
                            } else if (gs.r1 === null && gs.teeTime) {
                              // Convert tee time (already ET) to CT by subtracting 1 hour
                              let ctTime = gs.teeTime;
                              try {
                                const [time, ampm] = gs.teeTime.replace(" ", "").split(/(AM|PM)/i);
                                const [h, m] = time.split(":").map(Number);
                                let hour = h - 1;
                                let period = ampm.toUpperCase();
                                if (hour <= 0) { hour = 12 + hour; period = period === "AM" ? "PM" : "AM"; }
                                ctTime = `${hour}:${String(m).padStart(2, "0")} ${period} CT`;
                              } catch { /* use as-is */ }
                              thruLabel = (
                                <span style={{ fontSize: 10, color: "rgba(201,168,76,0.6)", fontFamily: "monospace" }}>
                                  ⏱ {ctTime}
                                </span>
                              );
                            }
                          }

                          return (
                            <div key={g} style={{
                              display: "flex", justifyContent: "space-between", alignItems: "center",
                              fontSize: 13, padding: "5px 10px",
                              background: notCounted ? "transparent" : "rgba(255,255,255,0.03)",
                              borderRadius: 4, marginBottom: 3,
                              opacity: notCounted ? 0.45 : 1,
                            }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ color: "#e8dcc8", textDecoration: notCounted ? "line-through" : "none" }}>{g}</span>
                                {usagePct !== null && revealedRoundsForUsage.includes(rNum) && (
                                  <span style={{
                                    fontSize: 10, padding: "1px 5px", borderRadius: 4,
                                    background: usagePct >= 75 ? "rgba(201,168,76,0.15)" : "rgba(255,255,255,0.05)",
                                    color: usagePct >= 75 ? "#c9a84c" : usagePct >= 50 ? "#e8dcc8" : "rgba(255,255,255,0.35)",
                                    fontFamily: "monospace",
                                  }}>{usagePct}% pool</span>
                                )}
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                {thruLabel}
                                {notCounted && <span style={{ fontSize: 10, color: "#888", letterSpacing: "0.06em" }}>NOT COUNTED</span>}
                                <span style={{ fontFamily: "monospace", fontWeight: 600, color: mastersColor(rs) }}>{mastersScore(rs)}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {standings.length > 1 && standings[0].total === standings[1].total && (
        <p style={{ textAlign: "center", fontSize: 13, color: "var(--cream-dim)", fontStyle: "italic", marginTop: -8, marginBottom: 16 }}>
          ⚖️ Tied — purse splits equally
        </p>
      )}
    </div>
  );
}

// ─── History Tab ──────────────────────────────────────────────────────────────
function HistoryTab({ tournament, allPicks, scores }: { tournament: Tournament; allPicks: Pick[]; scores: GolferScore[] }) {
  const scoreMap = Object.fromEntries(scores.map((s) => [s.name, s]));
  // API already filters by revealAll override — show whatever came back
  const revealedRounds = [1, 2, 3, 4].filter((r) => allPicks.some((p) => p.round_number === r));

  if (!revealedRounds.length) {
    return (
      <div style={card}>
        <p style={{ color: "var(--cream-dim)", fontStyle: "italic", textAlign: "center", padding: 24 }}>
          History will appear here after the first tee time.
        </p>
      </div>
    );
  }

  return (
    <div>
      {revealedRounds.map((r) => {
        const byUser: Record<string, { username: string; picks: string[] }> = {};
        allPicks.filter((p) => p.round_number === r).forEach((p) => {
          if (!byUser[p.user_id]) byUser[p.user_id] = { username: p.username, picks: [] };
          byUser[p.user_id].picks.push(p.golfer);
        });

        const withScores = Object.values(byUser).map((u) => {
          const roundScores = u.picks.map((g) => getRoundScore(scoreMap[g], r));
          return { ...u, score: calcRoundScore(roundScores, r), roundScores };
        }).sort((a, b) => a.score - b.score);

        return (
          <div key={r} style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
              <h2 style={{ fontSize: 17, color: "var(--accent)", fontFamily: "Playfair Display, serif" }}>{ROUND_LABELS[r]}</h2>
              <span style={{ fontSize: 12, color: "var(--cream-dim)" }}>{r <= 2 ? "Best 2 of 3 count" : "All 3 count"}</span>
            </div>

            {withScores.map((u, i) => {
              const allScoredHist = r <= 2 && u.roundScores.length === 3 && u.roundScores.every(s => s !== null);
              const droppedIdxHist = allScoredHist
                ? u.roundScores.map((s, idx) => ({ s: s as number, idx })).sort((a, b) => b.s - a.s || b.idx - a.idx)[0].idx
                : -1;
              return (
                <div key={u.username} style={{ marginBottom: 18 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <PlayerAvatar username={u.username} size={28} />
                      <span style={{ fontSize: 15, color: i === 0 ? "var(--accent)" : "var(--cream)", fontFamily: "Playfair Display, serif" }}>
                        {i === 0 && "🏅 "}{resolveUser(u.username).displayName}
                      </span>
                    </div>
                    <span style={{ fontFamily: "monospace", fontSize: 16, color: scoreColor(u.score) }}>{fmtScore(u.score)}</span>
                  </div>
                  {u.picks.map((g, pi) => {
                    const rs = u.roundScores[pi];
                    const sc = scoreMap[g];
                    const notCounted = droppedIdxHist === pi;
                    return (
                      <div key={g} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 6, marginBottom: 4, fontSize: 14 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {sc?.headshot && (
                            
                            <img src={sc.headshot} alt={g} width={24} height={24} style={{ borderRadius: "50%", objectFit: "cover" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                          )}
                          <span style={{ color: notCounted ? "var(--cream-dim)" : "var(--cream)", textDecoration: notCounted ? "line-through" : "none" }}>{g}</span>
                          {notCounted && <span style={{ fontSize: 11, color: "var(--cream-dim)" }}>not counted</span>}
                          {sc?.status !== "active" && <span style={{ fontSize: 10, color: "#e07b6f", background: "rgba(192,57,43,0.15)", padding: "1px 6px", borderRadius: 10 }}>{sc?.status?.toUpperCase()}</span>}
                        </div>
                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                          {sc?.position && <span style={{ fontSize: 11, color: "var(--cream-dim)" }}>{sc.position}</span>}
                          <span style={{ fontFamily: "monospace", color: scoreColor(rs), opacity: notCounted ? 0.5 : 1 }}>{fmtScore(rs)}</span>
                        </div>
                      </div>
                    );
                  })}
                  {i < withScores.length - 1 && <div style={{ height: 1, background: "var(--card-border)", marginTop: 12 }} />}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}


// ─── Tournament Leaderboard Tab ───────────────────────────────────────────────
function TournamentLeaderboardTab({ scores }: { scores: GolferScore[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  function fmtScore(s: number | null) {
    if (s === null) return <span style={{ color: "rgba(255,255,255,0.2)" }}>—</span>;
    if (s === 0) return <span style={{ color: "rgba(255,255,255,0.7)" }}>E</span>;
    return <span style={{ color: s < 0 ? "#c0392b" : "#888" }}>{s > 0 ? `+${s}` : s}</span>;
  }

  function fmtTotal(s: number | null, status: string) {
    if (status === "cut") return <span style={{ color: "#666", fontSize: 12 }}>CUT</span>;
    if (status === "wd")  return <span style={{ color: "#666", fontSize: 12 }}>WD</span>;
    if (s === null) return <span style={{ color: "rgba(255,255,255,0.2)" }}>—</span>;
    if (s === 0) return <span style={{ color: "rgba(240,233,214,0.9)" }}>E</span>;
    return <span style={{ color: s < 0 ? "#c0392b" : "#888", fontWeight: 700 }}>{s > 0 ? `+${s}` : s}</span>;
  }

  // Parse ESPN position string to a sortable number: "1" → 1, "T3" → 3, "CUT" → 999
  function positionOrder(p: GolferScore): number {
    if (p.status !== "active") return 9999;
    if (p.r1 === null) return 998; // hasn't teed off
    const pos = p.position ?? "";
    const n = parseInt(pos.replace(/[^0-9]/g, ""), 10);
    if (!isNaN(n)) return n;
    // Fall back to totalScore (lower = better)
    return 500 + p.totalScore;
  }

  const active = [...scores]
    .filter(p => p.status === "active")
    .sort((a, b) => positionOrder(a) - positionOrder(b) || a.totalScore - b.totalScore);
  const cut = scores.filter(p => p.status !== "active");

  if (!scores.length) {
    return (
      <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 10, padding: 32, textAlign: "center" as const }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⛳</div>
        <div style={{ fontSize: 16, color: "var(--cream)", marginBottom: 8 }}>Tournament hasn&apos;t started yet</div>
        <div style={{ fontSize: 13, color: "var(--cream-dim)" }}>Live leaderboard will appear here once Round 1 begins on April 9th.</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: "var(--accent)", letterSpacing: "0.14em", textTransform: "uppercase" as const, marginBottom: 4 }}>Live</div>
        <div style={{ fontSize: 22, fontFamily: "Playfair Display, serif", color: "var(--cream)" }}>Masters Leaderboard</div>
        <div style={{ fontSize: 12, color: "var(--cream-dim)", marginTop: 4 }}>Augusta National · {active.length} players · Updated every 2 min</div>
      </div>

      {/* Header */}
      <div style={{
        background: "linear-gradient(180deg, #1a4a2e 0%, #0f3320 100%)",
        border: "1px solid #2d6b40", borderRadius: "10px 10px 0 0",
        display: "grid",
        gridTemplateColumns: "min(30px,7vw) 1fr min(30px,8vw) min(30px,8vw) min(30px,8vw) min(30px,8vw) min(42px,11vw)",
        padding: "8px 8px", gap: 2,
      }}>
        {["POS","PLAYER","R1","R2","R3","R4","TOTAL"].map(h => (
          <div key={h} style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", letterSpacing: "0.1em", textAlign: h === "PLAYER" ? "left" as const : "center" as const }}>{h}</div>
        ))}
      </div>

      {/* Players */}
      <div style={{ border: "1px solid #2d6b40", borderTop: "none", borderRadius: "0 0 10px 10px", overflow: "hidden", marginBottom: 16 }}>
        {active.map((p, i) => {
          const isOpen = expanded === p.name;
          const isLeader = i === 0;
          const isTied = i > 0 && p.totalScore === active[i-1].totalScore;
          return (
            <div key={p.name} style={{ borderBottom: i < active.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
              <button onClick={() => setExpanded(isOpen ? null : p.name)} style={{
                width: "100%", display: "grid",
                gridTemplateColumns: "min(30px,7vw) 1fr min(30px,8vw) min(30px,8vw) min(30px,8vw) min(30px,8vw) min(42px,11vw)",
                alignItems: "center", padding: "11px 8px", gap: 2,
                background: isLeader
                  ? "linear-gradient(90deg, rgba(201,168,76,0.12) 0%, rgba(201,168,76,0.04) 100%)"
                  : i % 2 === 0 ? "rgba(255,255,255,0.015)" : "transparent",
                border: "none", cursor: "pointer", textAlign: "left" as const,
              }}>
                {/* Position */}
                <div style={{ fontSize: 13, fontWeight: 700, textAlign: "center" as const, fontFamily: "monospace",
                  color: isLeader ? "#c9a84c" : "rgba(255,255,255,0.5)" }}>
                  {isTied ? `T${i+1}` : `${i+1}`}
                </div>
                {/* Name + headshot */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden" }}>
                  {p.headshot ? (
                    <img src={p.headshot} alt={p.name}
                      style={{ width: 24, height: 24, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: isLeader ? "1px solid rgba(201,168,76,0.5)" : "1px solid rgba(255,255,255,0.1)" }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : (
                    <div style={{ width: 24, height: 24, borderRadius: "50%", background: "rgba(255,255,255,0.06)", flexShrink: 0 }} />
                  )}
                  <div style={{ minWidth: 0, overflow: "hidden" }}>
                    <div style={{ fontSize: 13, fontWeight: isLeader ? 600 : 400,
                      color: isLeader ? "#c9a84c" : "#e8dcc8", fontFamily: "Playfair Display, serif",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.2 }}>
                      {p.name}
                    </div>
                    {p.teeTime && p.r1 === null && (
                      <div style={{ fontSize: 9, color: "rgba(201,168,76,0.65)", marginTop: 1, whiteSpace: "nowrap" }}>⏱ {p.teeTime}</div>
                    )}
                    {p.thru && p.r1 !== null && (
                      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginTop: 1, whiteSpace: "nowrap" }}>Thru {p.thru}</div>
                    )}
                  </div>
                </div>
                {/* Round scores */}
                {[p.r1, p.r2, p.r3, p.r4].map((r, ri) => (
                  <div key={ri} style={{ textAlign: "center" as const, fontFamily: "monospace", fontSize: 13 }}>{fmtScore(r)}</div>
                ))}
                {/* Total */}
                <div style={{ textAlign: "center" as const, fontFamily: "monospace", fontSize: 15 }}>{fmtTotal(p.totalScore, p.status)}</div>
              </button>
              {isOpen && (
                <div style={{ padding: "8px 16px 12px", background: "rgba(0,0,0,0.2)", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ display: "flex", gap: 16 }}>
                    {p.headshot && (
                      <img src={p.headshot} alt={p.name} style={{ width: 60, height: 60, borderRadius: 8, objectFit: "cover", border: "1px solid rgba(201,168,76,0.3)" }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    )}
                    <div>
                      <div style={{ fontSize: 15, color: "var(--cream)", fontFamily: "Playfair Display, serif", marginBottom: 4 }}>{p.name}</div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
                        {[["R1", p.r1], ["R2", p.r2], ["R3", p.r3], ["R4", p.r4]].map(([label, val]) => val !== null && (
                          <div key={label as string} style={{ background: "rgba(255,255,255,0.06)", borderRadius: 6, padding: "4px 10px", fontSize: 12, color: "var(--cream-dim)" }}>
                            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 10 }}>{label} </span>
                            {fmtScore(val as number)}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Cut/WD players */}
        {cut.length > 0 && (
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", padding: "6px 16px", background: "rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", marginBottom: 6 }}>CUT / WD</div>
            <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6 }}>
              {cut.map(p => (
                <span key={p.name} style={{ fontSize: 12, color: "#666", textDecoration: "line-through", padding: "2px 6px", background: "rgba(255,255,255,0.03)", borderRadius: 4 }}>{p.name}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Newsroom Tab ─────────────────────────────────────────────────────────────
const NEWSROOM_ACCOUNTS = [
  { handle: "TheMasters",   label: "The Masters",    emoji: "🌿", desc: "Official updates" },
  { handle: "PGATOUR",      label: "PGA Tour",       emoji: "⛳", desc: "Tour news & quotes" },
  { handle: "ForePlayPod",  label: "Fore Play",      emoji: "🎙️", desc: "Barstool golf" },
  { handle: "SI_Golf",      label: "SI Golf",        emoji: "📰", desc: "Expert commentary" },
  { handle: "GolfDigest",   label: "Golf Digest",    emoji: "📋", desc: "Golf news & analysis" },
  { handle: "TourPicks",    label: "Tour Picks",     emoji: "🎯", desc: "Betting previews" },
  { handle: "ReadTheLine_", label: "Read The Line",  emoji: "📊", desc: "Golf betting analysis" },
];

interface NewsItem {
  title: string; link: string; description: string;
  pubDate: string; source: string; sourceLabel: string; imageUrl: string | null;
}

function timeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h/24)}d ago`;
}

const SOURCE_COLORS: Record<string, string> = {
  espn: "#c84b11",
  golf: "#1a5c2a",
  golfchannel: "#003087",
};

function NewsroomTab() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    fetch("/api/news")
      .then(r => r.json())
      .then(d => { setItems(d.items ?? []); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  const sources = ["all", ...Array.from(new Set(items.map(i => i.source)))];
  const filtered = filter === "all" ? items : items.filter(i => i.source === filter);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: "var(--accent)", letterSpacing: "0.14em", textTransform: "uppercase" as const, marginBottom: 4 }}>Live Feed</div>
        <div style={{ fontSize: 22, fontFamily: "Playfair Display, serif", color: "var(--cream)", marginBottom: 4 }}>Golf Newsroom</div>
        <div style={{ fontSize: 13, color: "var(--cream-dim)" }}>Live headlines from ESPN Golf, PGA Tour & Golf Digest · Updated every 5 min</div>
      </div>

      {/* Follow on X buttons */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", marginBottom: 8 }}>FOLLOW ON X</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
          {NEWSROOM_ACCOUNTS.map(a => (
            <a key={a.handle} href={`https://twitter.com/${a.handle}`} target="_blank" rel="noopener noreferrer"
              style={{
                display: "flex", alignItems: "center", gap: 5, padding: "6px 12px",
                borderRadius: 20, fontSize: 12, textDecoration: "none",
                background: "rgba(255,255,255,0.05)", border: "1px solid var(--card-border)",
                color: "var(--cream-dim)", transition: "all 0.2s",
              }}>
              <span style={{ fontSize: 14 }}>𝕏</span>
              <span>@{a.handle}</span>
            </a>
          ))}
        </div>
      </div>

      {/* Source filter */}
      {!loading && items.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" as const }}>
          {sources.map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{
              padding: "5px 14px", borderRadius: 16, fontSize: 12, cursor: "pointer",
              fontFamily: "EB Garamond, serif",
              background: filter === s ? "var(--accent)" : "var(--card-bg)",
              color: filter === s ? "var(--bg)" : "var(--cream-dim)",
              border: `1px solid ${filter === s ? "var(--accent)" : "var(--card-border)"}`,
              fontWeight: filter === s ? 700 : 400,
            }}>
              {s === "all" ? "All Sources" : s === "espn" ? "ESPN Golf" : s === "golf" ? "Golf.com" : "Golf Channel"}
            </button>
          ))}
        </div>
      )}

      {/* News feed */}
      {loading && (
        <div style={{ textAlign: "center" as const, padding: 60, color: "var(--cream-dim)" }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>⛳</div>
          <div>Loading latest golf news…</div>
        </div>
      )}

      {error && (
        <div style={{ textAlign: "center" as const, padding: 40, color: "var(--cream-dim)" }}>
          <div style={{ fontSize: 13 }}>Unable to load news. Check back in a moment.</div>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div style={{ textAlign: "center" as const, padding: 40, color: "var(--cream-dim)" }}>
          <div style={{ fontSize: 13 }}>No news available right now.</div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column" as const, gap: 12 }}>
        {filtered.map((item, i) => (
          <a key={i} href={item.link} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
            <div style={{
              background: "var(--card-bg)", border: "1px solid var(--card-border)",
              borderRadius: 10, overflow: "hidden", display: "flex",
              transition: "border-color 0.2s",
            }}>
              {/* Image */}
              {item.imageUrl && (
                <div style={{ width: 100, flexShrink: 0, overflow: "hidden" }}>
                  <img src={item.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = "none"; }} />
                </div>
              )}
              {/* Content */}
              <div style={{ padding: "12px 14px", flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{
                    fontSize: 10, padding: "2px 7px", borderRadius: 10, fontWeight: 700,
                    background: SOURCE_COLORS[item.source] ?? "rgba(255,255,255,0.1)",
                    color: "#fff", letterSpacing: "0.06em",
                  }}>
                    {item.sourceLabel.toUpperCase()}
                  </span>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{timeAgo(item.pubDate)}</span>
                </div>
                <div style={{ fontSize: 15, color: "var(--cream)", fontFamily: "Playfair Display, serif", lineHeight: 1.3, marginBottom: 5 }}>
                  {item.title}
                </div>
                {item.description && (
                  <div style={{ fontSize: 12, color: "var(--cream-dim)", lineHeight: 1.5, overflow: "hidden",
                    display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>
                    {item.description}
                  </div>
                )}
              </div>
            </div>
          </a>
        ))}
      </div>

      {!loading && filtered.length > 0 && (
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", textAlign: "center" as const, marginTop: 20 }}>
          {filtered.length} articles · Refreshes every 5 minutes
        </div>
      )}
    </div>
  );
}

// ─── Course Tab ───────────────────────────────────────────────────────────────
function CourseTab({ tournament }: { tournament: Tournament }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const course = getCourseData(tournament.id);

  if (!course) {
    return (
      <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 10, padding: "32px 24px", textAlign: "center" }}>
        <p style={{ color: "var(--cream-dim)", fontStyle: "italic" }}>Course guide coming soon for {tournament.shortName}.</p>
      </div>
    );
  }

  const parCounts = course.holes.reduce((acc, h) => { acc[h.par] = (acc[h.par] || 0) + 1; return acc; }, {} as Record<number, number>);

  return (
    <div>
      {/* Course header card */}
      <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 10, padding: "20px 22px", marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, color: "var(--accent)", fontFamily: "Playfair Display, serif", marginBottom: 4 }}>{course.name}</h2>
        <p style={{ fontSize: 13, color: "var(--cream-dim)", marginBottom: 16 }}>{course.location}</p>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" as const }}>
          {[
            { label: "Par", value: course.par },
            { label: "Yards", value: course.yards.toLocaleString() },
            { label: "Par 3s", value: parCounts[3] || 0 },
            { label: "Par 4s", value: parCounts[4] || 0 },
            { label: "Par 5s", value: parCounts[5] || 0 },
          ].map(({ label, value }) => (
            <div key={label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 22, color: "var(--cream)", fontFamily: "Playfair Display, serif" }}>{value}</div>
              <div style={{ fontSize: 11, color: "var(--cream-dim)", letterSpacing: "0.08em", textTransform: "uppercase" as const }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Hole scorecard strip */}
      <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 10, padding: "14px 16px", marginBottom: 16, overflowX: "auto" as const }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(18, minmax(36px, 1fr))", gap: 3, minWidth: 600 }}>
          {course.holes.map(h => (
            <button key={h.hole} onClick={() => setExpanded(expanded === h.hole ? null : h.hole)}
              style={{
                padding: "6px 4px", border: `1px solid ${expanded === h.hole ? "var(--accent)" : "rgba(255,255,255,0.1)"}`,
                borderRadius: 6, background: expanded === h.hole ? "rgba(201,168,76,0.12)" : "rgba(255,255,255,0.03)",
                cursor: "pointer", textAlign: "center" as const,
              }}>
              <div style={{ fontSize: 10, color: "var(--cream-dim)" }}>#{h.hole}</div>
              <div style={{ fontSize: 13, color: h.par === 3 ? "var(--score-low)" : h.par === 5 ? "var(--accent)" : "var(--cream)", fontWeight: 600 }}>{h.par}</div>
              <div style={{ fontSize: 9, color: "var(--cream-dim)" }}>{h.yards}</div>
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 11, color: "var(--cream-dim)" }}>
          <span><span style={{ color: "var(--score-low)" }}>■</span> Par 3</span>
          <span><span style={{ color: "var(--cream)" }}>■</span> Par 4</span>
          <span><span style={{ color: "var(--accent)" }}>■</span> Par 5</span>
          <span style={{ marginLeft: "auto", fontStyle: "italic" }}>Tap a hole to expand</span>
        </div>
      </div>

      {/* Hole details */}
      {course.holes.map(h => (
        <div key={h.hole} style={{
          background: "var(--card-bg)", border: `1px solid ${expanded === h.hole ? "var(--accent)" : "var(--card-border)"}`,
          borderRadius: 10, marginBottom: 8, overflow: "hidden",
          transition: "border-color 0.2s",
        }}>
          {/* Hole header row — always visible */}
          <button onClick={() => setExpanded(expanded === h.hole ? null : h.hole)}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left" as const }}>
            {/* Hole number badge */}
            <div style={{
              width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: expanded === h.hole ? "var(--accent)" : "rgba(255,255,255,0.08)",
              color: expanded === h.hole ? "var(--bg)" : "var(--cream-dim)",
              fontSize: 14, fontWeight: 700,
            }}>{h.hole}</div>

            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: 15, color: "var(--cream)", fontFamily: "Playfair Display, serif" }}>{h.name}</span>
                <span style={{ fontSize: 12, color: "var(--cream-dim)" }}>Hole {h.hole}</span>
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 2 }}>
                <span style={{ fontSize: 12, color: h.par === 3 ? "var(--score-low)" : h.par === 5 ? "var(--accent)" : "var(--cream-dim)" }}>Par {h.par}</span>
                <span style={{ fontSize: 12, color: "var(--cream-dim)" }}>{h.yards} yds</span>
              </div>
            </div>
            <span style={{ fontSize: 12, color: "var(--cream-dim)" }}>{expanded === h.hole ? "▲" : "▼"}</span>
          </button>

          {/* Expanded detail */}
          {expanded === h.hole && (
            <div style={{ padding: "0 16px 16px", borderTop: "1px solid var(--card-border)" }}>
              <p style={{ fontSize: 14, color: "var(--cream)", lineHeight: 1.7, marginTop: 12, marginBottom: 10 }}>{h.description}</p>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "rgba(201,168,76,0.06)", border: "1px solid rgba(201,168,76,0.15)", borderRadius: 6, padding: "8px 12px" }}>
                <span style={{ fontSize: 14 }}>📌</span>
                <span style={{ fontSize: 13, color: "var(--accent)", fontStyle: "italic" }}>{h.notes}</span>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}


// ─── Tournament Day Banner ────────────────────────────────────────────────────
const TOURNAMENT_DAYS: Record<string, { round: string; title: string; subtitle: string; emoji: string }> = {
  "2026-04-09": { round: "Round 1", title: "First Tee Thursday",     subtitle: "The first tee shots are in the air. Let's go.",       emoji: "🌅" },
  "2026-04-10": { round: "Round 2", title: "Cut Line Friday",        subtitle: "Survive today and play the weekend.",                  emoji: "✂️" },
  "2026-04-11": { round: "Round 3", title: "Moving Day",             subtitle: "Time to make your move up the leaderboard.",          emoji: "🚀" },
  "2026-04-12": { round: "Round 4", title: "Green Jacket Sunday",    subtitle: "A green jacket is on the line. Best day in golf.",    emoji: "🏆" },
};

// ─── Masters Splash Screen ────────────────────────────────────────────────────
function MastersSplash({ onDone, bgImage, audioRef, muted, onUnmute }: {
  onDone: () => void; bgImage?: string;
  audioRef: React.MutableRefObject<HTMLAudioElement | null>;
  muted: boolean; onUnmute: () => void;
}) {
  const [phase, setPhase] = useState<"in" | "hold" | "out">("in");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("hold"), 600);
    const t2 = setTimeout(() => setPhase("out"), 8000);
    const t3 = setTimeout(() => onDone(), 8800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onDone]);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 99999,
      display: "flex", flexDirection: "column" as const, alignItems: "center", justifyContent: "center",
      background: "#071510",
      opacity: phase === "in" ? 0 : phase === "hold" ? 1 : 0,
      transition: phase === "in" ? "opacity 600ms ease" : "opacity 800ms ease",
      overflow: "hidden",
    }}>
      {bgImage && (
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `url(${bgImage})`,
          backgroundSize: "cover", backgroundPosition: "right center",
          opacity: 0.80, filter: "none",
        }} />
      )}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(135deg, rgba(7,21,16,0.92) 0%, rgba(15,35,24,0.85) 50%, rgba(7,21,16,0.92) 100%)",
      }} />
      <div style={{ position: "relative", textAlign: "center" as const, padding: "0 32px", maxWidth: 500 }}>
        <div style={{ marginBottom: 24, display: "flex", justifyContent: "center", filter: "drop-shadow(0 0 20px rgba(201,168,76,0.5))" }}><TexasIcon size={64} color="#c9a84c" /></div>
        <div style={{
          fontFamily: "Playfair Display, EB Garamond, serif",
          fontSize: 28, fontWeight: 400, letterSpacing: "0.04em",
          color: "#c9a84c", lineHeight: 1.3, marginBottom: 12,
          textShadow: "0 2px 20px rgba(201,168,76,0.3)",
        }}>
          A Tradition Unlike Any Other
        </div>
        <div style={{
          fontFamily: "EB Garamond, serif", fontSize: 15,
          color: "rgba(240,233,214,0.7)", letterSpacing: "0.18em",
          textTransform: "uppercase" as const, marginBottom: 6,
        }}>
          The Masters Tournament
        </div>
        <div style={{
          fontFamily: "EB Garamond, serif", fontSize: 15,
          color: "rgba(240,233,214,0.5)", letterSpacing: "0.22em",
          textTransform: "uppercase" as const, marginBottom: 40,
          textAlign: "center" as const,
        }}>
          2026
        </div>
        <div style={{ width: 60, height: 1, background: "rgba(201,168,76,0.4)", margin: "0 auto 32px" }} />
        <div style={{
          fontFamily: "EB Garamond, serif", fontSize: 12,
          color: "rgba(255,255,255,0.35)", letterSpacing: "0.14em",
          textTransform: "uppercase" as const, marginBottom: 6,
        }}>
          Proudly brought to you by
        </div>
        <div style={{
          fontFamily: "Playfair Display, EB Garamond, serif",
          fontSize: 20, fontWeight: 600, color: "rgba(240,233,214,0.9)",
          letterSpacing: "0.06em", marginBottom: 32,
        }}>
          Patterson Inc.
        </div>
        <button
          onClick={onUnmute}
          style={{
            background: muted ? "rgba(201,168,76,0.12)" : "rgba(93,186,126,0.15)",
            border: `1px solid ${muted ? "rgba(201,168,76,0.35)" : "rgba(93,186,126,0.4)"}`,
            borderRadius: 30, padding: "8px 20px", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 8, margin: "0 auto",
            transition: "all 0.3s ease",
          }}
        >
          <span style={{ fontSize: 16 }}>{muted ? "🔇" : "🔊"}</span>
          <span style={{
            fontFamily: "EB Garamond, serif", fontSize: 13,
            color: muted ? "rgba(201,168,76,0.8)" : "rgba(93,186,126,0.9)",
            letterSpacing: "0.08em",
          }}>
            {muted ? "Tap to unmute" : "Playing..."}
          </span>
        </button>
      </div>
    </div>
  );
}

// ─── Round Leader Banner ──────────────────────────────────────────────────────
// ─── Pool Usage Ticker ────────────────────────────────────────────────────────
function PoolUsageTicker({ picks, registeredUsers }: { picks: Pick[]; registeredUsers: { id: string; username: string }[] }) {
  const totalUsers = registeredUsers.length;
  if (!totalUsers || !picks.length) return null;

  // Count how many distinct users have picked each golfer across all rounds
  const golferUsers: Record<string, Set<string>> = {};
  picks.forEach(p => {
    if (!golferUsers[p.golfer]) golferUsers[p.golfer] = new Set();
    golferUsers[p.golfer].add(p.user_id);
  });

  // Build sorted list: most picked first, show name + % of pool
  const items = Object.entries(golferUsers)
    .map(([golfer, users]) => ({ golfer, count: users.size, pct: Math.round((users.size / totalUsers) * 100) }))
    .sort((a, b) => b.count - a.count || a.golfer.localeCompare(b.golfer));

  if (!items.length) return null;

  function PickItem({ item, prefix }: { item: typeof items[0]; prefix: string }) {
    const lastName = item.golfer.split(" ").slice(-1)[0];
    const firstInit = item.golfer.split(" ").length > 1 ? item.golfer.split(" ")[0][0] + "." : "";
    const pctColor = item.pct >= 75 ? "#c9a84c" : item.pct >= 50 ? "#e8dcc8" : "rgba(240,233,214,0.6)";
    return (
      <span key={`${prefix}-${item.golfer}`} style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        padding: "0 10px", borderRight: "1px solid rgba(255,255,255,0.08)",
        flexShrink: 0, whiteSpace: "nowrap",
      }}>
        <span style={{ fontSize: 11, color: "rgba(240,233,214,0.85)" }}>
          {firstInit && <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 10 }}>{firstInit} </span>}
          {lastName}
        </span>
        <span style={{ fontSize: 11, fontFamily: "monospace", fontWeight: 700, color: pctColor }}>
          {item.pct}%
        </span>
      </span>
    );
  }

  return (
    <div className="ticker-wrap" style={{ padding: "5px 0" }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <div style={{
          flexShrink: 0, padding: "0 12px", borderRight: "1px solid rgba(201,168,76,0.3)",
          fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
          color: "#c9a84c", background: "#061210", zIndex: 1,
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <span>🏌️</span>
          <span>POOL</span>
        </div>
        <div style={{ overflow: "hidden", flex: 1 }}>
          <div className="ticker-track">
            {items.map(item => <PickItem key={`a-${item.golfer}`} item={item} prefix="a" />)}
            {items.map(item => <PickItem key={`b-${item.golfer}`} item={item} prefix="b" />)}
          </div>
        </div>
      </div>
    </div>
  );
}

function RoundLeaderBanner({ picks, scores, registeredUsers }: {
  picks: Pick[]; scores: GolferScore[]; registeredUsers: { id: string; username: string }[];
}) {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [leaderInfo, setLeaderInfo] = useState<{ username: string; total: number; round: number } | null>(null);

  useEffect(() => {
    if (!picks.length || !scores.length) return;

    const scoreMap = Object.fromEntries(scores.map((s) => [s.name, s]));
    const userMap: Record<string, string> = {};
    registeredUsers.forEach((u) => { userMap[u.id] = u.username; });
    picks.forEach((p) => { userMap[p.user_id] = p.username; });

    // Find the latest completed round (all 3 picks have a score for that round)
    let latestCompletedRound = 0;
    for (let r = 4; r >= 1; r--) {
      const usersWithPicksThisRound = Object.keys(userMap).filter(uid =>
        picks.filter(p => p.user_id === uid && p.round_number === r).length === 3
      );
      if (usersWithPicksThisRound.length === 0) continue;
      const allHaveScores = usersWithPicksThisRound.every(uid => {
        const rPicks = picks.filter(p => p.user_id === uid && p.round_number === r).map(p => p.golfer);
        return rPicks.every(g => {
          const sc = scoreMap[g];
          if (!sc) return false;
          const val = [null, sc.r1, sc.r2, sc.r3, sc.r4][r];
          return val !== null;
        });
      });
      if (allHaveScores) { latestCompletedRound = r; break; }
    }

    if (!latestCompletedRound) return;

    // Check if we already showed this banner this session
    const shownKey = `mp_leader_banner_r${latestCompletedRound}`;
    if (sessionStorage.getItem(shownKey)) return;

    // Calculate standings
    const standings = Object.entries(userMap).map(([uid, uname]) => {
      let total = 0;
      for (let r = 1; r <= latestCompletedRound; r++) {
        const rPicks = picks.filter(p => p.user_id === uid && p.round_number === r).map(p => p.golfer);
        if (!rPicks.length) continue;
        const roundScores = rPicks.map(g => {
          const sc = scoreMap[g];
          if (!sc) return null;
          return [null, sc.r1, sc.r2, sc.r3, sc.r4][r] ?? null;
        });
        const valid = roundScores.filter((s): s is number => s !== null);
        if (valid.length === 0) continue;
        const score = r <= 2
          ? [...valid].sort((a, b) => a - b).slice(0, 2).reduce((s, v) => s + v, 0)
          : valid.reduce((s, v) => s + v, 0);
        total += score;
      }
      return { uid, username: uname, total };
    }).sort((a, b) => a.total - b.total);

    if (!standings.length) return;
    const leader = standings[0];

    sessionStorage.setItem(shownKey, "1");
    setLeaderInfo({ username: leader.username, total: leader.total, round: latestCompletedRound });

    const t1 = setTimeout(() => { setMounted(true); setVisible(true); }, 1200);
    const t2 = setTimeout(() => setVisible(false), 7000);
    const t3 = setTimeout(() => setMounted(false), 7800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [picks, scores, registeredUsers]);

  if (!mounted || !leaderInfo) return null;

  const scoreStr = leaderInfo.total === 0 ? "E" : leaderInfo.total > 0 ? `+${leaderInfo.total}` : `${leaderInfo.total}`;

  return (
    <div style={{
      position: "fixed", bottom: 90, left: "50%",
      transform: visible ? "translateX(-50%) translateY(0)" : "translateX(-50%) translateY(120px)",
      opacity: visible ? 1 : 0,
      transition: "transform 500ms cubic-bezier(0.34,1.56,0.64,1), opacity 400ms ease",
      zIndex: 9998, pointerEvents: "none",
    }}>
      <div style={{
        background: "linear-gradient(135deg, #0b3d2e 0%, #155734 100%)",
        border: "1px solid rgba(201,168,76,0.5)",
        borderRadius: 14, padding: "12px 20px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", gap: 12, minWidth: 260,
      }}>
        <div style={{ fontSize: 24 }}>🏆</div>
        <div>
          <div style={{ fontSize: 10, color: "rgba(201,168,76,0.8)", letterSpacing: "0.12em", textTransform: "uppercase" as const, marginBottom: 2 }}>
            Leader through Round {leaderInfo.round}
          </div>
          <div style={{ fontSize: 18, fontWeight: 600, color: "#f0e9d6", fontFamily: "Playfair Display, serif" }}>
            {resolveUser(leaderInfo.username).displayName} <span style={{ color: "#5dba7e", fontSize: 15 }}>{scoreStr}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function TournamentDayBanner() {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Get today's date in ET
    const now = new Date();
    const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
    const today = et.toISOString().slice(0, 10);
    const dayData = TOURNAMENT_DAYS[today];
    if (!dayData) return;

    const showTimer = setTimeout(() => { setMounted(true); setVisible(true); }, 800);
    const hideTimer = setTimeout(() => { setVisible(false); }, 6000);
    const unmountTimer = setTimeout(() => { setMounted(false); }, 6700);
    return () => { clearTimeout(showTimer); clearTimeout(hideTimer); clearTimeout(unmountTimer); };
  }, []);

  if (!mounted) return null;

  return (
    <div style={{
      position: "fixed", top: 80, right: 16, zIndex: 9999, pointerEvents: "none",
      transform: visible ? "translateX(0)" : "translateX(120%)",
      opacity: visible ? 1 : 0,
      transition: "transform 500ms cubic-bezier(0.34,1.56,0.64,1), opacity 400ms ease",
    }}>
      <div style={{
        minWidth: 260, maxWidth: 320, borderRadius: 14, padding: "14px 16px",
        background: "linear-gradient(135deg, #0b3d2e 0%, #155734 50%, #1a6b40 100%)",
        boxShadow: "0 12px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.12)",
        border: "1px solid rgba(201,168,76,0.35)",
      }}>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(201,168,76,0.15)", fontSize: 18,
            border: "1px solid rgba(201,168,76,0.3)",
          }}>
            {Object.values(TOURNAMENT_DAYS).find(d => d.title === Object.values(TOURNAMENT_DAYS).find(x => x.emoji)?.title)?.emoji ?? "⛳"}
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "rgba(201,168,76,0.85)", marginBottom: 2 }}>
              The Masters 2026
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", letterSpacing: "0.06em" }}>
              {Object.entries(TOURNAMENT_DAYS).find(([, v]) => v.title === Object.entries(TOURNAMENT_DAYS).find(([k]) => {
                const et = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
                return k === et.toISOString().slice(0, 10);
              })?.[0])?.[1]?.round ?? ""}
            </div>
          </div>
        </div>
        {/* Title */}
        <BannerContent />
      </div>
    </div>
  );
}

function BannerContent() {
  const et = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
  const today = et.toISOString().slice(0, 10);
  const day = TOURNAMENT_DAYS[today];
  if (!day) return null;
  return (
    <>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#fff", lineHeight: 1.1, marginBottom: 6 }}>
        {day.emoji} {day.title}
      </div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", lineHeight: 1.5, borderTop: "1px solid rgba(201,168,76,0.2)", paddingTop: 8 }}>
        {day.subtitle}
      </div>
      {/* Round indicator dots */}
      <div style={{ display: "flex", gap: 4, marginTop: 10, justifyContent: "center" }}>
        {["R1","R2","R3","R4"].map((r, i) => {
          const roundDate = ["2026-04-09","2026-04-10","2026-04-11","2026-04-12"][i];
          const isToday = roundDate === today;
          const isPast = roundDate < today;
          return (
            <div key={r} style={{
              padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: isToday ? 700 : 400,
              background: isToday ? "rgba(201,168,76,0.3)" : isPast ? "rgba(255,255,255,0.08)" : "transparent",
              color: isToday ? "rgba(201,168,76,1)" : isPast ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.2)",
              border: isToday ? "1px solid rgba(201,168,76,0.4)" : "1px solid rgba(255,255,255,0.1)",
            }}>{r}</div>
          );
        })}
      </div>
    </>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function Page() {
  const [hydrated, setHydrated] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("picks");
  const [picks, setPicks] = useState<Pick[]>([]);
  const [scores, setScores] = useState<GolferScore[]>([]);
  const [registeredUsers, setRegisteredUsers] = useState<{id: string; username: string}[]>([]);
  const [roundOverride, setRoundOverride] = useState<number | null>(null);
  const [adminOverrides, setAdminOverrides] = useState<{roundOverride?: number; revealAll?: boolean; skipDeadline?: boolean}>({});
  const [odds, setOdds] = useState<Record<string, string>>({});
  const [playerCount, setPlayerCount] = useState(0);
  const [pickStatus, setPickStatus] = useState<Record<string, number[]>>({});
  const [showSplash, setShowSplash] = useState(false);
  const [splashDone, setSplashDone] = useState(() => typeof window !== "undefined" && !!sessionStorage.getItem("mp_splash_shown"));
  const [musicMuted, setMusicMuted] = useState(true);
  const musicRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio once
  useEffect(() => {
    // Try multiple sources in order
    const sources = [
      "/masters-theme.mp3",
    ];
    const audio = new Audio();
    audio.volume = 0.35;
    audio.loop = true;
    // Try each source until one loads
    let srcIndex = 0;
    const tryNext = () => {
      if (srcIndex >= sources.length) return;
      audio.src = sources[srcIndex++];
      audio.load();
    };
    audio.addEventListener("error", tryNext);
    tryNext();
    musicRef.current = audio;
    return () => { audio.pause(); };
  }, []);

  function handleUnmute() {
    if (!musicRef.current) return;
    musicRef.current.play().catch(() => {});
    setMusicMuted(false);
  }

  function handleMuteToggle() {
    if (!musicRef.current) return;
    if (musicMuted) {
      musicRef.current.play().catch(() => {});
      setMusicMuted(false);
    } else {
      musicRef.current.pause();
      setMusicMuted(true);
    }
  }
  const tournament = getActiveTournament();
  const th = tournament.theme;

  useEffect(() => {
    const t = localStorage.getItem("mp_token");
    const u = localStorage.getItem("mp_username");
    const id = localStorage.getItem("mp_userId");
    if (t && u && id) {
      setToken(t); setUsername(u); setUserId(id);
      // Show splash once per session even if already logged in
      if (!sessionStorage.getItem("mp_splash_shown")) {
        setShowSplash(true);
      }
    }
    setHydrated(true);
  }, []);

  const fetchData = useCallback(async (t: string) => {
    const tid = tournament.id;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    async function safeJson<T>(res: Response, fallback: T): Promise<T> {
      try { return res.ok ? await res.json() : fallback; }
      catch { return fallback; }
    }

    try {
      const [picksRes, scoresRes, oddsRes, playersRes, usersRes, overridesRes, pickStatusRes] = await Promise.all([
        fetch(`/api/picks?tournament=${tid}`, { headers: { Authorization: `Bearer ${t}` }, signal: controller.signal }),
        fetch(`/api/scores?tournament=${tid}`, { signal: controller.signal }),
        fetch(`/api/odds?tournament=${tid}`, { signal: controller.signal }),
        fetch("/api/players", { headers: { Authorization: `Bearer ${t}` }, signal: controller.signal }),
        fetch("/api/users", { headers: { Authorization: `Bearer ${t}` }, signal: controller.signal }),
        fetch("/api/overrides", { signal: controller.signal }),
        fetch(`/api/pick-status?tournament=${tid}`, { headers: { Authorization: `Bearer ${t}` }, signal: controller.signal }),
      ]);

      // Parse each response independently — one bad response cannot blank others
      const [picksData, scoresData, oddsData, playersData, usersData, overridesData, pickStatusData] = await Promise.all([
        safeJson(picksRes,     { picks: [] }),
        safeJson(scoresRes,    { scores: [] }),
        safeJson(oddsRes,      { odds: {} }),
        safeJson(playersRes,   { count: 0 }),
        safeJson(usersRes,     { users: [] }),
        safeJson(overridesRes, {}),
        safeJson(pickStatusRes, { status: {} }),
      ]);

      setPicks(picksData.picks ?? []);
      setScores(scoresData.scores ?? []);
      setOdds(oddsData.odds ?? {});
      setPlayerCount(playersData.count ?? 0);
      setRegisteredUsers(usersData.users ?? []);
      setAdminOverrides(overridesData ?? {});
      setPickStatus(pickStatusData.status ?? {});
    } catch (err) {
      if ((err as Error).name !== "AbortError") console.warn("fetchData error:", err);
    } finally {
      clearTimeout(timeoutId);
    }
  }, [tournament.id]);

  useEffect(() => { if (token) fetchData(token); }, [token, fetchData]);
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => fetchData(token), 2 * 60 * 1000); // 2 min refresh
    const onVisible = () => { if (document.visibilityState === "visible") fetchData(token); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", onVisible); };
  }, [token, fetchData]);

  function handleLogin(t: string, u: string) {
    const payload = JSON.parse(atob(t.split(".")[1]));
    localStorage.setItem("mp_token", t);
    localStorage.setItem("mp_username", u);
    localStorage.setItem("mp_userId", payload.userId);
    setToken(t); setUsername(u); setUserId(payload.userId);
    if (!sessionStorage.getItem("mp_splash_shown")) {
      setShowSplash(true);
    }
  }

  function handleLogout() {
    ["mp_token", "mp_username", "mp_userId"].forEach((k) => localStorage.removeItem(k));
    setToken(null); setUsername(null); setUserId(null);
    setPicks([]); setScores([]);
    if (musicRef.current) { musicRef.current.pause(); setMusicMuted(true); }
  }

  if (!hydrated) return null;
  if (!token || !username || !userId) return <AuthScreen tournament={tournament} onLogin={handleLogin} />;

  return (
    <div style={{ minHeight: "100vh", background: th.bg, color: th.cream, fontFamily: "EB Garamond, serif", paddingBottom: 80, ...themeVars(tournament) }}>
      {showSplash && !splashDone && (
        <MastersSplash
          onDone={() => { setSplashDone(true); setShowSplash(false); sessionStorage.setItem("mp_splash_shown", "1"); }}
          bgImage="/splash-bg.jpg"
          audioRef={musicRef}
          muted={musicMuted}
          onUnmute={handleUnmute}
        />
      )}
      <RoundLeaderBanner picks={picks} scores={scores} registeredUsers={registeredUsers} />
      <TournamentDayBanner />
      {/* Header */}
      <div style={{ background: th.bgDark, borderBottom: `1px solid ${th.cardBorder}`, padding: "18px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ display: "inline-flex", alignItems: "center" }}>{tournament.id === "masters" ? <TexasIcon size={20} color={th.accent} /> : <span style={{ fontSize: 20 }}>{th.emoji}</span>}</span>
            <h1 style={{ fontSize: 20, color: th.accent, fontFamily: "Playfair Display, serif", lineHeight: 1 }}>Major Pick&apos;em</h1>
          </div>
          <div style={{ fontSize: 11, color: th.creamDim, letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 3 }}>{tournament.shortName} · {tournament.location}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <PlayerAvatar username={username} size={28} />
          <span style={{ fontSize: 14, color: th.creamDim, fontStyle: "italic" }}>{resolveUser(username).displayName}</span>
          <button onClick={handleMuteToggle} title={musicMuted ? "Unmute music" : "Mute music"} style={{
            background: "transparent", border: `1px solid ${th.cardBorder}`,
            color: th.creamDim, padding: "6px 10px", borderRadius: 6, fontSize: 15, cursor: "pointer",
          }}>
            {musicMuted ? "🔇" : "🔊"}
          </button>
          <button onClick={handleLogout} style={{ background: "transparent", border: `1px solid ${th.cardBorder}`, color: th.creamDim, padding: "6px 14px", borderRadius: 6, fontSize: 13, cursor: "pointer" }}>
            Sign out
          </button>
        </div>
      </div>

      {/* Champion banner */}
      <CourseHero tournament={tournament} splashDone={splashDone} />
      <ChampionBanner tournament={tournament} />

      {/* Tab nav */}
      <div className="tab-nav" style={{ background: th.bgDark, borderBottom: `1px solid ${th.cardBorder}`, display: "flex", position: "sticky", top: 73, zIndex: 40 }}>
        {(["picks", "leaderboard", "tournament", "history", "course", "newsroom"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "13px 18px", fontSize: 14, background: "transparent", border: "none",
            borderBottom: tab === t ? `2px solid ${th.accent}` : "2px solid transparent",
            color: tab === t ? th.accent : th.creamDim,
            cursor: "pointer", fontFamily: "Playfair Display, serif",
            fontWeight: tab === t ? 600 : 400, transition: "all 0.2s", whiteSpace: "nowrap" as const,
          }}>
            {t === "picks" ? "🎯 My Picks"
              : t === "leaderboard" ? "🪙 Pick'em Leaderboard"
              : t === "tournament" ? "⛳ Tournament"
              : t === "history" ? "📜 History"
              : t === "course" ? "🔍 Course Guide"
              : "📡 Newsroom"}
          </button>
        ))}
      </div>

      {/* Pool usage ticker */}
      <PoolUsageTicker picks={picks} registeredUsers={registeredUsers} />

      {/* Content */}
      <main style={{ maxWidth: 700, margin: "0 auto", padding: "20px 12px" }}>
        {tab === "picks" && token && userId && (
          <MyPicksTab token={token} userId={userId} tournament={tournament} allPicks={picks} scores={scores} odds={odds} currentRound={adminOverrides.roundOverride ?? getCurrentRound(tournament)} revealAll={!!adminOverrides.revealAll} skipDeadline={!!adminOverrides.skipDeadline} onPicksChanged={() => fetchData(token)} />
        )}
        {tab === "leaderboard" && (
          <LeaderboardTab tournament={tournament} allPicks={picks} scores={scores} playerCount={playerCount} registeredUsers={registeredUsers} currentRound={adminOverrides.roundOverride ?? getCurrentRound(tournament)} pickStatus={pickStatus} />
        )}
        {tab === "tournament" && (
          <TournamentLeaderboardTab scores={scores} />
        )}
        {tab === "history" && (
          <HistoryTab tournament={tournament} allPicks={picks} scores={scores} />
        )}
        {tab === "course" && (
          <CourseTab tournament={tournament} />
        )}
        {tab === "newsroom" && (
          <NewsroomTab />
        )}
      </main>
    </div>
  );
}
