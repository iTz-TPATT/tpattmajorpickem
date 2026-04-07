"use client";

import React, { useState, useEffect, useCallback } from "react";
import { GOLFERS } from "@/lib/golfers";
import { ROUND_LABELS, ROUND_REVEAL_TIMES } from "@/lib/rounds";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Pick { username: string; user_id: string; round_number: number; golfer: string; }
interface GolferScore { golfer: string; r1: number|null; r2: number|null; r3: number|null; r4: number|null; total_score: number; position: string|null; status: string; }
type Tab = "picks" | "leaderboard" | "history";

// ─── Round helpers (client-safe, no Node imports) ─────────────────────────────
const REVEAL_TIMES: Record<number, string> = ROUND_REVEAL_TIMES;

function isRevealed(round: number) { return new Date() >= new Date(REVEAL_TIMES[round]); }
function getCurrentRound() {
  for (let r = 1; r <= 4; r++) { if (new Date() < new Date(REVEAL_TIMES[r])) return r; }
  return 4;
}
function fmtCountdown(to: Date) {
  const diff = to.getTime() - Date.now();
  if (diff <= 0) return "Picks revealed";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  if (h > 24) { const d = Math.floor(h / 24); return `${d}d ${h % 24}h`; }
  return `${h}h ${m}m ${s}s`;
}
function fmtScore(s: number | null) {
  if (s === null || s === undefined) return "—";
  if (s === 0) return "E";
  return s > 0 ? `+${s}` : `${s}`;
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  page: { minHeight: "100vh", background: "var(--green-deep)", padding: "0 0 80px" } as React.CSSProperties,
  header: {
    background: "linear-gradient(180deg, #071510 0%, #0f2318 100%)",
    borderBottom: "1px solid var(--card-border)",
    padding: "24px 24px 20px",
    display: "flex", alignItems: "center", justifyContent: "space-between",
    position: "sticky" as const, top: 0, zIndex: 50,
  },
  logo: { display: "flex", flexDirection: "column" as const, gap: 2 },
  logoTitle: { fontSize: 22, color: "var(--gold)", lineHeight: 1.1 },
  logoSub: { fontSize: 13, color: "var(--cream-dim)", letterSpacing: "0.12em", textTransform: "uppercase" as const, fontFamily: "EB Garamond, serif" },
  userInfo: { display: "flex", alignItems: "center", gap: 12 },
  userName: { fontSize: 15, color: "var(--cream-dim)", fontStyle: "italic" },
  logoutBtn: {
    background: "transparent", border: "1px solid var(--card-border)",
    color: "var(--cream-dim)", padding: "6px 14px", borderRadius: 6,
    fontSize: 13, cursor: "pointer", transition: "all 0.2s",
  },
  tabs: {
    display: "flex", gap: 0,
    borderBottom: "1px solid var(--card-border)",
    background: "var(--green-dark)",
    padding: "0 24px",
    position: "sticky" as const, top: 73, zIndex: 40,
  },
  tab: (active: boolean): React.CSSProperties => ({
    padding: "14px 24px",
    fontSize: 15,
    background: "transparent",
    border: "none",
    borderBottom: active ? "2px solid var(--gold)" : "2px solid transparent",
    color: active ? "var(--gold)" : "var(--cream-dim)",
    cursor: "pointer",
    transition: "all 0.2s",
    fontFamily: "Playfair Display, serif",
    fontWeight: active ? 600 : 400,
    letterSpacing: "0.02em",
  }),
  content: { maxWidth: 680, margin: "0 auto", padding: "32px 24px" },
  card: {
    background: "var(--card-bg)",
    border: "1px solid var(--card-border)",
    borderRadius: "var(--radius)",
    padding: "24px",
    marginBottom: 20,
  } as React.CSSProperties,
  cardTitle: { fontSize: 18, color: "var(--gold)", marginBottom: 16 },
  golferGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
  golferBtn: (selected: boolean, disabled: boolean): React.CSSProperties => ({
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "10px 14px",
    background: selected ? "rgba(201,168,76,0.15)" : "rgba(255,255,255,0.03)",
    border: `1px solid ${selected ? "var(--gold)" : "rgba(255,255,255,0.08)"}`,
    borderRadius: 8,
    color: selected ? "var(--gold)" : disabled ? "var(--cream-dim)" : "var(--cream)",
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 14,
    transition: "all 0.15s",
    opacity: disabled && !selected ? 0.5 : 1,
  }),
  submitBtn: {
    width: "100%", padding: "14px",
    background: "var(--gold)", color: "var(--green-deep)",
    border: "none", borderRadius: 8, fontSize: 16,
    fontFamily: "Playfair Display, serif", fontWeight: 600,
    cursor: "pointer", marginTop: 16, transition: "opacity 0.2s",
  } as React.CSSProperties,
  pill: (color: string): React.CSSProperties => ({
    display: "inline-block", padding: "2px 10px",
    borderRadius: 20, fontSize: 12,
    background: color === "gold" ? "rgba(201,168,76,0.15)" : "rgba(255,255,255,0.06)",
    color: color === "gold" ? "var(--gold)" : "var(--cream-dim)",
    border: `1px solid ${color === "gold" ? "rgba(201,168,76,0.3)" : "rgba(255,255,255,0.1)"}`,
  }),
  divider: { height: 1, background: "var(--card-border)", margin: "16px 0" } as React.CSSProperties,
  score: (n: number | null): React.CSSProperties => ({
    fontFamily: "monospace", fontSize: 14,
    color: n === null ? "var(--cream-dim)" : n < 0 ? "#5dba7e" : n > 0 ? "var(--red)" : "var(--cream)",
  }),
  lbRow: (rank: number): React.CSSProperties => ({
    display: "flex", alignItems: "center", gap: 16,
    padding: "14px 18px",
    background: rank === 1 ? "rgba(201,168,76,0.08)" : "rgba(255,255,255,0.02)",
    border: `1px solid ${rank === 1 ? "rgba(201,168,76,0.25)" : "rgba(255,255,255,0.06)"}`,
    borderRadius: 8, marginBottom: 8,
  }),
  lbRank: (rank: number): React.CSSProperties => ({
    width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
    background: rank === 1 ? "var(--gold)" : "rgba(255,255,255,0.08)",
    color: rank === 1 ? "var(--green-deep)" : "var(--cream-dim)",
    borderRadius: "50%", fontSize: 13, fontWeight: 700, flexShrink: 0,
  }),
  errorBox: {
    background: "rgba(192,57,43,0.12)", border: "1px solid rgba(192,57,43,0.3)",
    borderRadius: 8, padding: "12px 16px", color: "#e07b6f", marginBottom: 16, fontSize: 14,
  } as React.CSSProperties,
  successBox: {
    background: "rgba(93,186,126,0.12)", border: "1px solid rgba(93,186,126,0.3)",
    borderRadius: 8, padding: "12px 16px", color: "#5dba7e", marginBottom: 16, fontSize: 14,
  } as React.CSSProperties,
  countdownBadge: {
    display: "inline-flex", alignItems: "center", gap: 6,
    background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.25)",
    borderRadius: 6, padding: "6px 12px", fontSize: 13, color: "var(--gold)", marginBottom: 16,
  } as React.CSSProperties,
};

