import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";

export async function GET() {
  const supabase = createServerSupabase();

  const { data, error } = await supabase
    .from("golfer_scores")
    .select("golfer, r1, r2, r3, r4, total_score, position, status")
    .order("total_score", { ascending: true });

  if (error) return NextResponse.json({ error: "Failed to fetch scores" }, { status: 500 });

  return NextResponse.json({ scores: data ?? [] });
}
