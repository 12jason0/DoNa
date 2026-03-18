import { NextRequest, NextResponse } from "next/server";
import { captureApiError } from "@/lib/sentry";
export const dynamic = "force-dynamic";
// 간단한 XML 파서 (RSS entry 일부만 필요하므로 정규식 기반)
function parseYouTubeRss(xml: string) {
    const entries: { id: string; title: string; url: string; description?: string }[] = [];
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let match: RegExpExecArray | null;
    while ((match = entryRegex.exec(xml)) !== null) {
        const chunk = match[1];
        const idMatch = chunk.match(/<yt:videoId>([^<]+)<\/yt:videoId>/) || chunk.match(/<id>yt:video:([^<]+)<\/id>/);
        const titleMatch = chunk.match(/<title>([^<]+)<\/title>/);
        const descMatch = chunk.match(/<media:description>([\s\S]*?)<\/media:description>/);
        const videoId = idMatch ? idMatch[1] : "";
        const title = titleMatch ? titleMatch[1] : "";
        const description = descMatch ? descMatch[1] : "";
        if (videoId) {
            entries.push({ id: videoId, title, description, url: `https://www.youtube.com/watch?v=${videoId}` });
        }
    }
    return entries;
}

async function resolveChannelIdFromHandle(handleUrl: string): Promise<string | null> {
    try {
        const res = await fetch(handleUrl, { headers: { "User-Agent": "Mozilla/5.0" } as any });
        const html = await res.text();
        // 다양한 패턴 시도
        const byJson = html.match(/\"channelId\"\s*:\s*\"(UC[\w-]{10,})\"/);
        if (byJson) return byJson[1];
        const byCanonical = html.match(/href=\"https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{10,})\"/);
        if (byCanonical) return byCanonical[1];
        const byOg = html.match(/"og:url"\s*content=\"https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{10,})\"/);
        if (byOg) return byOg[1];
        return null;
    } catch {
        return null;
    }
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const handle = searchParams.get("handle") || "@hwa_aeng";
        const max = Math.max(1, Math.min(Number(searchParams.get("limit") || 10), 20));
        const breadOnly = (searchParams.get("breadOnly") ?? "1") !== "0";
        const rawKeywords =
            searchParams.get("keywords") ||
            "빵,베이커리,bakery,bread,도넛,donut,케이크,cake,파이,페이스트리,pastry,제과,제빵,크로와상,바게트,마카롱,브레드,호밀,사워도우";
        const keywords = rawKeywords
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);

        const handleUrl = `https://www.youtube.com/${handle.replace(/^@/, "@").trim()}`;
        const channelId = await resolveChannelIdFromHandle(handleUrl);
        if (!channelId) {
            return NextResponse.json({ success: false, error: "채널 ID를 찾지 못했습니다." }, { status: 404 });
        }

        const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
        const feedRes = await fetch(feedUrl, { headers: { "User-Agent": "Mozilla/5.0" } as any });
        if (!feedRes.ok) {
            return NextResponse.json({ success: false, error: "RSS 피드를 가져오지 못했습니다." }, { status: 502 });
        }
        const xml = await feedRes.text();
        let entries = parseYouTubeRss(xml);
        if (breadOnly && keywords.length > 0) {
            const regex = new RegExp(keywords.join("|"), "i");
            entries = entries.filter((e) => regex.test(`${e.title} ${e.description || ""}`));
        }
        entries = entries.slice(0, max);

        return NextResponse.json({ success: true, channelId, videos: entries });
    } catch (e) {
            captureApiError(e);
        return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
    }
}
