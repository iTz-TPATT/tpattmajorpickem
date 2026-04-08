import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pw = searchParams.get("password");
  if (pw !== process.env.ADMIN_PASSWORD) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServerSupabase();

  const { data: ovRow } = await supabase.from("score_cache").select("data").eq("tournament", "admin_overrides").single();
  const overrides = (ovRow?.data ?? {}) as Record<string, unknown>;

  const { data: manualRow } = await supabase.from("score_cache").select("data, updated_at").eq("tournament", "manual_scores_masters").single();
  const manualScores = (manualRow?.data ?? []) as Record<string, unknown>[];

  const { data: picks } = await supabase.from("picks").select("username, user_id, round_number, golfer").eq("tournament", "masters").order("username");
  const picksByUser: Record<string, Record<number, string[]>> = {};
  (picks ?? []).forEach((p: { username: string; round_number: number; golfer: string }) => {
    if (!picksByUser[p.username]) picksByUser[p.username] = {};
    if (!picksByUser[p.username][p.round_number]) picksByUser[p.username][p.round_number] = [];
    picksByUser[p.username][p.round_number].push(p.golfer);
  });

  const { data: users } = await supabase.from("users").select("id, username").order("username");

  const scoreMap: Record<string, Record<string, unknown>> = {};
  manualScores.forEach(s => { scoreMap[s.name as string] = s; });

  const firstUser = Object.keys(picksByUser)[0];
  const r1Picks = firstUser ? (picksByUser[firstUser][1] ?? []) : [];
  const scoreLookup = r1Picks.map(g => ({ golfer: g, found: !!scoreMap[g], r1: scoreMap[g]?.r1 ?? "MISSING" }));

  return NextResponse.json({
    overrides,
    registeredUsers: (users ?? []).map((u: { username: string }) => u.username),
    picksByUser,
    manualScoresCount: manualScores.length,
    sampleScores: manualScores.slice(0, 5).map(s => ({ name: s.name, r1: s.r1, r2: s.r2, r3: s.r3, r4: s.r4 })),
    scoreLookupTest: { user: firstUser, r1Picks, results: scoreLookup },
    diagnosis: {
      revealAll: overrides.revealAll,
      useManualScores: overrides.useManualScores,
      skipDeadline: overrides.skipDeadline,
      roundOverride: overrides.roundOverride,
      hasManualScores: manualScores.length > 0,
      hasPicks: (picks ?? []).length > 0,
      scoreMatchRate: r1Picks.length > 0 ? `${scoreLookup.filter(s => s.found).length}/${r1Picks.length} golfers found in scores` : "no picks yet",
    }
  });
}
