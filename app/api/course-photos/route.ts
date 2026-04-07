import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";

const WIKI_ARTICLES: Record<string, { article: string; caption: string }[]> = {
  masters: [
    { article: "Augusta_National_Golf_Club", caption: "Augusta National Golf Club · Augusta, Georgia" },
    { article: "Amen_Corner_(Augusta_National)", caption: "Amen Corner — Holes 11, 12 & 13" },
    { article: "Masters_Tournament", caption: "The Masters Tournament · Augusta National" },
  ],
  pga: [
    { article: "Quail_Hollow_Club", caption: "Quail Hollow Club · Charlotte, North Carolina" },
  ],
  usopen: [
    { article: "Oakmont_Country_Club", caption: "Oakmont Country Club · Oakmont, Pennsylvania" },
  ],
  theopen: [
    { article: "Royal_Portrush_Golf_Club", caption: "Royal Portrush Golf Club · Portrush, Northern Ireland" },
  ],
};

async function getWikipediaImage(article: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${article}`,
      {
        headers: {
          "User-Agent": "MajorPickem/1.0 (golf pick-em app)",
          "Accept": "application/json",
        },
        signal: AbortSignal.timeout(6000),
      }
    );
    if (!res.ok) return null;
    const data = await res.json() as Record<string, unknown>;
    const original = (data.originalimage as Record<string, unknown>)?.source as string | undefined;
    const thumb = (data.thumbnail as Record<string, unknown>)?.source as string | undefined;
    return original ?? thumb ?? null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tournament = searchParams.get("tournament") ?? "masters";
  const supabase = createServerSupabase();
  const cacheKey = `course_photos_${tournament}`;

  // 24-hour cache
  const { data: cached } = await supabase
    .from("score_cache").select("data, updated_at").eq("tournament", cacheKey).single();

  if (cached) {
    const age = Date.now() - new Date(cached.updated_at as string).getTime();
    if (age < 86_400_000) return NextResponse.json({ photos: cached.data, source: "cache" });
  }

  const entries = WIKI_ARTICLES[tournament] ?? [];
  const photos: { url: string; caption: string }[] = [];

  for (const entry of entries) {
    const url = await getWikipediaImage(entry.article);
    if (url) photos.push({ url, caption: entry.caption });
  }

  if (photos.length > 0) {
    await supabase.from("score_cache").upsert({
      tournament: cacheKey, data: photos, updated_at: new Date().toISOString(),
    });
    return NextResponse.json({ photos, source: "wikipedia" });
  }

  // Return whatever is cached even if stale
  return NextResponse.json({ photos: cached?.data ?? [], source: "stale" });
}
