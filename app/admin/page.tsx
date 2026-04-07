"use client";

import React, { useState, useEffect, useCallback } from "react";
import { TOURNAMENTS } from "@/lib/tournaments";

const ADMIN_GOLFERS = [
  "Scottie Scheffler", "Rory McIlroy", "Jon Rahm", "Xander Schauffele",
  "Ludvig Åberg", "Collin Morikawa", "Viktor Hovland", "Tommy Fleetwood",
  "Brooks Koepka", "Justin Thomas", "Patrick Cantlay", "Will Zalatoris",
  "Shane Lowry", "Tony Finau", "Hideki Matsuyama", "Max Homa",
  "Russell Henley", "Adam Scott", "Cameron Smith", "Dustin Johnson",
  "Bryson DeChambeau", "Jordan Spieth", "Matt Fitzpatrick", "Tyrrell Hatton",
  "Robert MacIntyre", "Tom Kim", "Sahith Theegala", "Sungjae Im",
  "Akshay Bhatia", "Min Woo Lee",
];

interface GolferScore {
  name: string; espnId: string; headshot: null;
  totalScore: number; position: string; status: string;
  r1: number | null; r2: number | null; r3: number | null; r4: number | null;
}

interface Overrides {
  roundOverride?: number;
  revealAll?: boolean;
  skipDeadline?: boolean;
  useManualScores?: boolean;
}

// Fixed button styles (No duplicate border property)
const getBtnStyles = (color: string): React.CSSProperties => ({
  padding: "8px 16px", borderRadius: 6, cursor: "pointer", fontSize: 13,
  fontFamily: "monospace", fontWeight: 700,
  background: color === "green" ? "#1a3a1a" : color === "red" ? "#3a1a1a" : color === "yellow" ? "#3a3010" : "#1a1a2a",
  color: color === "green" ? "#5dba7e" : color === "red" ? "#e07b6f" : color === "yellow" ? "#f0c040" : "#8facd4",
  border: `1px solid ${color === "green" ? "#3a6a3a" : color === "red" ? "#6a2a2a" : color === "yellow" ? "#6a5020" : "#2a3a5a"}`,
});

