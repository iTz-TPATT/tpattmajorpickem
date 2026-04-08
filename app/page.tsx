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
}
type Tab = "picks" | "leaderboard" | "history" | "course";

// ─── Utilities ────────────────────────────────────────────────────────────────
function normalizeName(name: string): string {
  return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
}


// ─── Avatar ───────────────────────────────────────────────────────────────────
function avatarUrl(username: string): string {
  // Convert "Trenton Patterson" -> "/avatars/trenton-patterson.jpg"
  const slug = username.trim().toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "-");
  return `/avatars/${slug}.jpg`;
}

function PlayerAvatar({ username, size = 32, style }: {
  username: string;
  size?: number;
  style?: React.CSSProperties;
}) {
  const [srcIndex, setSrcIndex] = useState(0);
  const initials = username.trim().split(/\s+/).map(w => w[0]?.toUpperCase() ?? "").slice(0, 2).join("");
  const hue = username.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;

  // Try jpg first, then png, then show initials
  const slug = username.trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, "-");
  const srcs = [`/avatars/${slug}.jpg`, `/avatars/${slug}.png`];
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
        // eslint-disable-next-line @next/next/no-img-element
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
  const size = 130;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = 48;
  const n = data.length;

  function polar(angle: number, r: number) {
    const a = (angle - 90) * (Math.PI / 180);
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  }

  function sdToR(sd: number) {
    // Map -3..3 SDs to 0..maxR, center at maxR/2
    return Math.max(4, Math.min(maxR, (sd + 3) / 6 * maxR));
  }

  const angleStep = 360 / n;
  const points = data.map((d, i) => polar(i * angleStep, sdToR(d.value)));
  const polygon = points.map(p => `${p.x},${p.y}`).join(" ");

  // Grid rings at -2, -1, 0 (avg), +1, +2 SDs
  const rings = [-2, -1, 0, 1, 2, 3].map(sd => sdToR(sd));

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
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
      {/* Dots at each vertex */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill={accent} />
      ))}
      {/* Labels */}
      {data.map((d, i) => {
        const lp = polar(i * angleStep, maxR + 16);
        const isLeft = lp.x < cx - 5;
        return (
          <text key={i} x={lp.x} y={lp.y + 4}
            textAnchor={isLeft ? "end" : lp.x > cx + 5 ? "start" : "middle"}
            fontSize={7.5} fill="rgba(255,255,255,0.7)" fontFamily="EB Garamond, serif">
            {d.label}
          </text>
        );
      })}
      {/* Center "AVG" label */}
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
      borderRadius: 10, padding: "12px 14px", zIndex: 100,
      minWidth: radarData ? 310 : 200, maxWidth: 360,
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
  name, score, selected, burned, cut, disabled, odds, espnId, headshot, onClick,
}: {
  name: string; score: GolferScore | undefined; selected: boolean; burned: boolean;
  cut: boolean; disabled: boolean; odds: string; espnId: string; headshot: string | null;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  const totalScore = score?.totalScore ?? null;

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
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
            // eslint-disable-next-line @next/next/no-img-element
            <img src={headshot} alt={name} width={36} height={36} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 20%" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "var(--cream-dim)" }}>
              {name[0]}
            </div>
          )}
        </div>

        {/* Name & badges */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, color: selected ? "var(--accent)" : burned || cut ? "var(--cream-dim)" : "var(--cream)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {name}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 2, alignItems: "center" }}>
            {burned && <span style={{ fontSize: 10, background: "rgba(255,255,255,0.08)", color: "var(--cream-dim)", padding: "1px 6px", borderRadius: 10, letterSpacing: "0.06em" }}>USED</span>}
            {cut && <span style={{ fontSize: 10, background: "rgba(192,57,43,0.15)", color: "#e07b6f", padding: "1px 6px", borderRadius: 10, letterSpacing: "0.06em" }}>CUT</span>}
            {odds && !burned && !cut && <span style={{ fontSize: 11, color: "var(--accent-light, var(--accent))", opacity: 0.8 }}>{odds}</span>}
            {score?.position && !burned && !cut && <span style={{ fontSize: 11, color: "var(--cream-dim)" }}>{score.position}</span>}
          </div>
        </div>

        {/* Score */}
        <div style={{ fontSize: 15, fontFamily: "monospace", color: scoreColor(totalScore), flexShrink: 0 }}>
          {fmtScore(totalScore)}
        </div>
      </button>

      {/* Hover stats tooltip */}
      {hover && espnId && !burned && !cut && (
        <StatsTooltip espnId={espnId} playerName={name} visible={hover} />
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

function CourseHero({ tournament }: { tournament: Tournament }) {
  const [photos, setPhotos] = useState<{ url: string; fallbackUrl?: string; caption: string }[]>([]);
  const [idx, setIdx] = useState(0);
  const [opacity, setOpacity] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch photos on mount
  useEffect(() => {
    setPhotos([]);
    setIdx(0);
    setOpacity(0);
    fetch(`/api/course-photos?tournament=${tournament.id}`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.photos) && d.photos.length > 0) setPhotos(d.photos); })
      .catch(() => null);
  }, [tournament.id]);

  // Start rotation timer once photos are loaded and visible
  const startTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      // Fade out
      setOpacity(0);
      // After fade, advance index, then fade back in
      setTimeout(() => {
        setIdx(prev => (prev + 1) % photos.length);
        setTimeout(() => setOpacity(1), 50);
      }, FADE_MS);
    }, DISPLAY_MS);
  }, [photos.length]);

  useEffect(() => {
    if (photos.length > 1) startTimer();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [idx, photos.length, startTimer]);

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
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`${tournament.id}-${idx}`}
          src={photo.url}
          alt={photo.caption}
          onLoad={() => { setOpacity(1); startTimer(); }}
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
  token, userId, tournament, allPicks, scores, odds, onPicksChanged,
}: {
  token: string; userId: string; tournament: Tournament;
  allPicks: Pick[]; scores: GolferScore[]; odds: Record<string, string>;
  onPicksChanged: () => void;
}) {
  const round = getCurrentRound(tournament);
  const revealed = isRoundRevealed(tournament, round);
  const revealDate = new Date(tournament.rounds[round as 1|2|3|4].revealTimeUTC);
  const [countdown, setCountdown] = useState(fmtCountdown(revealDate));
  const [selected, setSelected] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saved, setSaved] = useState(false);
  const [sortMode, setSortMode] = useState<"leaderboard" | "alpha">("leaderboard");

  const scoreMap = Object.fromEntries(scores.map((s) => [s.name, s]));

  // My picks for this round
  const myCurrentPicks = allPicks.filter((p) => p.user_id === userId && p.round_number === round).map((p) => p.golfer);

  // All golfers I've used in previous rounds (burned)
  const burnedSet = new Set(
    allPicks.filter((p) => p.user_id === userId && p.round_number < round).map((p) => p.golfer)
  );

  // Cut players (status !== 'active')
  const cutSet = new Set(scores.filter((s) => s.status !== "active").map((s) => s.name));

  useEffect(() => {
    setSelected(myCurrentPicks);
    setSaved(myCurrentPicks.length === 3);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allPicks, userId, round]);

  useEffect(() => {
    const t = setInterval(() => setCountdown(fmtCountdown(revealDate)), 1000);
    return () => clearInterval(t);
  }, [revealDate]);

  function toggle(g: string) {
    if (revealed || burnedSet.has(g) || (round >= 3 && cutSet.has(g))) return;
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
        body: JSON.stringify({ tournament: tournament.id, round, golfers: selected }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setSaved(true); setSuccess("Picks saved!"); onPicksChanged();
    } catch { setError("Network error"); }
    finally { setSubmitting(false); }
  }

  // Build sorted golfer list based on sortMode
  const sortedGolfers = [...scores].sort((a, b) => {
    const aAvail = !burnedSet.has(a.name) && a.status === "active";
    const bAvail = !burnedSet.has(b.name) && b.status === "active";
    // Always put unavailable (burned/cut) players at the bottom
    if (aAvail && !bAvail) return -1;
    if (!aAvail && bAvail) return 1;
    // Within available: sort by selected mode
    if (sortMode === "alpha") return a.name.localeCompare(b.name);
    return a.totalScore - b.totalScore; // leaderboard order
  });

  const scoringNote = round <= 2
    ? "Lowest 2 of your 3 golfer scores count this round"
    : "All 3 of your golfer scores count this round";

  return (
    <div>
      {/* Round header */}
      <div style={{ ...card }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
          <div>
            <h2 style={{ fontSize: 18, color: "var(--accent)", fontFamily: "Playfair Display, serif" }}>
              {ROUND_LABELS[round]} {revealed ? "— Locked" : "— Open"}
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

        {/* Golfer list */}
        {!revealed && (
          <>
            <div style={{ height: 1, background: "var(--card-border)", margin: "12px 0" }} />
            <p style={{ fontSize: 13, color: "var(--cream-dim)", marginBottom: 12 }}>
              Pick 3 golfers. Hover for season stats. Grayed = already used or cut.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {sortedGolfers.map((gs) => (
                <GolferCard
                  key={gs.name}
                  name={gs.name}
                  score={gs}
                  selected={selected.includes(gs.name)}
                  burned={burnedSet.has(gs.name)}
                  cut={round >= 3 && gs.status !== "active"}
                  disabled={!selected.includes(gs.name) && selected.length >= 3}
                  odds={odds[gs.name] ?? odds[normalizeName(gs.name)] ?? ""}
                  espnId={gs.espnId}
                  headshot={gs.headshot}
                  onClick={() => toggle(gs.name)}
                />
              ))}
            </div>

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
          </>
        )}
      </div>

      {/* Prior rounds summary */}
      {[1, 2, 3, 4].filter((r) => r < round && allPicks.some(p => p.round_number === r)).map((r) => {
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
              // For R1/R2, mark the highest score as "not counted"
              const sortedScores = [...roundScores].sort((a, b) => (a ?? 999) - (b ?? 999));
              const notCounted = r <= 2 && roundScores.indexOf(rs) !== -1 && i === roundScores.indexOf(Math.max(...roundScores.map((s) => s ?? -999)));
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
  tournament, allPicks, scores, playerCount,
}: {
  tournament: Tournament; allPicks: Pick[]; scores: GolferScore[]; playerCount: number;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const scoreMap = Object.fromEntries(scores.map((s) => [s.name, s]));
  const purse = playerCount * 50;

  // Build standings
  const userMap: Record<string, string> = {};
  allPicks.forEach((p) => { userMap[p.user_id] = p.username; });

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
  }).sort((a, b) => a.total - b.total);

  if (!standings.length) {
    return (
      <div style={card}>
        <p style={{ color: "var(--cream-dim)", fontStyle: "italic", textAlign: "center", padding: 24 }}>
          Standings will appear after the first tee time {isTournamentStarted(tournament) ? "today" : "Thursday"}.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Purse */}
      <div style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 12, color: "var(--cream-dim)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>Total Purse</div>
          <div style={{ fontSize: 28, color: "var(--accent)", fontFamily: "Playfair Display, serif" }}>${purse.toLocaleString()}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12, color: "var(--cream-dim)", marginBottom: 4 }}>{playerCount} players × $50</div>
          <div style={{ fontSize: 13, color: "var(--cream-dim)", fontStyle: "italic" }}>Lowest combined score wins</div>
        </div>
      </div>

      {/* Standings */}
      {standings.map((u, i) => {
        const isOpen = expanded === u.uid;
        const roundsPlayed = Object.keys(u.rounds).length;

        return (
          <div key={u.uid} style={{ ...card, padding: 0, overflow: "hidden" }}>
            {/* Main row */}
            <button
              onClick={() => setExpanded(isOpen ? null : u.uid)}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "14px 18px",
                background: i === 0 ? "rgba(201,168,76,0.06)" : "transparent",
                border: "none", cursor: "pointer", textAlign: "left",
              }}
            >
              {/* Rank */}
              <div style={{
                width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: i === 0 ? "var(--accent)" : "rgba(255,255,255,0.08)",
                color: i === 0 ? "var(--bg)" : "var(--cream-dim)",
                fontSize: 13, fontWeight: 700,
              }}>{i + 1}</div>

              <PlayerAvatar username={u.username} size={36} />

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, color: i === 0 ? "var(--accent)" : "var(--cream)", fontFamily: "Playfair Display, serif" }}>{u.username}</div>
                {/* Round-by-round score pills */}
                <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" as const }}>
                  {Object.entries(u.rounds).map(([r, rd]) => (
                    <span key={r} style={{
                      fontSize: 11, padding: "1px 7px", borderRadius: 8,
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: scoreColor(rd.score), fontFamily: "monospace",
                    }}>
                      R{r} {fmtScore(rd.score)}
                    </span>
                  ))}
                </div>
              </div>

              {/* Scores block */}
              <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "flex-end", gap: 2, flexShrink: 0 }}>
                {/* Current round score */}
                {roundsPlayed > 0 && (() => {
                  const latestRound = Math.max(...Object.keys(u.rounds).map(Number));
                  const latestScore = u.rounds[latestRound]?.score;
                  return (
                    <div style={{ fontSize: 12, color: "var(--cream-dim)" }}>
                      R{latestRound}: <span style={{ color: scoreColor(latestScore), fontFamily: "monospace" }}>{fmtScore(latestScore)}</span>
                    </div>
                  );
                })()}
                {/* Cumulative total */}
                <div style={{ fontSize: 22, fontFamily: "monospace", color: scoreColor(u.total), fontWeight: 700, lineHeight: 1 }}>
                  {fmtScore(u.total)}
                </div>
                <div style={{ fontSize: 10, color: "var(--cream-dim)", letterSpacing: "0.06em" }}>TOTAL</div>
              </div>

              <div style={{ fontSize: 12, color: "var(--cream-dim)" }}>{isOpen ? "▲" : "▼"}</div>
            </button>

            {/* Expanded round breakdown */}
            {isOpen && (
              <div style={{ borderTop: "1px solid var(--card-border)", padding: "14px 18px 18px" }}>
                {Object.entries(u.rounds).map(([r, rd]) => {
                  const rNum = parseInt(r);
                  const roundScores = rd.picks.map((g) => getRoundScore(scoreMap[g], rNum));

                  return (
                    <div key={r} style={{ marginBottom: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 13, color: "var(--accent)", fontWeight: 600 }}>
                          {ROUND_LABELS[rNum]} {rNum <= 2 ? "(best 2)" : "(all 3)"}
                        </span>
                        <span style={{ fontFamily: "monospace", fontSize: 14, color: scoreColor(rd.score) }}>{fmtScore(rd.score)}</span>
                      </div>
                      {rd.picks.map((g, pi) => {
                        const rs = roundScores[pi];
                        const maxScore = Math.max(...roundScores.map((s) => s ?? -999));
                        const notCounted = rNum <= 2 && rs === maxScore && rd.picks.length === 3;
                        return (
                          <div key={g} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 8px", background: "rgba(255,255,255,0.02)", borderRadius: 4, marginBottom: 3 }}>
                            <span style={{ color: notCounted ? "var(--cream-dim)" : "var(--cream)", textDecoration: notCounted ? "line-through" : "none" }}>{g}</span>
                            <span style={{ fontFamily: "monospace", color: scoreColor(rs), opacity: notCounted ? 0.5 : 1 }}>{fmtScore(rs)}</span>
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

      <p style={{ textAlign: "center", fontSize: 13, color: "var(--cream-dim)", fontStyle: "italic", marginTop: 8 }}>
        {standings.length > 1 && standings[0].total === standings[1].total ? "⚖️ Tied — purse splits equally" : ""}
      </p>
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
              const maxScore = Math.max(...u.roundScores.map((s) => s ?? -999));
              return (
                <div key={u.username} style={{ marginBottom: 18 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <PlayerAvatar username={u.username} size={28} />
                      <span style={{ fontSize: 15, color: i === 0 ? "var(--accent)" : "var(--cream)", fontFamily: "Playfair Display, serif" }}>
                        {i === 0 && "🏅 "}{u.username}
                      </span>
                    </div>
                    <span style={{ fontFamily: "monospace", fontSize: 16, color: scoreColor(u.score) }}>{fmtScore(u.score)}</span>
                  </div>
                  {u.picks.map((g, pi) => {
                    const rs = u.roundScores[pi];
                    const sc = scoreMap[g];
                    const notCounted = r <= 2 && rs === maxScore && u.picks.length === 3;
                    return (
                      <div key={g} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 6, marginBottom: 4, fontSize: 14 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {sc?.headshot && (
                            // eslint-disable-next-line @next/next/no-img-element
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
  const [odds, setOdds] = useState<Record<string, string>>({});
  const [playerCount, setPlayerCount] = useState(0);
  const tournament = getActiveTournament();
  const th = tournament.theme;

  useEffect(() => {
    const t = localStorage.getItem("mp_token");
    const u = localStorage.getItem("mp_username");
    const id = localStorage.getItem("mp_userId");
    if (t && u && id) { setToken(t); setUsername(u); setUserId(id); }
    setHydrated(true);
  }, []);

  const fetchData = useCallback(async (t: string) => {
    const tid = tournament.id;
    const [picksRes, scoresRes, oddsRes, playersRes] = await Promise.all([
      fetch(`/api/picks?tournament=${tid}`, { headers: { Authorization: `Bearer ${t}` } }),
      fetch(`/api/scores?tournament=${tid}`),
      fetch(`/api/odds?tournament=${tid}`),
      fetch("/api/players", { headers: { Authorization: `Bearer ${t}` } }),
    ]);
    if (picksRes.ok) setPicks((await picksRes.json()).picks ?? []);
    if (scoresRes.ok) setScores((await scoresRes.json()).scores ?? []);
    if (oddsRes.ok) setOdds((await oddsRes.json()).odds ?? {});
    if (playersRes.ok) setPlayerCount((await playersRes.json()).count ?? 0);
  }, [tournament.id]);

  useEffect(() => { if (token) fetchData(token); }, [token, fetchData]);
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => fetchData(token), 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [token, fetchData]);

  function handleLogin(t: string, u: string) {
    const payload = JSON.parse(atob(t.split(".")[1]));
    localStorage.setItem("mp_token", t);
    localStorage.setItem("mp_username", u);
    localStorage.setItem("mp_userId", payload.userId);
    setToken(t); setUsername(u); setUserId(payload.userId);
  }

  function handleLogout() {
    ["mp_token", "mp_username", "mp_userId"].forEach((k) => localStorage.removeItem(k));
    setToken(null); setUsername(null); setUserId(null);
    setPicks([]); setScores([]);
  }

  if (!hydrated) return null;
  if (!token || !username || !userId) return <AuthScreen tournament={tournament} onLogin={handleLogin} />;

  return (
    <div style={{ minHeight: "100vh", background: th.bg, color: th.cream, fontFamily: "EB Garamond, serif", paddingBottom: 80, ...themeVars(tournament) }}>
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
          <span style={{ fontSize: 14, color: th.creamDim, fontStyle: "italic" }}>{username}</span>
          <button onClick={handleLogout} style={{ background: "transparent", border: `1px solid ${th.cardBorder}`, color: th.creamDim, padding: "6px 14px", borderRadius: 6, fontSize: 13, cursor: "pointer" }}>
            Sign out
          </button>
        </div>
      </div>

      {/* Champion banner */}
      <CourseHero tournament={tournament} />
      <ChampionBanner tournament={tournament} />

      {/* Tab nav */}
      <div style={{ background: th.bgDark, borderBottom: `1px solid ${th.cardBorder}`, padding: "0 24px", display: "flex", position: "sticky", top: 73, zIndex: 40 }}>
        {(["picks", "leaderboard", "history", "course"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "13px 22px", fontSize: 15, background: "transparent", border: "none",
            borderBottom: tab === t ? `2px solid ${th.accent}` : "2px solid transparent",
            color: tab === t ? th.accent : th.creamDim,
            cursor: "pointer", fontFamily: "Playfair Display, serif",
            fontWeight: tab === t ? 600 : 400, transition: "all 0.2s",
          }}>
            {t === "picks" ? "My Picks" : t === "leaderboard" ? "Leaderboard" : t === "history" ? "History" : "Course Guide"}
          </button>
        ))}
      </div>

      {/* Content */}
      <main style={{ maxWidth: 700, margin: "0 auto", padding: "28px 20px" }}>
        {tab === "picks" && token && userId && (
          <MyPicksTab token={token} userId={userId} tournament={tournament} allPicks={picks} scores={scores} odds={odds} onPicksChanged={() => fetchData(token)} />
        )}
        {tab === "leaderboard" && (
          <LeaderboardTab tournament={tournament} allPicks={picks} scores={scores} playerCount={playerCount} />
        )}
        {tab === "history" && (
          <HistoryTab tournament={tournament} allPicks={picks} scores={scores} />
        )}
        {tab === "course" && (
          <CourseTab tournament={tournament} />
        )}
      </main>
    </div>
  );
}
