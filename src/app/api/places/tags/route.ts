import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { captureApiError } from "@/lib/sentry";
export const dynamic = "force-dynamic";
// places.tags 컬럼에서 태그 목록을 수집해 unique로 반환
// tags 컬럼이 없거나 비어있으면 category를 fallback으로 사용
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const region = (searchParams.get("region") || "").trim();
    try {
        // Prisma 조회 (지역 필터 지원)
        const rows = (await (prisma as any).place.findMany({
            where: region ? { address: { contains: region } } : undefined,
            select: { category: true, name: true, address: true },
            take: 2000,
        })) as Array<{ category?: string | null; name?: string | null; address?: string | null }>;

        type Row = { category?: string | null; name?: string | null; address?: string | null };
        const tagCountMap = new Map<string, number>();

        const pushTag = (t: string) => {
            const tag = t.trim();
            if (!tag) return;
            const key = tag.toLowerCase();
            tagCountMap.set(key, (tagCountMap.get(key) || 0) + 1);
        };

        (rows as Row[]).forEach((r) => {
            const rawCategory = r.category ?? "";
            const rawName = r.name ?? "";

            // category 우선, 없으면 name에서 키워드 추출
            const tokens = (rawCategory || rawName)
                .split(/[\s,|\/·]+/)
                .map((s) => s.trim())
                .filter(Boolean);
            if (tokens.length > 0) tokens.forEach(pushTag);
        });

        // count 기준 내림차순 정렬 후 상위 100개만 반환
        const sorted = Array.from(tagCountMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 100)
            .map(([key]) => key);

        return NextResponse.json({ success: true, tags: sorted });
    } catch (error) {

            captureApiError(error);
        console.error("GET /api/places/tags error:", error);
        // 실패 시에도 빈 배열을 반환하여 페이지가 계속 동작하도록 함
        return NextResponse.json({ success: true, tags: [] });
    }
}
