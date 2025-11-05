// app/api/youtube/search/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

const YT = "https://www.googleapis.com/youtube/v3";

type Filters = {
  q: string;
  type?: "all" | "long" | "short";               // 영상종류(롱폼/숏폼/전체)
  publishedRange?: { after?: string; before?: string }; // ISO8601
  viewBand?: "all" | "lt100k" | "100k_1m" | "gte1m";
  max?: number;                                   // 10 | 50 | 100 | 0(전체=최대100)
  order?: "date" | "viewCount" | "relevance";     // 정렬
  lengthCapSec?: number | null;                   // 00:00 이내
};

function ensureKey() {
  const key = process.env.YT_API_KEY;
  if (!key) throw new Error("Missing YT_API_KEY");
  return key;
}

// YouTube duration ISO8601 -> seconds
function isoDurToSec(dur: string) {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(dur) || [];
  const h = parseInt(m[1] || "0", 10);
  const mi = parseInt(m[2] || "0", 10);
  const s = parseInt(m[3] || "0", 10);
  return h * 3600 + mi * 60 + s;
}

export async function POST(req: NextRequest) {
  try {
    const key = ensureKey();
    const body = (await req.json()) as Filters;

    const q = (body.q || "").trim();
    if (!q) return NextResponse.json({ error: "키워드를 입력하세요." }, { status: 400 });

    // 1) search.list: id만 긁어오기 (publishedAfter/before, order, type=video)
    // Shorts/Long은 API의 videoDuration(short/long)도 있지만, Shorts는 <=60초로 따로 필터링
    let videoDuration: "any" | "short" | "long" = "any";
    if (body.type === "short") videoDuration = "short"; // <4분 (YouTube 기준)
    if (body.type === "long") videoDuration = "long";   // >20분

    const params = new URLSearchParams({
      key, part: "snippet", type: "video",
      q, maxResults: String(Math.min(Math.max(body.max || 50, 1), 50)),
      order: body.order || "relevance",
      videoDuration,
    });
    if (body.publishedRange?.after) params.set("publishedAfter", body.publishedRange.after);
    if (body.publishedRange?.before) params.set("publishedBefore", body.publishedRange.before);

    const searchRes = await fetch(`${YT}/search?${params.toString()}`, { cache: "no-store" });
    const searchJson = await searchRes.json();
    const items = searchJson.items || [];
    const videoIds: string[] = items.map((it: any) => it.id?.videoId).filter(Boolean);

    if (videoIds.length === 0) {
      return NextResponse.json({ items: [] });
    }

    // 2) videos.list: 통계/길이/썸네일
    const videosRes = await fetch(
      `${YT}/videos?` + new URLSearchParams({
        key, part: "snippet,contentDetails,statistics", id: videoIds.join(",")
      }).toString(),
      { cache: "no-store" }
    );
    const videosJson = await videosRes.json();
    let videos = (videosJson.items || []).map((v: any) => {
      const durSec = isoDurToSec(v.contentDetails?.duration || "PT0S");
      const views = parseInt(v.statistics?.viewCount || "0", 10);
      const chId = v.snippet?.channelId;
      return {
        id: v.id,
        title: v.snippet?.title || "",
        channelTitle: v.snippet?.channelTitle || "",
        channelId: chId,
        publishedAt: v.snippet?.publishedAt,
        thumbnail: v.snippet?.thumbnails?.medium?.url || v.snippet?.thumbnails?.default?.url,
        durationSec: durSec,
        viewCount: views,
      };
    });

    // 추가 길이 상한(예: "00:30 이내")
    if (body.lengthCapSec) {
      videos = videos.filter(v => v.durationSec <= (body.lengthCapSec as number));
    }

    // '숏폼'을 명확히 60초 이내로 정의하고 싶다면 여기에서 재필터링:
    if (body.type === "short") {
      videos = videos.filter(v => v.durationSec <= 60);
    } else if (body.type === "long") {
      videos = videos.filter(v => v.durationSec >= 20 * 60);
    }

    // 조회수 밴드 필터
    if (body.viewBand && body.viewBand !== "all") {
      videos = videos.filter(v => {
        if (body.viewBand === "lt100k") return v.viewCount < 100_000;
        if (body.viewBand === "100k_1m") return v.viewCount >= 100_000 && v.viewCount < 1_000_000;
        if (body.viewBand === "gte1m") return v.viewCount >= 1_000_000;
        return true;
      });
    }

    // 필요 시 채널 구독자 수 가져오기(구독자순 정렬용)
    let subsMap: Record<string, number> = {};
    if (body.order === "subscriberCount") {
      const chIds = Array.from(new Set(videos.map(v => v.channelId).filter(Boolean)));
      if (chIds.length) {
        const channelsRes = await fetch(
          `${YT}/channels?` + new URLSearchParams({
            key, part: "statistics", id: chIds.join(",")
          }).toString(),
          { cache: "no-store" }
        );
        const chJson = await channelsRes.json();
        (chJson.items || []).forEach((c: any) => {
          subsMap[c.id] = parseInt(c.statistics?.subscriberCount || "0", 10);
        });
      }
    }

    // 정렬
    if (body.order === "date") {
      videos.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    } else if (body.order === "viewCount") {
      videos.sort((a, b) => b.viewCount - a.viewCount);
    } else if (body.order === "subscriberCount") {
      videos.sort((a, b) => (subsMap[b.channelId || ""] || 0) - (subsMap[a.channelId || ""] || 0));
    } // relevance(기본)는 search API가 이미 정렬

    // 전체/10/50/100 개수 제한 (0 또는 누락 = search의 maxResults 그대로)
    let limit = body.max && body.max > 0 ? body.max : videos.length;
    limit = Math.min(limit, 100);
    videos = videos.slice(0, limit);

    return NextResponse.json({ items: videos, subsMap });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e?.message || "error" }, { status: 500 });
  }
}