import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";

// Public endpoint — returns only safe override flags (no admin password needed)
export async function GET() {
  const supabase = createServerSupabase();
  const { data } = await supabase
    .from("score_cache")
    .select("data")
    .eq("tournament", "admin_overrides")
    .single();

  const overrides = (data?.data ?? {}) as Record<string, unknown>;

  return NextResponse.json({
    roundOverride: overrides.roundOverride ?? null,
    revealAll: overrides.revealAll ?? false,
    useManualScores: overrides.useManualScores ?? false,
    skipDeadline: overrides.skipDeadline ?? false,
  });
}
