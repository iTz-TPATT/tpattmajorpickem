import { NextResponse } from "next/server";

// Photos served from /public/images/ in the repo
// To add more photos later, upload to public/images/ and add entries below

const PHOTOS: Record<string, { file: string; caption: string }[]> = {
  masters: [
    { file: "masters-logo.jpg",       caption: "The Azaleas · Augusta National Golf Club" },
    { file: "pimento-sandwich.jpg",   caption: "Pimento Cheese Sandwich & Sweet Tea · Augusta National" },
    { file: "rory-mcilroy.jpg",       caption: "Rory McIlroy — 2025 Masters Champion · Augusta National" },
    { file: "tiger-woods.jpg",        caption: "Tiger Woods — Augusta National" },
    { file: "par-3.jpg",              caption: "Amen Corner · Augusta National Golf Club" },
    { file: "masters-pond.jpg",       caption: "Augusta National Golf Club · Augusta, Georgia" },
    { file: "masters-leaderboard.jpg", caption: "The Leaderboard · Augusta National" },
  ],
  // ── Future majors — upload photos and uncomment ──────────────────────────
  // pga: [
  //   { file: "pga1.jpg",    caption: "Quail Hollow Club · Charlotte, North Carolina" },
  //   { file: "pga2.jpg",    caption: "The Green Mile · Quail Hollow Club" },
  // ],
  // usopen: [
  //   { file: "usopen1.jpg", caption: "Oakmont Country Club · Oakmont, Pennsylvania" },
  //   { file: "usopen2.jpg", caption: "Church Pew Bunkers · Oakmont" },
  // ],
  // theopen: [
  //   { file: "theopen1.jpg", caption: "Royal Portrush Golf Club · Portrush, N. Ireland" },
  //   { file: "theopen2.jpg", caption: "Calamity Corner · Royal Portrush" },
  // ],
};

// Picsum fallback — shows while photos load or if a file is missing
const PICSUM_FALLBACKS: Record<string, string[]> = {
  masters: ["augusta1", "augusta2", "augusta3"],
  pga:     ["quailhollow1", "quailhollow2"],
  usopen:  ["oakmont1", "oakmont2"],
  theopen: ["portrush1", "portrush2"],
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tournament = searchParams.get("tournament") ?? "masters";

  const entries = PHOTOS[tournament] ?? [];
  const fallbacks = PICSUM_FALLBACKS[tournament] ?? [];

  // If no local photos for this tournament yet, use picsum
  if (entries.length === 0) {
    const photos = (fallbacks).map((seed, i) => ({
      url: `https://picsum.photos/seed/${seed}/1400/500`,
      fallbackUrl: `https://picsum.photos/seed/golf${i}/1400/500`,
      caption: tournament === "pga" ? "Quail Hollow Club · Charlotte, NC"
             : tournament === "usopen" ? "Oakmont Country Club · Oakmont, PA"
             : "Royal Portrush Golf Club · Portrush, N. Ireland",
    }));
    return NextResponse.json({ photos, source: "picsum" });
  }

  const photos = entries.map((entry, i) => ({
    url: `/courses/${entry.file}`,
    fallbackUrl: `https://picsum.photos/seed/${fallbacks[i] ?? "golf" + i}/1400/500`,
    caption: entry.caption,
  }));

  return NextResponse.json({ photos, source: "local" });
}