// ─── Shared input style ───────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 14px",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid var(--card-border)",
  borderRadius: 8, color: "var(--cream)", fontSize: 15, outline: "none",
};

// ─── Login Screen ─────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }: { onLogin: (token: string, username: string) => void }) {
  const [mode, setMode] = useState<"login" | "register" | "reset">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  function switchMode(m: "login" | "register" | "reset") {
    setMode(m); setError(""); setSuccess("");
    setUsername(""); setPassword(""); setConfirmPassword("");
    setInviteCode(""); setResetCode("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSuccess("");

    if (mode === "register") {
      if (password !== confirmPassword) { setError("Passwords don't match"); return; }
      if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    }
    if (mode === "reset") {
      if (password !== confirmPassword) { setError("Passwords don't match"); return; }
      if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    }

    setLoading(true);
    try {
      let endpoint = "/api/auth";
      let body: Record<string, string> = { username: username.trim(), password };

      if (mode === "register") {
        endpoint = "/api/register";
        body = { username: username.trim(), password, inviteCode: inviteCode.trim() };
      } else if (mode === "reset") {
        endpoint = "/api/reset-password";
        body = { username: username.trim(), newPassword: password, resetCode: resetCode.trim() };
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Something went wrong"); return; }
      onLogin(data.token, data.username);
    } catch { setError("Network error — please try again"); }
    finally { setLoading(false); }
  }

  const subtitles: Record<typeof mode, string> = {
    login: "Welcome back — sign in to submit your picks",
    register: "New here? Create your account below",
    reset: "Enter your name, a new password, and the reset code from the commissioner",
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--green-deep)", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>⛳</div>
          <h1 style={{ fontSize: 28, color: "var(--gold)", marginBottom: 6 }}>Major Pick&apos;em</h1>
          <p style={{ color: "var(--cream-dim)", fontSize: 14, letterSpacing: "0.1em", textTransform: "uppercase" }}>Masters 2026</p>
        </div>

        {/* Mode toggle — Sign In / Create Account */}
        {mode !== "reset" && (
          <div style={{ display: "flex", background: "rgba(255,255,255,0.04)", border: "1px solid var(--card-border)", borderRadius: 8, padding: 4, marginBottom: 20 }}>
            {(["login", "register"] as const).map(m => (
              <button key={m} onClick={() => switchMode(m)} style={{
                flex: 1, padding: "9px 0", border: "none", borderRadius: 6,
                background: mode === m ? "var(--gold)" : "transparent",
                color: mode === m ? "var(--green-deep)" : "var(--cream-dim)",
                fontSize: 14, fontFamily: "Playfair Display, serif",
                fontWeight: mode === m ? 600 : 400, cursor: "pointer", transition: "all 0.2s",
              }}>
                {m === "login" ? "Sign In" : "Create Account"}
              </button>
            ))}
          </div>
        )}

        {/* Reset mode back button */}
        {mode === "reset" && (
          <button onClick={() => switchMode("login")} style={{ background: "none", border: "none", color: "var(--cream-dim)", cursor: "pointer", fontSize: 14, marginBottom: 16, padding: 0 }}>
            ← Back to sign in
          </button>
        )}

        <div style={{ ...S.card, padding: 28 }}>
          <h2 style={{ fontSize: 15, color: "var(--cream-dim)", marginBottom: 24, fontWeight: 400, fontStyle: "italic" }}>
            {subtitles[mode]}
          </h2>

          {error && <div style={S.errorBox}>{error}</div>}
          {success && <div style={S.successBox}>{success}</div>}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, color: "var(--cream-dim)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Name</label>
              <input value={username} onChange={e => setUsername(e.target.value)} style={inputStyle} placeholder="Your first name" autoComplete="username" />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, color: "var(--cream-dim)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
                {mode === "reset" ? "New Password" : "Password"}
              </label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} placeholder="••••••••" autoComplete={mode === "login" ? "current-password" : "new-password"} />
            </div>

            {(mode === "register" || mode === "reset") && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 12, color: "var(--cream-dim)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Confirm Password</label>
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} style={inputStyle} placeholder="••••••••" autoComplete="new-password" />
              </div>
            )}

            {mode === "register" && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 12, color: "var(--cream-dim)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Invite Code</label>
                <input value={inviteCode} onChange={e => setInviteCode(e.target.value)} style={inputStyle} placeholder="Get this from the group chat" />
              </div>
            )}

            {mode === "reset" && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 12, color: "var(--cream-dim)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Reset Code</label>
                <input value={resetCode} onChange={e => setResetCode(e.target.value)} style={inputStyle} placeholder="Get this from Trenton" />
              </div>
            )}

            <div style={{ marginTop: 8, marginBottom: 0 }} />

            <button type="submit" disabled={loading} style={{ ...S.submitBtn, opacity: loading ? 0.7 : 1 }}>
              {loading
                ? "Please wait…"
                : mode === "login" ? "Sign In"
                : mode === "register" ? "Create Account"
                : "Reset Password"}
            </button>
          </form>
        </div>

        {/* Forgot password link */}
        {mode === "login" && (
          <p style={{ textAlign: "center", marginTop: 16 }}>
            <button onClick={() => switchMode("reset")} style={{ background: "none", border: "none", color: "var(--cream-dim)", cursor: "pointer", fontSize: 13, fontStyle: "italic", textDecoration: "underline" }}>
              Forgot your password?
            </button>
          </p>
        )}
      </div>
    </div>
  );
}

