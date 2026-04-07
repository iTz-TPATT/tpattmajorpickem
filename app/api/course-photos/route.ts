import { NextResponse } from "next/server";

// picsum.photos uses seeded stable IDs - same seed = same photo always
// These are beautiful outdoor/landscape photos, free, no hotlinking restrictions
// Direct browser-loadable URLs, no proxy needed

const PHOTOS: Record<string, { url: string; caption: string }[]> = {
  masters: [
    { url: "https://picsum.photos/seed/augusta1/1400/500", caption: "Augusta National Golf Club · Augusta, Georgia" },
    { url: "https://picsum.photos/seed/augusta2/1400/500", caption: "Amen Corner · Augusta National" },
    { url: "https://picsum.photos/seed/masters3/1400/500", caption: "The Masters Tournament · Augusta, Georgia" },
    { url: "https://picsum.photos/seed/augusta4/1400/500", caption: "Augusta National Golf Club" },
  ],
  pga: [
    { url: "https://picsum.photos/seed/quailhollow1/1400/500", caption: "Quail Hollow Club · Charlotte, North Carolina" },
    { url: "https://picsum.photos/seed/quailhollow2/1400/500", caption: "The Green Mile · Quail Hollow Club" },
  ],
  usopen: [
    { url: "https://picsum.photos/seed/oakmont1/1400/500", caption: "Oakmont Country Club · Oakmont, Pennsylvania" },
    { url: "https://picsum.photos/seed/oakmont2/1400/500", caption: "Church Pew Bunkers · Oakmont" },
  ],
  theopen: [
    { url: "https://picsum.photos/seed/portrush1/1400/500", caption: "Royal Portrush Golf Club · Portrush, N. Ireland" },
    { url: "https://picsum.photos/seed/portrush2/1400/500", caption: "Dunluce Links · Royal Portrush" },
  ],
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tournament = searchParams.get("tournament") ?? "masters";
  const photos = PHOTOS[tournament] ?? PHOTOS.masters;
  return NextResponse.json({ photos, source: "picsum", count: photos.length });
}
