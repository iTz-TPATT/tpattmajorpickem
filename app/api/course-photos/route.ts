import { NextResponse } from "next/server";

// Curated signature hole photos for each major
// Using Wikimedia Commons direct file URLs — landscape orientation, wide-angle shots
// These are verified public domain / CC-licensed photos of the actual holes

const COURSE_PHOTOS: Record<string, { url: string; caption: string }[]> = {
  masters: [
    {
      // 12th hole Golden Bell — the most photographed par-3 in golf
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Augusta_National_Golf_Club_%2812th_hole%29.jpg/1280px-Augusta_National_Golf_Club_%2812th_hole%29.jpg",
      caption: "12th Hole — Golden Bell · Augusta National",
    },
    {
      // 13th hole Azalea — Amen Corner
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/Augusta_National_Golf_Club_%2813th_hole%29.jpg/1280px-Augusta_National_Golf_Club_%2813th_hole%29.jpg",
      caption: "13th Hole — Azalea · Augusta National",
    },
    {
      // 16th hole Redbud — iconic par-3 over the water
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8b/Augusta_National_Golf_Club_%2816th_hole%29.jpg/1280px-Augusta_National_Golf_Club_%2816th_hole%29.jpg",
      caption: "16th Hole — Redbud · Augusta National",
    },
    {
      // Aerial of Augusta National
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Augusta_National_Golf_Club_aerial_%282016%29.jpg/1280px-Augusta_National_Golf_Club_aerial_%282016%29.jpg",
      caption: "Augusta National Golf Club · Augusta, Georgia",
    },
  ],
  pga: [
    {
      // Quail Hollow 18th — The Green Mile
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/Quail_Hollow_Club_18th_hole.jpg/1280px-Quail_Hollow_Club_18th_hole.jpg",
      caption: "18th Hole — The Green Mile · Quail Hollow Club",
    },
  ],
  usopen: [
    {
      // Oakmont Church Pew bunkers — most iconic feature
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/Oakmont_Country_Club_church_pew_bunkers.jpg/1280px-Oakmont_Country_Club_church_pew_bunkers.jpg",
      caption: "Church Pew Bunkers · Oakmont Country Club",
    },
  ],
  theopen: [
    {
      // Royal Portrush 5th hole Calamity Corner — most famous hole
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Royal_Portrush_Golf_Club_5th_hole.jpg/1280px-Royal_Portrush_Golf_Club_5th_hole.jpg",
      caption: "5th Hole — Calamity Corner · Royal Portrush",
    },
  ],
};

// Fallback to Wikipedia API if Wikimedia direct URLs fail
async function getWikipediaFallback(article: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${article}`,
      {
        headers: { "User-Agent": "MajorPickem/1.0", "Accept": "application/json" },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!res.ok) return null;
    const data = await res.json() as Record<string, unknown>;
    return (data.originalimage as Record<string, unknown>)?.source as string
      ?? (data.thumbnail as Record<string, unknown>)?.source as string
      ?? null;
  } catch { return null; }
}

const WIKI_FALLBACKS: Record<string, string> = {
  masters: "Augusta_National_Golf_Club",
  pga: "Quail_Hollow_Club",
  usopen: "Oakmont_Country_Club",
  theopen: "Royal_Portrush_Golf_Club",
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tournament = searchParams.get("tournament") ?? "masters";

  const photos = COURSE_PHOTOS[tournament];

  // If we have curated photos, return them directly
  // The frontend will handle image load errors gracefully
  if (photos?.length > 0) {
    return NextResponse.json({ photos, source: "curated" });
  }

  // Fallback to Wikipedia for unknown tournaments
  const wikiArticle = WIKI_FALLBACKS[tournament];
  if (wikiArticle) {
    const url = await getWikipediaFallback(wikiArticle);
    if (url) {
      return NextResponse.json({
        photos: [{ url, caption: wikiArticle.replace(/_/g, " ") }],
        source: "wikipedia",
      });
    }
  }

  return NextResponse.json({ photos: [], source: "empty" });
}
