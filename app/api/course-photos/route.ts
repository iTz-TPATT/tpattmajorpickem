import { NextResponse } from "next/server";

// Wikimedia Commons direct image URLs for signature holes at each major venue.
// These are fetched server-side via /api/img-proxy so hotlinking is not an issue.
// URLs are the Wikimedia thumbnail API format: /wiki/Special:FilePath/filename?width=1280

function wikiUrl(filename: string): string {
  return `/api/img-proxy?url=${encodeURIComponent(
    `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=1280`
  )}`;
}

const PHOTOS: Record<string, { url: string; caption: string }[]> = {
  masters: [
    {
      url: wikiUrl("Augusta National Golf Club 12th hole.jpg"),
      caption: "12th Hole — Golden Bell · Augusta National",
    },
    {
      url: wikiUrl("Augusta National Golf Club 13th hole.jpg"),
      caption: "13th Hole — Azalea · Augusta National",
    },
    {
      url: wikiUrl("Augusta National Golf Club 16th hole.jpg"),
      caption: "16th Hole — Redbud · Augusta National",
    },
    {
      url: wikiUrl("Augusta National Golf Club aerial (2016).jpg"),
      caption: "Augusta National Golf Club · Augusta, Georgia",
    },
  ],
  pga: [
    {
      url: wikiUrl("Quail Hollow Club.jpg"),
      caption: "Quail Hollow Club · Charlotte, North Carolina",
    },
  ],
  usopen: [
    {
      url: wikiUrl("Oakmont Country Club.jpg"),
      caption: "Oakmont Country Club · Oakmont, Pennsylvania",
    },
  ],
  theopen: [
    {
      url: wikiUrl("Royal Portrush Golf Club.jpg"),
      caption: "Royal Portrush Golf Club · Portrush, Northern Ireland",
    },
  ],
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tournament = searchParams.get("tournament") ?? "masters";
  const photos = PHOTOS[tournament] ?? PHOTOS.masters;
  return NextResponse.json({ photos, source: "wikimedia-proxy" });
}
