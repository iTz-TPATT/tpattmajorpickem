import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";

function checkAdmin(request: Request): boolean {
  const auth = request.headers.get("x-admin-password");
  return auth === process.env.ADMIN_PASSWORD;
}

export async function GET(request: Request) {
  if (!checkAdmin(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServerSupabase();

  // Return current overrides + all golfer scores from cache
  const { data: overrides } = await supabase
    .from("score_cache")
    .select("data")
    .eq("tournament", "admin_overrides")
    .single();

  const { data: scoreCache } = await supabase
    .from("score_cache")
    .select("data")
    .eq("tournament", "scores_masters")
    .single();

  return NextResponse.json({
    overrides: overrides?.data ?? {},
    scores: scoreCache?.data ?? [],
  });
}

export async function POST(request: Request) {
  if (!checkAdmin(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as Record<string, unknown>;
  const { action } = body;
  const supabase = createServerSupabase();

  // ── Save overrides (round override, reveal override) ──
  if (action === "save_overrides") {
    await supabase.from("score_cache").upsert({
      tournament: "admin_overrides",
      data: body.overrides,
      updated_at: new Date().toISOString(),
    });
    return NextResponse.json({ success: true });
  }

  // ── Save manual scores ──
  if (action === "save_scores") {
    const scores = body.scores as unknown[];
    await supabase.from("score_cache").upsert({
      tournament: "scores_masters",
      data: scores,
      updated_at: new Date().toISOString(),
    });
    return NextResponse.json({ success: true });
  }

  // ── Clear overrides ──
  if (action === "clear_overrides") {
    await supabase.from("score_cache")
      .delete()
      .eq("tournament", "admin_overrides");
    return NextResponse.json({ success: true });
  }

  // ── Wipe all test picks for a tournament ──
  if (action === "wipe_picks") {
    const tournament = body.tournament as string;
    await supabase.from("picks").delete().eq("tournament", tournament);
    return NextResponse.json({ success: true });
  }

  // ── Clear score cache (force ESPN re-fetch) ──
  if (action === "clear_score_cache") {
    await supabase.from("score_cache")
      .delete()
      .eq("tournament", "scores_masters");
    return NextResponse.json({ success: true });
  }


  // ── Submit picks on behalf of a user ──
  if (action === "submit_picks_as_user") {
    const { userId, username, tournament, round, golfers } = body as {
      userId: string; username: string; tournament: string;
      round: number; golfers: string[];
    };

    if (!userId || !tournament || !round || !Array.isArray(golfers) || golfers.length !== 3) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Check burned golfers
    if (round > 1) {
      const { data: prev } = await supabase
        .from("picks").select("golfer")
        .eq("user_id", userId).eq("tournament", tournament).lt("round_number", round);
      const burned = new Set((prev ?? []).map((p: { golfer: string }) => p.golfer));
      const conflict = golfers.find((g) => burned.has(g));
      if (conflict) return NextResponse.json({ error: `${conflict} already used by this player in a prior round` }, { status: 400 });
    }

    // Replace their picks for this round
    await supabase.from("picks").delete()
      .eq("user_id", userId).eq("tournament", tournament).eq("round_number", round);

    const { error } = await supabase.from("picks").insert(
      golfers.map((golfer) => ({ user_id: userId, username, tournament, round_number: round, golfer }))
    );

    if (error) return NextResponse.json({ error: "DB error" }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

// Note: submit_picks_as_user is handled below in the same POST handler
// This export allows the admin API to fetch user list too
export async function PUT(request: Request) {
  if (!checkAdmin(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get all users for the admin panel dropdown
  const supabase = createServerSupabase();
  const { data: users } = await supabase.from("users").select("id, username").order("username");
  return NextResponse.json({ users: users ?? [] });
}
