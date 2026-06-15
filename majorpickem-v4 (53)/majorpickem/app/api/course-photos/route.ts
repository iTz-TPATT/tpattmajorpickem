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
    { file: "usopen-aerial.jpg",           caption: "Shinnecock Hills Golf Club · Southampton, NY" },
    { file: "usopen-field.jpg",            caption: "US Open 2026 · Shinnecock Hills" },
    { file: "usopen-scheffler.jpg",        caption: "Scottie Scheffler · US Open 2026" },
    { file: "usopen-ludvig.jpg",           caption: "Ludvig Åberg · US Open 2026" },
    { file: "usopen-rory-shinnecock.jpg",  caption: "Rory McIlroy on Shinnecock Hills" },
    { file: "usopen-trophy-clubhouse.jpg", caption: "US Open Trophy · Shinnecock Hills Clubhouse" },
    { file: "usopen-17th.jpg",             caption: "17th Hole · Shinnecock Hills Golf Club" },
    { file: "usopen-course.jpg",           caption: "Shinnecock Hills Golf Club · Southampton, NY" },
    { file: "usopen-bunker.jpg",           caption: "Shinnecock Hills Bunkers · US Open 2026" },
    { file: "usopen-shinnecock-clubhouse.jpg", caption: "Shinnecock Hills Clubhouse" },
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
