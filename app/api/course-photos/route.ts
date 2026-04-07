import { NextResponse } from "next/server";

// All Masters photos from /public/images/
const PHOTOS: Record<string, { file: string; caption: string }[]> = {
  masters: [
    { file: "augusta-hole-12-amen-corner.jpg",  caption: "Amen Corner — Hole 12 · Augusta National" },
    { file: "augusta-course-layout.jpg",         caption: "Augusta National Golf Club · Augusta, Georgia" },
    { file: "masters-course-scenic.jpg",         caption: "The Masters Tournament · Augusta National" },
    { file: "masters-tee-shot-crowd.jpg",        caption: "Masters Week · Augusta National" },
    { file: "masters-leaderboard.jpg",           caption: "Masters Leaderboard · Augusta National" },
    { file: "masters-player-celebration.jpg",    caption: "Champions Corner · The Masters" },
  ],
  pga: [
    { file: "pga1.jpg", caption: "Quail Hollow Club · Charlotte, North Carolina" },
  ],
  usopen: [
    { file: "usopen1.jpg", caption: "Oakmont Country Club · Oakmont, Pennsylvania" },
  ],
  theopen: [
    { file: "theopen1.jpg", caption: "Royal Portrush Golf Club · Portrush, N. Ireland" },
  ],
};

const PICSUM_FALLBACKS: Record<string, string[]> = {
  masters:  ["augusta1","augusta2","augusta3","augusta4","augusta5","augusta6"],
  pga:      ["charlotte-golf1","charlotte-golf2"],
  usopen:   ["oakmont-golf1","oakmont-golf2"],
  theopen:  ["portrush-golf1","portrush-golf2"],
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tournament = searchParams.get("tournament") ?? "masters";

  const entries = PHOTOS[tournament] ?? PHOTOS.masters;
  const fallbacks = PICSUM_FALLBACKS[tournament] ?? PICSUM_FALLBACKS.masters;

  const photos = entries.map((entry, i) => ({
    url: `/images/${entry.file}`,
    fallbackUrl: `https://picsum.photos/seed/${fallbacks[i] ?? "golf" + i}/1400/500`,
    caption: entry.caption,
  }));

  return NextResponse.json({ photos, source: "local" });
}
