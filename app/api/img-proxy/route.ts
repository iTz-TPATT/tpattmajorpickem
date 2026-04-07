import { NextResponse } from "next/server";

// Server-side image proxy — fetches images from any source and streams them
// to the browser. This bypasses all hotlinking/CORS restrictions since the
// request comes from Vercel's server, not the browser.

const ALLOWED_HOSTS = [
  "upload.wikimedia.org",
  "commons.wikimedia.org",
  "images.unsplash.com",
  "en.wikipedia.org",
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url) return new NextResponse("Missing url", { status: 400 });

  // Security: only proxy from allowed hosts
  let parsed: URL;
  try { parsed = new URL(url); } catch { return new NextResponse("Invalid url", { status: 400 }); }

  if (!ALLOWED_HOSTS.some(h => parsed.hostname.endsWith(h))) {
    return new NextResponse("Host not allowed", { status: 403 });
  }

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; MajorPickem/1.0)",
        "Accept": "image/*,*/*",
        "Referer": "https://www.wikipedia.org/",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return new NextResponse("Upstream error", { status: 502 });

    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const buffer = await res.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    console.error("Proxy error:", err);
    return new NextResponse("Fetch failed", { status: 502 });
  }
}
