// app/api/youtube/search/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

const YT = "https://www.googleapis.com/youtube/v3";

type Filters = {
  q: string;
  type?: "all" | "long" | "short";
  publishedRange?: { after?: string; before?: string };
  viewBand?: "all" | "lt100k" | "100k_1m" | "gte1m";
  max?: number; // 0|10|50|100 (0=전체로 간주)
  order?: "date" | "viewCount" | "relevance" | "subscriberCount";
  lengthCapSec?: number | null;
};

type VideoItem = {
  id: string;
  title: string;
  channelTitle: string;
  channelId?: string;
  publishedAt: string;
  thumbnail?: string;
  durationSec: number;
  viewCount: number;
};

// ISO8601 duration -> seconds
function isoDurToSec(dur: string) {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(dur) || [];
  const h = parseInt(m[1] || "0", 10);
  const mi = parseInt(m[2] || "0", 10);
  const s = parseInt(m[3] || "0", 10);
  return h * 3600 + mi * 60 + s;
}

function ensureKey() {
  const key = process.env.YT_API_KEY;
  if (!key) throw new Error("Missing YT_API_KEY");
  return key;
}

export async function POST(req: NextRequest) {
  try {
    const key = ensureKey();
    const body = (await req.json()) as Filters;

    const q = (body.q || "").trim();
    if (!q) return NextResponse.json({ error: "키워드를 입력하세요." }, { status: 400 });

    // 1) search.list
    let videoDuration: "any" | "short" | "long" = "any";
    if (body.type === "short") videoDuration = "short";
    if (body.type === "long") videoDuration = "long";

    const params = new URLSearchParams({
      key,
      part: "snippet",
      type: "video",
      q,
      maxResults: String(Math.min(Math.max(body.max ?? 50, 1), 50)),
      order: body.order || "relevance",
      videoDuration,
    });
    if (body.publishedRange?.after) params.set("publishedAfter", body.publishedRange.after);
    if (body.publishedRange?.before) params.set("publishedBefore", body.publishedRange.before);

    const searchRes = await fetch(`${YT}/search?${params.toString()}`, { cache: "no-store" });
    const searchJson = await searchRes.json();
    const ids: string[] = (searchJson.items || [])
      .map((it: any) => it?.id?.videoId)
      .filter(Boolean);

    if (!ids.length) return NextResponse.json({ items: [] });

    // 2) videos.list
    const videosRes = await fetch(
      `${YT}/videos?` +
        new URLSearchParams({
          key,
          part: "snippet,contentDetails,statistics",
          id: ids.join(","),
        }).toString(),
      { cache: "no-store" }
    );
    const videosJson = await videosRes.json();

    // ✅ 여기서 명시적으로 VideoItem[] 로 고정
    let videos: VideoItem[] = ((videosJson.items || []) as any[]).map((v): VideoItem => {
      const durSec = isoDurToSec(v?.contentDetails?.duration || "PT0S");
      const viewCount = parseInt(v?.statistics?.viewCount || "0", 10);
      return {
        id: String(v?.id || ""),
        title: String(v?.snippet?.title || ""),
        channelTitle: String(v?.snippet?.channelTitle || ""),
        channelId: v?.snippet?.channelId ? String(v.snippet.channelId) : undefined,
        publishedAt: String(v?.snippet?.publishedAt || ""),
        thumbnail:
          v?.snippet?.thumbnails?.medium?.url ||
          v?.snippet?.thumbnails?.default?.url ||
          undefined,
        durationSec: durSec,
        viewCount,
      };
    });

    // ✅ 모든 filter 콜백에 타입 명시
    if (body.lengthCapSec) {
      const cap = body.lengthCapSec as number;
      videos = (videos as VideoItem[]).filter((v: VideoItem) => v.durationSec <= cap);
    }

    if (body.type === "short") {
      videos = (videos as VideoItem[]).filter((v: VideoItem) => v.durationSec <= 60);
    } else if (body.type === "long") {
      videos = (videos as VideoItem[]).filter((v: VideoItem) => v.durationSec >= 20 * 60);
    }

    if (body.viewBand && body.viewBand !== "all") {
      videos = (videos as VideoItem[]).filter((v: VideoItem) => {
        if (body.viewBand === "lt100k") return v.viewCount < 100_000;
        if (body.viewBand === "100k_1m") return v.viewCount >= 100_000 && v.viewCount < 1_000_000;
        if (body.viewBand === "gte1m") return v.viewCount >= 1_000_000;
        return true;
      });
    }

    // 채널 구독자 조회(옵션)
    let subsMap: Record<string, number> = {};
    if (body.order === "subscriberCount") {
      const chIds = Array.from(new Set(videos.map((v) => v.channelId).filter(Boolean))) as string[];
      if (chIds.length) {
        const chRes = await fetch(
          `${YT}/channels?` +
            new URLSearchParams({
              key,
              part: "statistics",
              id: chIds.join(","),
            }).toString(),
          { cache: "no-store" }
        );
        const chJson = await chRes.json();
        (chJson.items || []).forEach((c: any) => {
          subsMap[c.id] = parseInt(c?.statistics?.subscriberCount || "0", 10);
        });
      }
    }

    // 정렬
    if (body.order === "date") {
      videos.sort(
        (a: VideoItem, b: VideoItem) =>
          new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      );
    } else if (body.order === "viewCount") {
      videos.sort((a: VideoItem, b: VideoItem) => b.viewCount - a.viewCount);
    } else if (body.order === "subscriberCount") {
      videos.sort(
        (a: VideoItem, b: VideoItem) =>
          (subsMap[b.channelId || ""] || 0) - (subsMap[a.channelId || ""] || 0)
      );
    }

    // 개수 제한
    let limit = body.max && body.max > 0 ? body.max : videos.length;
    limit = Math.min(limit, 100);
    videos = videos.slice(0, limit);

    return NextResponse.json({ items: videos, subsMap });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e?.message || "error" }, { status: 500 });
  }
}