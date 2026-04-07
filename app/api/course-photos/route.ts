import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";

// Wikipedia article names for each course — these are real, verified Wikipedia pages
const WIKI_ARTICLES: Record<string, { article: string; caption: string }> = {
  masters:  { article: "Augusta_National_Golf_Club", caption: "Augusta National Golf Club · Augusta, Georgia" },
  pga:      { article: "Quail_Hollow_Club",          caption: "Quail Hollow Club · Charlotte, North Carolina" },
  usopen:   { article: "Oakmont_Country_Club",        caption: "Oakmont Country Club · Oakmont, Pennsylvania" },
  theopen:  { article: "Royal_Portrush_Golf_Club",    caption: "Royal Portrush Golf Club · Portrush, N. Ireland" },
};

// Extra articles for Masters rotation variety
const MASTERS_EXTRA = [
  { article: "Amen_Corner_(golf)", caption: "Amen Corner — Holes 11, 12 & 13 · Augusta National" },
  { article: "Masters_Tournament",  caption: "The Masters Tournament · Augusta, Georgia" },
];

interface WikiMediaItem {
  title: string;
  srcset?: { src: string; scale: string }[];
  original?: { source: string; width: number; height: number };
  thumbnail?: { source: string; width: number; height: number };
}

async function getArticleImages(article: string): Promise<string[]> {
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/media-list/${encodeURIComponent(article)}`,
      {
        headers: {
          "User-Agent": "MajorPickem/1.0 (golf pick-em app; contact via github.com)",
          "Accept": "application/json",
        },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!res.ok) return [];

    const data = await res.json() as { items?: WikiMediaItem[] };
    const items = data.items ?? [];
    const urls: string[] = [];

    for (const item of items) {
      // Only use actual image files (not SVG logos, icons, etc.)
      const title = item.title ?? "";
      if (title.toLowerCase().match(/\.(svg|png|ico|gif|ogg|pdf|webm|mp4)/)) continue;
      if (title.toLowerCase().includes("logo") || title.toLowerCase().includes("icon")) continue;
      if (title.toLowerCase().includes("map") || title.toLowerCase().includes("diagram")) continue;

      // Get the best available source URL
      const original = item.original?.source;
      const thumb = item.thumbnail?.source;

      // Prefer landscape images (wider than tall)
      const origW = item.original?.width ?? 0;
      const origH = item.original?.height ?? 0;
      if (origW > 0 && origH > 0 && origW < origH) continue; // skip portrait

      if (original) {
        // Wikimedia: replace thumbnail size to get a good display size
        urls.push(original.replace(/\/\d+px-/, "/1280px-"));
      } else if (thumb) {
        urls.push(thumb.replace(/\/\d+px-/, "/1280px-"));
      }

      if (urls.length >= 3) break; // max 3 per article
    }

    return urls;
  } catch (err) {
    console.error("Wiki media fetch error:", err);
    return [];
  }
}

function proxyUrl(url: string): string {
  return `/api/img-proxy?url=${encodeURIComponent(url)}`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tournament = searchParams.get("tournament") ?? "masters";
  const bust = searchParams.get("bust") === "1";

  const supabase = createServerSupabase();
  const cacheKey = `course_photos_v3_${tournament}`;

  // Check 24-hour cache
  if (!bust) {
    const { data: cached } = await supabase
      .from("score_cache")
      .select("data, updated_at")
      .eq("tournament", cacheKey)
      .single();

    if (cached) {
      const age = Date.now() - new Date(cached.updated_at as string).getTime();
      if (age < 86_400_000) {
        return NextResponse.json({ photos: cached.data, source: "cache" });
      }
    }
  }

  const primary = WIKI_ARTICLES[tournament];
  if (!primary) return NextResponse.json({ photos: [] });

  const photos: { url: string; caption: string }[] = [];

  // Fetch primary article images
  const primaryUrls = await getArticleImages(primary.article);
  for (const url of primaryUrls.slice(0, 2)) {
    photos.push({ url: proxyUrl(url), caption: primary.caption });
  }

  // For Masters: fetch extra articles for more variety
  if (tournament === "masters" && photos.length < 4) {
    for (const extra of MASTERS_EXTRA) {
      if (photos.length >= 4) break;
      const urls = await getArticleImages(extra.article);
      for (const url of urls.slice(0, 1)) {
        photos.push({ url: proxyUrl(url), caption: extra.caption });
      }
    }
  }

  if (photos.length > 0) {
    await supabase.from("score_cache").upsert({
      tournament: cacheKey,
      data: photos,
      updated_at: new Date().toISOString(),
    });
    return NextResponse.json({ photos, source: "wikipedia", count: photos.length });
  }

  return NextResponse.json({ photos: [], source: "empty" });
}
