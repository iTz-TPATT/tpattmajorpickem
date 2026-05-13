import { NextResponse } from "next/server";

const PHOTOS: Record<string, { file: string; caption: string }[]> = {
  masters: [
    { file: "pimento-sandwich.jpg",   caption: "Pimento Cheese Sandwich & Sweet Tea · Augusta National" },
    { file: "rory-mcilroy.jpg",       caption: "Rory McIlroy — 2025 Masters Champion · Augusta National" },
    { file: "tiger-woods.jpg",        caption: "Tiger Woods — Augusta National" },
    { file: "par-3.jpg",              caption: "Amen Corner · Augusta National Golf Club" },
  ],
  pga: [
    { file: "aronimink-trophy.jpg",   caption: "Wanamaker Trophy · Aronimink Golf Club · Newtown Square, PA" },
    { file: "scheffler-pga.jpg",      caption: "Scottie Scheffler · 2026 PGA Championship" },
    { file: "rory-pga.jpg",           caption: "Rory McIlroy · Aronimink Golf Club" },
    { file: "jt-thomas.jpg",          caption: "Justin Thomas · PGA Championship" },
    { file: "aronimink-bridge.png",   caption: "Wanamaker Trophy · Aronimink Golf Club" },
    { file: "wanamaker-trophy.jpg",   caption: "The Wanamaker Trophy · Aronimink Golf Club" },
  ],
  usopen: [
    { file: "par-3.jpg", caption: "US Open 2026" },
  ],
  theopen: [
    { file: "par-3.jpg", caption: "The Open Championship 2026" },
  ],
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tournament = searchParams.get("tournament") ?? "masters";
  const entries = PHOTOS[tournament] ?? PHOTOS.masters;
  const photos = entries.map(entry => ({
    url: `/courses/${entry.file}`,
    caption: entry.caption,
  }));
  return NextResponse.json({ photos, source: "local" });
}