const S: Record<string, React.CSSProperties | ((arg: boolean) => React.CSSProperties)> = {
  page: { minHeight: "100vh", background: "#0a0a0a", color: "#e0e0e0", fontFamily: "monospace", padding: 0 },
  header: { background: "#111", borderBottom: "1px solid #333", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 18, color: "#f0c040", fontFamily: "monospace", fontWeight: 700 },
  badge: { background: "#1a2a1a", border: "1px solid #3a5a3a", color: "#5dba7e", padding: "4px 10px", borderRadius: 4, fontSize: 12 },
  content: { maxWidth: 900, margin: "0 auto", padding: "24px 20px" },
  section: { background: "#111", border: "1px solid #333", borderRadius: 8, padding: 20, marginBottom: 20 },
  sectionTitle: { fontSize: 13, color: "#f0c040", letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: 16, borderBottom: "1px solid #222", paddingBottom: 8 },
  row: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  label: { fontSize: 14, color: "#aaa" },
  toggle: (on: boolean): React.CSSProperties => ({
    width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
    background: on ? "#5dba7e" : "#333", position: "relative", transition: "background 0.2s", flexShrink: 0,
  }),
  toggleKnob: (on: boolean): React.CSSProperties => ({
    position: "absolute", top: 3, left: on ? 23 : 3, width: 18, height: 18,
    borderRadius: "50%", background: "#fff", transition: "left 0.2s",
  }),
  select: {
    background: "#1a1a1a", border: "1px solid #444", color: "#e0e0e0",
    padding: "6px 10px", borderRadius: 6, fontSize: 14, cursor: "pointer",
  },
  scoreInput: {
    width: 60, background: "#1a1a1a", border: "1px solid #444", color: "#e0e0e0",
    padding: "4px 8px", borderRadius: 4, fontSize: 13, fontFamily: "monospace", textAlign: "center" as const,
  },
  info: { fontSize: 12, color: "#666", fontStyle: "italic" as const, marginTop: 4 },
  success: { background: "#1a3a1a", border: "1px solid #3a6a3a", color: "#5dba7e", padding: "10px 14px", borderRadius: 6, fontSize: 13, marginBottom: 16 },
  error: { background: "#3a1a1a", border: "1px solid #6a2a2a", color: "#e07b6f", padding: "10px 14px", borderRadius: 6, fontSize: 13, marginBottom: 16 },
};

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} style={S.toggle(on)}>
      <div style={S.toggleKnob(on)} />
    </button>
  );
}

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState("");
  const [overrides, setOverrides] = useState<Overrides>({});
  const [scores, setScores] = useState<GolferScore[]>([]);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"ok" | "err">("ok");
  const [saving, setSaving] = useState(false);
  const [selectedTournament] = useState("masters");
  const [users, setUsers] = useState<{ id: string; username: string }[]>([]);
  const [proxyUser, setProxyUser] = useState("");
  const [proxyRound, setProxyRound] = useState(1);
  const [proxyPicks, setProxyPicks] = useState<string[]>([]);
  const [proxyMsg, setProxyMsg] = useState("");
  const [proxyMsgType, setProxyMsgType] = useState<"ok"|"err">("ok");

  const showMsg = (m: string, t: "ok" | "err" = "ok") => {
    setMsg(m); setMsgType(t);
    setTimeout(() => setMsg(""), 3000);
  };

  const call = useCallback(async (action: string, extra?: Record<string, unknown>) => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": password },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) { showMsg(data.error ?? "Error", "err"); return false; }
      return true;
    } catch { showMsg("Network error", "err"); return false; }
    finally { setSaving(false); }
  }, [password]);

  async function tryAuth() {
    const res = await fetch("/api/admin", { headers: { "x-admin-password": password } });
    if (res.ok) {
      const data = await res.json();
      setAuthed(true);
      setOverrides(data.overrides ?? {});
      // Fetch user list for proxy picks
      const usersRes = await fetch("/api/admin", { method: "PUT", headers: { "x-admin-password": password } });
      if (usersRes.ok) { const ud = await usersRes.json(); setUsers(ud.users ?? []); }
      // Build scores list — merge existing cache with full golfer list
      const existing: GolferScore[] = data.scores ?? [];
      const existingMap = Object.fromEntries(existing.map((s) => [s.name, s]));
      const fullList: GolferScore[] = ADMIN_GOLFERS.map((name) => existingMap[name] ?? {
        name, espnId: "", headshot: null,
        totalScore: 0, position: "", status: "active",
        r1: null, r2: null, r3: null, r4: null,
      });
      setScores(fullList);
    } else {
      setAuthError("Wrong password");
    }
  }

  async function saveOverrides(next: Overrides) {
    setOverrides(next);
    await call("save_overrides", { overrides: next });
    showMsg("Overrides saved");
  }

  async function saveScores() {
    // Compute totalScore from round scores before saving
    const withTotals = scores.map((s) => ({
      ...s,
      totalScore: (s.r1 ?? 0) + (s.r2 ?? 0) + (s.r3 ?? 0) + (s.r4 ?? 0),
    }));
    const ok = await call("save_scores", { scores: withTotals });
    if (ok) showMsg("Scores saved — leaderboard will update within seconds");
  }

  function updateScore(name: string, field: "r1"|"r2"|"r3"|"r4"|"status", value: string) {
    setScores((prev) => prev.map((s) => {
      if (s.name !== name) return s;
      if (field === "status") return { ...s, status: value };
      const num = value === "" ? null : parseInt(value);
      return { ...s, [field]: isNaN(num as number) ? null : num };
    }));
  }

  function fillRandomScores() {
    setScores((prev) => prev.map((s) => ({
      ...s,
      r1: Math.floor(Math.random() * 11) - 7, // -7 to +3
      r2: overrides.roundOverride && overrides.roundOverride >= 2 ? Math.floor(Math.random() * 11) - 7 : null,
      r3: overrides.roundOverride && overrides.roundOverride >= 3 ? Math.floor(Math.random() * 11) - 7 : null,
      r4: overrides.roundOverride && overrides.roundOverride >= 4 ? Math.floor(Math.random() * 11) - 7 : null,
    })));
    showMsg("Random scores filled — hit Save Scores to apply");
  }


  function toggleProxyPick(g: string) {
    if (proxyPicks.includes(g)) { setProxyPicks(proxyPicks.filter(x => x !== g)); return; }
    if (proxyPicks.length >= 3) return;
    setProxyPicks([...proxyPicks, g]);
  }

  async function submitProxyPicks() {
    if (!proxyUser || proxyPicks.length !== 3) { setProxyMsg("Select a player and exactly 3 golfers"); setProxyMsgType("err"); return; }
    const user = users.find(u => u.id === proxyUser);
    if (!user) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": password },
        body: JSON.stringify({ action: "submit_picks_as_user", userId: user.id, username: user.username, tournament: selectedTournament, round: proxyRound, golfers: proxyPicks }),
      });
      const data = await res.json();
      if (!res.ok) { setProxyMsg(data.error ?? "Error"); setProxyMsgType("err"); }
      else { setProxyMsg(`✓ Picks submitted for ${user.username} — Round ${proxyRound}`); setProxyMsgType("ok"); setProxyPicks([]); }
    } catch { setProxyMsg("Network error"); setProxyMsgType("err"); }
    finally { setSaving(false); setTimeout(() => setProxyMsg(""), 4000); }
  }

  if (!authed) {
    return (
      <div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: "#111", border: "1px solid #333", borderRadius: 8, padding: 32, width: "100%", maxWidth: 360 }}>
          <div style={{ fontSize: 20, color: "#f0c040", fontFamily: "monospace", fontWeight: 700, marginBottom: 6 }}>⚙️ Admin Panel</div>
          <div style={{ fontSize: 13, color: "#666", marginBottom: 24 }}>Major Pick&apos;em — Commissioner Access</div>
          {authError && <div style={S.error}>{authError}</div>}
          <input
            type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && tryAuth()}
            placeholder="Admin password" autoFocus
            style={{ ...S.scoreInput, width: "100%", padding: "10px 12px", marginBottom: 14, fontSize: 15 }}
          />
          <button onClick={tryAuth} style={{ ...getBtnStyles("yellow"), width: "100%", padding: "10px", fontSize: 15 }}>
            Sign In
          </button>
        </div>
      </div>
    );
  }

  const tournament = TOURNAMENTS[selectedTournament as keyof typeof TOURNAMENTS];

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div>
          <div style={S.title}>⚙️ Major Pick&apos;em — Admin Panel</div>
          <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>Commissioner tools — not visible to players</div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={S.badge}>● LIVE</span>
          <a href="/" style={{ ...getBtnStyles("blue"), textDecoration: "none", fontSize: 12 }}>← Back to App</a>
        </div>
      </div>

      <div style={S.content}>
        {msg && <div style={msgType === "ok" ? S.success : S.error}>{msg}</div>}

        {/* ── Test Mode Controls ── */}
        <div style={S.section}>
          <div style={S.sectionTitle}>🧪 Test Mode Controls</div>

          <div style={S.row}>
            <div>
              <div style={S.label}>Active Round Override</div>
              <div style={S.info}>Forces the app to treat this as the current round for picking</div>
            </div>
            <select
              value={overrides.roundOverride ?? ""}
              onChange={(e) => saveOverrides({ ...overrides, roundOverride: e.target.value ? parseInt(e.target.value) : undefined })}
              style={S.select}
            >
              <option value="">No override (use real date)</option>
              <option value="1">Round 1</option>
              <option value="2">Round 2</option>
              <option value="3">Round 3</option>
              <option value="4">Round 4</option>
            </select>
          </div>

          <div style={S.row}>
            <div>
              <div style={S.label}>Reveal All Picks</div>
              <div style={S.info}>Makes everyone&apos;s picks immediately visible (ignores tee time)</div>
            </div>
            <Toggle on={!!overrides.revealAll} onChange={(v) => saveOverrides({ ...overrides, revealAll: v })} />
          </div>

          <div style={S.row}>
            <div>
              <div style={S.label}>Skip Pick Deadline</div>
              <div style={S.info}>Allows picks to be submitted even after the tee time has passed</div>
            </div>
            <Toggle on={!!overrides.skipDeadline} onChange={(v) => saveOverrides({ ...overrides, skipDeadline: v })} />
          </div>

          <div style={S.row}>
            <div>
              <div style={S.label}>Use Manual Scores</div>
              <div style={S.info}>Ignores ESPN live data — uses the scores you enter below instead</div>
            </div>
            <Toggle on={!!overrides.useManualScores} onChange={(v) => saveOverrides({ ...overrides, useManualScores: v })} />
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" as const }}>
            <button onClick={fillRandomScores} style={getBtnStyles("blue")}>🎲 Fill Random Scores</button>
            <button onClick={async () => { const ok = await call("wipe_picks", { tournament: selectedTournament }); if (ok) showMsg("All test picks wiped"); }} style={getBtnStyles("red")}>
              🗑 Wipe All Picks
            </button>
            <button onClick={async () => { const ok = await call("clear_overrides"); if (ok) { setOverrides({}); showMsg("All overrides cleared — back to real mode"); }}} style={getBtnStyles("yellow")}>
              ↺ Clear All Overrides
            </button>
            <button onClick={async () => { const ok = await call("clear_score_cache"); if (ok) showMsg("Score cache cleared — ESPN will re-fetch"); }} style={getBtnStyles("green")}>
              🔄 Force ESPN Re-fetch
            </button>
          </div>
        </div>

        {/* ── Manual Scores ── */}
        <div style={S.section}>
          <div style={S.sectionTitle}>📊 Manual Scores — {tournament.shortName}</div>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 16 }}>
            Enter scores as to-par per round (e.g. -3, +2, 0). Leave blank if round not played. Toggle &quot;Use Manual Scores&quot; above to activate.
          </div>

          {/* Column headers */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 70px 60px 60px 60px 60px 80px", gap: 6, marginBottom: 8, fontSize: 11, color: "#666", letterSpacing: "0.06em" }}>
            <div>PLAYER</div>
            <div style={{ textAlign: "center" }}>STATUS</div>
            <div style={{ textAlign: "center" }}>R1</div>
            <div style={{ textAlign: "center" }}>R2</div>
            <div style={{ textAlign: "center" }}>R3</div>
            <div style={{ textAlign: "center" }}>R4</div>
            <div style={{ textAlign: "center" }}>TOTAL</div>
          </div>

          <div style={{ maxHeight: 480, overflowY: "auto" as const, paddingRight: 4 }}>
            {scores.map((s) => {
              const total = (s.r1 ?? 0) + (s.r2 ?? 0) + (s.r3 ?? 0) + (s.r4 ?? 0);
              return (
                <div key={s.name} style={{ display: "grid", gridTemplateColumns: "1fr 70px 60px 60px 60px 60px 80px", gap: 6, marginBottom: 6, alignItems: "center" }}>
                  <div style={{ fontSize: 13, color: s.status === "cut" ? "#666" : "#e0e0e0", textDecoration: s.status === "cut" ? "line-through" : "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</div>
                  <select value={s.status} onChange={(e) => updateScore(s.name, "status", e.target.value)} style={{ ...S.select, fontSize: 11, padding: "4px 6px" }}>
                    <option value="active">Active</option>
                    <option value="cut">Cut</option>
                    <option value="wd">WD</option>
                  </select>
                  {(["r1", "r2", "r3", "r4"] as const).map((r) => (
                    <input key={r} type="number" value={s[r] ?? ""} onChange={(e) => updateScore(s.name, r, e.target.value)} style={S.scoreInput} placeholder="—" />
                  ))}
                  <div style={{ textAlign: "center", fontFamily: "monospace", fontSize: 14, color: total < 0 ? "#5dba7e" : total > 0 ? "#e07b6f" : "#aaa" }}>
                    {total === 0 ? "E" : total > 0 ? `+${total}` : total}
                  </div>
                </div>
              );
            })}
          </div>

          <button onClick={saveScores} disabled={saving} style={{ ...getBtnStyles("green"), marginTop: 16, padding: "10px 24px", fontSize: 14, opacity: saving ? 0.6 : 1 }}>
            {saving ? "Saving…" : "💾 Save Scores"}
          </button>
        </div>

        {/* ── Submit Picks As User ── */}
        <div style={S.section}>
          <div style={S.sectionTitle}>👤 Submit Picks As Player</div>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 16 }}>
            Use this if someone misses the deadline and you want to enter picks on their behalf.
            Burned golfers (already used in prior rounds) will be blocked.
          </div>

          {proxyMsg && (
            <div style={proxyMsgType === "ok" ? S.success : S.error}>{proxyMsg}</div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: "#666", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Player</div>
              <select value={proxyUser} onChange={e => { setProxyUser(e.target.value); setProxyPicks([]); }} style={{ ...S.select, width: "100%" }}>
                <option value="">— Select player —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#666", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Round</div>
              <select value={proxyRound} onChange={e => { setProxyRound(parseInt(e.target.value)); setProxyPicks([]); }} style={{ ...S.select, width: "100%" }}>
                <option value={1}>Round 1</option>
                <option value={2}>Round 2</option>
                <option value={3}>Round 3</option>
                <option value={4}>Round 4</option>
              </select>
            </div>
          </div>

          <div style={{ fontSize: 11, color: "#666", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
            Select 3 Golfers ({proxyPicks.length}/3)
          </div>

          {proxyPicks.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              {proxyPicks.map(g => (
                <div key={g} style={{ background: "#1a3a1a", border: "1px solid #3a6a3a", borderRadius: 16, padding: "4px 12px", fontSize: 13, color: "#5dba7e", display: "flex", alignItems: "center", gap: 8 }}>
                  {g}
                  <button onClick={() => toggleProxyPick(g)} style={{ background: "none", border: "none", color: "#5dba7e", cursor: "pointer", padding: 0, fontSize: 14 }}>✕</button>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, maxHeight: 300, overflowY: "auto", marginBottom: 14 }}>
            {ADMIN_GOLFERS.map(g => {
              const sel = proxyPicks.includes(g);
              const dis = !sel && proxyPicks.length >= 3;
              return (
                <button key={g} onClick={() => toggleProxyPick(g)} disabled={dis}
                  style={{
                    padding: "7px 10px", fontSize: 12, border: `1px solid ${sel ? "#3a6a3a" : "#333"}`,
                    background: sel ? "#1a3a1a" : "#1a1a1a", color: sel ? "#5dba7e" : dis ? "#444" : "#aaa",
                    borderRadius: 6, cursor: dis ? "not-allowed" : "pointer", textAlign: "left",
                    transition: "all 0.1s",
                  }}>
                  {g}
                </button>
              );
            })}
          </div>

          <button onClick={submitProxyPicks} disabled={saving || proxyPicks.length !== 3 || !proxyUser}
            style={{ ...getBtnStyles("green"), padding: "10px 24px", fontSize: 14, opacity: (saving || proxyPicks.length !== 3 || !proxyUser) ? 0.5 : 1 }}>
            {saving ? "Submitting…" : "Submit Picks on Their Behalf"}
          </button>
        </div>

        {/* ── Test Walkthrough ── */}
        <div style={S.section}>
          <div style={S.sectionTitle}>📋 How to Run a Test</div>
          <ol style={{ paddingLeft: 20, color: "#888", fontSize: 13, lineHeight: 2 }}>
            <li>Set <span style={{ color: "#f0c040" }}>Active Round Override</span> to Round 1</li>
            <li>Enable <span style={{ color: "#f0c040" }}>Skip Pick Deadline</span> so picks work outside tournament week</li>
            <li>Have everyone go to the site and submit their picks</li>
            <li>Come back here and enable <span style={{ color: "#f0c040" }}>Reveal All Picks</span></li>
            <li>Enable <span style={{ color: "#f0c040" }}>Use Manual Scores</span>, enter some scores (or hit 🎲 Random), hit Save</li>
            <li>Have everyone refresh — leaderboard should show standings</li>
            <li>When done, hit <span style={{ color: "#f0c040" }}>↺ Clear All Overrides</span> and <span style={{ color: "#f0c040" }}>🗑 Wipe All Picks</span> to reset for the real tournament</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
