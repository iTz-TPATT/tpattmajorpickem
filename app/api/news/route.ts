import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";

const CACHE_MS = 5 * 60 * 1000;

interface NewsItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  source: string;
  sourceLabel: string;
  imageUrl: string | null;
}

const FEEDS = [
  { url: "https://www.espn.com/espn/rss/golf/news", label: "ESPN Golf", source: "espn" },
  { url: "https://www.golf.com/feed/", label: "Golf.com", source: "golf" },
  { url: "https://www.golfchannel.com/rss/golf-news", label: "Golf Channel", source: "golfchannel" },
];

function extractImg(text: string): string | null {
  if (!text) return null;
  const m = text.match(/<img[^>]+src=["']([^"']+)["']/i)
    || text.match(/url=([^&"'\s]+\.(?:jpg|jpeg|png|webp))/i);
  return m ? m[1] : null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .trim();
}

function getTag(item: string, tag: string): string {
  const m = item.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, "i"));
  return m?.[1]?.trim() ?? "";
}

async function parseFeed(url: string, label: string, source: string): Promise<NewsItem[]> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MajorPickem/1.0)" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const itemBlocks = xml.match(/<item>([\s\S]*?)<\/item>/g) ?? [];
    const items: NewsItem[] = [];

    for (const block of itemBlocks.slice(0, 8)) {
      const title = stripHtml(getTag(block, "title"));
      const link = getTag(block, "link").replace(/^<!\[CDATA\[|\]\]>$/g, "").trim()
        || block.match(/<link[^>]*href="([^"]+)"/)?.[1] || "";
      const desc = stripHtml(getTag(block, "description")).slice(0, 200);
      const pubDate = getTag(block, "pubDate");
      const mediaUrl = block.match(/media:content[^>]+url="([^"]+)"/)?.[1]
        || block.match(/media:thumbnail[^>]+url="([^"]+)"/)?.[1]
        || null;
      const imageUrl = mediaUrl || extractImg(getTag(block, "description")) || null;

      if (title && link) {
        items.push({ title, link, description: desc, pubDate, source, sourceLabel: label, imageUrl });
      }
    }
    return items;
  } catch {
    return [];
  }
}

export async function GET() {
  try {
    const supabase = createServerSupabase();

    const { data: cached } = await supabase
      .from("score_cache")
      .select("data, updated_at")
      .eq("tournament", "news_cache")
      .single();

    if (cached) {
      const age = Date.now() - new Date(cached.updated_at as string).getTime();
      if (age < CACHE_MS) return NextResponse.json({ items: cached.data, cached: true });
    }

    const results = await Promise.all(FEEDS.map(f => parseFeed(f.url, f.label, f.source)));
    const all = results.flat().sort((a, b) =>
      new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
    );

    const final = all.length > 0 ? all : ((cached?.data as NewsItem[]) ?? []);

    if (all.length > 0) {
      await supabase.from("score_cache").upsert({
        tournament: "news_cache",
        data: final,
        updated_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({ items: final, cached: false });
  } catch {
    return NextResponse.json({ items: [], cached: false });
  }
}
