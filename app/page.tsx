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
type Tab = "picks" | "leaderboard" | "history";

// ─── Utilities ────────────────────────────────────────────────────────────────
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

// ─── Player Stats Tooltip ─────────────────────────────────────────────────────
function StatsTooltip({ espnId, visible }: { espnId: string; visible: boolean }) {
  const [stats, setStats] = useState<Record<string, string> | null>(null);
  const fetched = useRef(false);

  useEffect(() => {
    if (!visible || fetched.current || !espnId) return;
    fetched.current = true;
    fetch(`/api/stats?espnId=${espnId}`)
      .then((r) => r.json())
      .then((d) => setStats(d.stats))
      .catch(() => null);
  }, [visible, espnId]);

  if (!visible) return null;

  return (
    <div style={{
      position: "absolute", bottom: "110%", left: "50%", transform: "translateX(-50%)",
      background: "var(--bg-dark)", border: "1px solid var(--card-border)",
      borderRadius: 8, padding: "10px 14px", zIndex: 100, minWidth: 180,
      boxShadow: "0 8px 24px rgba(0,0,0,0.5)", pointerEvents: "none",
    }}>
      {!stats ? (
        <div style={{ fontSize: 13, color: "var(--cream-dim)", fontStyle: "italic" }}>Loading stats…</div>
      ) : Object.keys(stats).length === 0 ? (
        <div style={{ fontSize: 13, color: "var(--cream-dim)", fontStyle: "italic" }}>Stats unavailable</div>
      ) : (
        Object.entries(stats).map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 4, fontSize: 13 }}>
            <span style={{ color: "var(--cream-dim)" }}>{k}</span>
            <span style={{ color: "var(--cream)", fontWeight: 500 }}>{v}</span>
          </div>
        ))
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
            <img src={headshot} alt={name} width={36} height={36} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
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
        <StatsTooltip espnId={espnId} visible={hover} />
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
          <div style={{ fontSize: 52, marginBottom: 10 }}>{th.emoji}</div>
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
function CourseHero({ tournament }: { tournament: Tournament }) {
  const photos = tournament.theme.photos;
  const [idx, setIdx] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (photos.length <= 1) return;
    const interval = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setIdx((i) => (i + 1) % photos.length);
        setFading(false);
      }, 600);
    }, 6000);
    return () => clearInterval(interval);
  }, [photos.length]);

  const photo = photos[idx];

  return (
    <div style={{ position: "relative", width: "100%", height: 220, overflow: "hidden" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.url}
        alt={photo.caption}
        style={{
          width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 40%",
          transition: "opacity 0.6s ease", opacity: fading ? 0 : 1,
          display: "block",
        }}
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
      {/* Dark gradient overlay — bottom to top for text legibility */}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.15) 100%)",
      }} />
      {/* Caption */}
      <div style={{
        position: "absolute", bottom: 12, left: 16, right: 16,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", letterSpacing: "0.06em", fontStyle: "italic" }}>
          {photo.caption}
        </span>
        {/* Dot indicators for Augusta rotation */}
        {photos.length > 1 && (
          <div style={{ display: "flex", gap: 5 }}>
            {photos.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                style={{
                  width: 6, height: 6, borderRadius: "50%", border: "none", padding: 0, cursor: "pointer",
                  background: i === idx ? "var(--accent)" : "rgba(255,255,255,0.4)",
                  transition: "background 0.3s",
                }}
              />
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

  // Build sorted golfer list: available first, then burned, then cut
  const sortedGolfers = [...scores].sort((a, b) => {
    const aAvail = !burnedSet.has(a.name) && a.status === "active";
    const bAvail = !burnedSet.has(b.name) && b.status === "active";
    if (aAvail && !bAvail) return -1;
    if (!aAvail && bAvail) return 1;
    return a.totalScore - b.totalScore;
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
                  odds={odds[gs.name] ?? ""}
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
      {[1, 2, 3, 4].filter((r) => r < round && isRoundRevealed(tournament, r)).map((r) => {
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
      if (!isRoundRevealed(tournament, r)) continue;
      const rPicks = allPicks.filter((p) => p.user_id === uid && p.round_number === r).map((p) => p.golfer);
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

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, color: i === 0 ? "var(--accent)" : "var(--cream)", fontFamily: "Playfair Display, serif" }}>{u.username}</div>
                <div style={{ fontSize: 12, color: "var(--cream-dim)", marginTop: 2 }}>{roundsPlayed} round{roundsPlayed !== 1 ? "s" : ""} counted</div>
              </div>

              <div style={{ fontSize: 22, fontFamily: "monospace", color: scoreColor(u.total), fontWeight: 600 }}>{fmtScore(u.total)}</div>
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
  const revealedRounds = [1, 2, 3, 4].filter((r) => isRoundRevealed(tournament, r));

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
                    <span style={{ fontSize: 15, color: i === 0 ? "var(--accent)" : "var(--cream)", fontFamily: "Playfair Display, serif" }}>
                      {i === 0 && "🏅 "}{u.username}
                    </span>
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
      {/* Header */}
      <div style={{ background: th.bgDark, borderBottom: `1px solid ${th.cardBorder}`, padding: "18px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 20 }}>{th.emoji}</span>
            <h1 style={{ fontSize: 20, color: th.accent, fontFamily: "Playfair Display, serif", lineHeight: 1 }}>Major Pick&apos;em</h1>
          </div>
          <div style={{ fontSize: 11, color: th.creamDim, letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 3 }}>{tournament.shortName} · {tournament.location}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
        {(["picks", "leaderboard", "history"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "13px 22px", fontSize: 15, background: "transparent", border: "none",
            borderBottom: tab === t ? `2px solid ${th.accent}` : "2px solid transparent",
            color: tab === t ? th.accent : th.creamDim,
            cursor: "pointer", fontFamily: "Playfair Display, serif",
            fontWeight: tab === t ? 600 : 400, transition: "all 0.2s",
          }}>
            {t === "picks" ? "My Picks" : t === "leaderboard" ? "Leaderboard" : "History"}
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
      </main>
    </div>
  );
}