// ─── My Picks Tab ─────────────────────────────────────────────────────────────
function MyPicksTab({ token, userId, allPicks, scores, onPicksChanged }: {
  token: string; userId: string; allPicks: Pick[];
  scores: GolferScore[]; onPicksChanged: () => void;
}) {
  const round = getCurrentRound();
  const revealed = isRevealed(round);
  const revealDate = new Date(REVEAL_TIMES[round]);

  const myPicksThisRound = allPicks.filter(p => p.user_id === userId && p.round_number === round).map(p => p.golfer);
  const [selected, setSelected] = useState<string[]>(myPicksThisRound);
  const [saved, setSaved] = useState(myPicksThisRound.length === 3);
  const [countdown, setCountdown] = useState(fmtCountdown(revealDate));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const existing = allPicks.filter(p => p.user_id === userId && p.round_number === round).map(p => p.golfer);
    setSelected(existing);
    setSaved(existing.length === 3);
  }, [allPicks, userId, round]);

  useEffect(() => {
    const t = setInterval(() => setCountdown(fmtCountdown(revealDate)), 1000);
    return () => clearInterval(t);
  }, [revealDate]);

  function toggle(g: string) {
    if (revealed) return;
    if (selected.includes(g)) { setSelected(selected.filter(x => x !== g)); setSaved(false); return; }
    if (selected.length >= 3) return;
    setSelected([...selected, g]); setSaved(false);
  }

  async function submit() {
    if (selected.length !== 3) { setError("Pick exactly 3 golfers"); return; }
    setSubmitting(true); setError(""); setSuccess("");
    try {
      const res = await fetch("/api/picks", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ round, golfers: selected }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setSaved(true); setSuccess("Picks saved!"); onPicksChanged();
    } catch { setError("Network error"); }
    finally { setSubmitting(false); }
  }

  const scoreMap = Object.fromEntries(scores.map(s => [s.golfer, s]));

  return (
    <div>
      <div style={S.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <h2 style={S.cardTitle}>{ROUND_LABELS[round]}</h2>
          <span style={S.pill(revealed ? "dim" : "gold")}>{revealed ? "Locked" : "Open"}</span>
        </div>

        {!revealed && (
          <div style={S.countdownBadge}>
            <span>🔒</span> Picks lock in {countdown}
          </div>
        )}

        {/* Current picks summary */}
        {selected.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: "var(--cream-dim)", marginBottom: 8, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              {revealed ? "Your picks" : `Your picks (${selected.length}/3)`}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 8 }}>
              {selected.map(g => {
                const sc = scoreMap[g];
                return (
                  <div key={g} style={{ background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.3)", borderRadius: 20, padding: "5px 14px", display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 14, color: "var(--gold)" }}>{g}</span>
                    {revealed && sc && <span style={S.score(sc.total_score)}>{fmtScore(sc.total_score)}</span>}
                    {!revealed && <button onClick={() => toggle(g)} style={{ background: "none", border: "none", color: "var(--cream-dim)", cursor: "pointer", padding: 0, fontSize: 14 }}>✕</button>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {error && <div style={S.errorBox}>{error}</div>}
        {success && <div style={S.successBox}>✓ {success}</div>}

        {!revealed && (
          <>
            <div style={S.divider} />
            <p style={{ fontSize: 13, color: "var(--cream-dim)", marginBottom: 14 }}>Select 3 golfers. Lower combined score wins.</p>
            <div style={S.golferGrid}>
              {GOLFERS.map(g => {
                const sel = selected.includes(g);
                const dis = !sel && selected.length >= 3;
                const sc = scoreMap[g];
                return (
                  <button key={g} onClick={() => toggle(g)} disabled={dis} style={S.golferBtn(sel, dis)}>
                    <span style={{ fontSize: 14 }}>{g}</span>
                    <span style={{ ...S.score(sc?.total_score ?? null), fontSize: 13 }}>{sc ? fmtScore(sc.total_score) : ""}</span>
                  </button>
                );
              })}
            </div>

            <button onClick={submit} disabled={selected.length !== 3 || submitting}
              style={{ ...S.submitBtn, opacity: selected.length !== 3 || submitting ? 0.5 : 1 }}>
              {submitting ? "Saving…" : saved ? "Update Picks" : "Lock In Picks"}
            </button>
          </>
        )}
      </div>

      {/* Previous rounds — your own picks */}
      {[1, 2, 3, 4].filter(r => r < round).map(r => {
        const myPicks = allPicks.filter(p => p.user_id === userId && p.round_number === r).map(p => p.golfer);
        if (myPicks.length === 0) return null;
        const roundScore = myPicks.reduce((sum, g) => sum + (scoreMap[g]?.total_score ?? 0), 0);
        return (
          <div key={r} style={{ ...S.card, opacity: 0.85 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <h3 style={{ ...S.cardTitle, fontSize: 15, marginBottom: 0 }}>{ROUND_LABELS[r]}</h3>
              <span style={{ fontFamily: "monospace", color: roundScore < 0 ? "#5dba7e" : roundScore > 0 ? "var(--red)" : "var(--cream)", fontSize: 15 }}>{fmtScore(roundScore)}</span>
            </div>
            {myPicks.map(g => {
              const sc = scoreMap[g];
              return (
                <div key={g} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 14 }}>
                  <span>{g}</span>
                  <span style={S.score(sc?.total_score ?? null)}>{sc ? fmtScore(sc.total_score) : "—"}</span>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ─── Leaderboard Tab ──────────────────────────────────────────────────────────
function LeaderboardTab({ allPicks, scores }: { allPicks: Pick[]; scores: GolferScore[] }) {
  const scoreMap = Object.fromEntries(scores.map(s => [s.golfer, s.total_score]));

  // Get all unique users from visible picks
  const userMap: Record<string, { username: string; userId: string }> = {};
  allPicks.forEach(p => { userMap[p.user_id] = { username: p.username, userId: p.user_id }; });

  // For each user, sum scores across all revealed rounds
  const standings = Object.values(userMap).map(u => {
    let total = 0;
    let rounds = 0;
    for (let r = 1; r <= 4; r++) {
      if (!isRevealed(r)) continue;
      const rPicks = allPicks.filter(p => p.user_id === u.userId && p.round_number === r);
      if (rPicks.length === 0) continue;
      rounds++;
      total += rPicks.reduce((sum, p) => sum + (scoreMap[p.golfer] ?? 0), 0);
    }
    return { ...u, total, rounds };
  }).sort((a, b) => a.total - b.total);

  if (standings.length === 0) {
    return (
      <div style={S.card}>
        <p style={{ color: "var(--cream-dim)", fontStyle: "italic", textAlign: "center", padding: 24 }}>
          Picks will appear here after the first tee time each day.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div style={S.card}>
        <h2 style={S.cardTitle}>Overall Standings</h2>
        <p style={{ fontSize: 13, color: "var(--cream-dim)", marginBottom: 20, fontStyle: "italic" }}>Combined score across all revealed rounds</p>
        {standings.map((u, i) => (
          <div key={u.userId} style={S.lbRow(i + 1)}>
            <div style={S.lbRank(i + 1)}>{i + 1}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, color: i === 0 ? "var(--gold)" : "var(--cream)" }}>{u.username}</div>
              <div style={{ fontSize: 12, color: "var(--cream-dim)" }}>{u.rounds} round{u.rounds !== 1 ? "s" : ""} counted</div>
            </div>
            <div style={{ fontFamily: "monospace", fontSize: 20, color: u.total < 0 ? "#5dba7e" : u.total > 0 ? "var(--red)" : "var(--cream)", fontWeight: 600 }}>
              {fmtScore(u.total)}
            </div>
          </div>
        ))}
      </div>

      {/* Per-round breakdown */}
      {[1, 2, 3, 4].filter(r => isRevealed(r)).map(r => {
        const roundStandings = Object.values(userMap).map(u => {
          const rPicks = allPicks.filter(p => p.user_id === u.userId && p.round_number === r);
          const score = rPicks.reduce((sum, p) => sum + (scoreMap[p.golfer] ?? 0), 0);
          return { ...u, score, picks: rPicks.map(p => p.golfer) };
        }).sort((a, b) => a.score - b.score);

        return (
          <div key={r} style={{ ...S.card, opacity: 0.9 }}>
            <h3 style={{ ...S.cardTitle, fontSize: 15 }}>{ROUND_LABELS[r]}</h3>
            {roundStandings.map((u, i) => (
              <div key={u.userId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <div>
                  <span style={{ color: i === 0 ? "var(--gold)" : "var(--cream)", fontSize: 15 }}>{u.username}</span>
                  <span style={{ fontSize: 12, color: "var(--cream-dim)", marginLeft: 10 }}>{u.picks.join(", ")}</span>
                </div>
                <span style={{ fontFamily: "monospace", fontSize: 15, color: u.score < 0 ? "#5dba7e" : u.score > 0 ? "var(--red)" : "var(--cream)" }}>{fmtScore(u.score)}</span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ─── History Tab ──────────────────────────────────────────────────────────────
function HistoryTab({ allPicks, scores }: { allPicks: Pick[]; scores: GolferScore[] }) {
  const scoreMap = Object.fromEntries(scores.map(s => [s.golfer, s]));

  const revealedRounds = [1, 2, 3, 4].filter(r => isRevealed(r));

  if (revealedRounds.length === 0) {
    return (
      <div style={S.card}>
        <p style={{ color: "var(--cream-dim)", fontStyle: "italic", textAlign: "center", padding: 24 }}>
          History will appear here after the first tee time Thursday.
        </p>
      </div>
    );
  }

  // Group picks by round then user
  return (
    <div>
      {revealedRounds.map(r => {
        const rPicks = allPicks.filter(p => p.round_number === r);
        // Group by user
        const byUser: Record<string, { username: string; picks: string[] }> = {};
        rPicks.forEach(p => {
          if (!byUser[p.user_id]) byUser[p.user_id] = { username: p.username, picks: [] };
          byUser[p.user_id].picks.push(p.golfer);
        });

        return (
          <div key={r} style={S.card}>
            <h2 style={S.cardTitle}>{ROUND_LABELS[r]}</h2>
            {Object.values(byUser).map(u => {
              const userScore = u.picks.reduce((sum, g) => sum + (scoreMap[g]?.total_score ?? 0), 0);
              return (
                <div key={u.username} style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: 16, color: "var(--cream)" }}>{u.username}</span>
                    <span style={{ fontFamily: "monospace", fontSize: 15, color: userScore < 0 ? "#5dba7e" : userScore > 0 ? "var(--red)" : "var(--cream)" }}>{fmtScore(userScore)}</span>
                  </div>
                  {u.picks.map(g => {
                    const sc = scoreMap[g];
                    return (
                      <div key={g} style={{ display: "flex", justifyContent: "space-between", padding: "6px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 6, marginBottom: 4, fontSize: 14 }}>
                        <span style={{ color: "var(--cream)" }}>{g}</span>
                        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                          {sc?.position && <span style={{ fontSize: 12, color: "var(--cream-dim)" }}>{sc.position}</span>}
                          <span style={S.score(sc?.total_score ?? null)}>{sc ? fmtScore(sc.total_score) : "—"}</span>
                        </div>
                      </div>
                    );
                  })}
                  <div style={S.divider} />
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
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("picks");
  const [picks, setPicks] = useState<Pick[]>([]);
  const [scores, setScores] = useState<GolferScore[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Restore session from localStorage
  useEffect(() => {
    const t = localStorage.getItem("mp_token");
    const u = localStorage.getItem("mp_username");
    const id = localStorage.getItem("mp_userId");
    if (t && u && id) { setToken(t); setUsername(u); setUserId(id); }
    setHydrated(true);
  }, []);

  const fetchData = useCallback(async (t: string) => {
    const [picksRes, scoresRes] = await Promise.all([
      fetch("/api/picks", { headers: { Authorization: `Bearer ${t}` } }),
      fetch("/api/scores"),
    ]);
    if (picksRes.ok) { const d = await picksRes.json(); setPicks(d.picks); }
    if (scoresRes.ok) { const d = await scoresRes.json(); setScores(d.scores); }
  }, []);

  useEffect(() => {
    if (token) fetchData(token);
  }, [token, fetchData]);

  // Refresh data every 2 minutes
  useEffect(() => {
    if (!token) return;
    const t = setInterval(() => fetchData(token), 120_000);
    return () => clearInterval(t);
  }, [token, fetchData]);

  function handleLogin(t: string, u: string) {
    // Decode userId from JWT payload (middle segment)
    const payload = JSON.parse(atob(t.split(".")[1]));
    localStorage.setItem("mp_token", t);
    localStorage.setItem("mp_username", u);
    localStorage.setItem("mp_userId", payload.userId);
    setToken(t); setUsername(u); setUserId(payload.userId);
  }

  function handleLogout() {
    localStorage.removeItem("mp_token");
    localStorage.removeItem("mp_username");
    localStorage.removeItem("mp_userId");
    setToken(null); setUsername(null); setUserId(null);
    setPicks([]); setScores([]);
  }

  if (!hydrated) return null;
  if (!token || !username || !userId) return <LoginScreen onLogin={handleLogin} />;

  return (
    <div style={S.page}>
      <header style={S.header}>
        <div style={S.logo}>
          <h1 style={S.logoTitle}>Major Pick&apos;em</h1>
          <span style={S.logoSub}>Masters 2026 · Augusta National</span>
        </div>
        <div style={S.userInfo}>
          <span style={S.userName}>{username}</span>
          <button onClick={handleLogout} style={S.logoutBtn}>Sign out</button>
        </div>
      </header>

      <nav style={S.tabs}>
        {(["picks", "leaderboard", "history"] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={S.tab(tab === t)}>
            {t === "picks" ? "My Picks" : t === "leaderboard" ? "Leaderboard" : "History"}
          </button>
        ))}
      </nav>

      <main style={S.content}>
        {tab === "picks" && (
          <MyPicksTab token={token} userId={userId} allPicks={picks} scores={scores} onPicksChanged={() => fetchData(token)} />
        )}
        {tab === "leaderboard" && (
          <LeaderboardTab allPicks={picks} scores={scores} />
        )}
        {tab === "history" && (
          <HistoryTab allPicks={picks} scores={scores} />
        )}
      </main>
    </div>
  );
}
