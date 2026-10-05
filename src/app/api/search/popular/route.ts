import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { captureApiError } from "@/lib/sentry";

// 1분마다 다시 집계
export const revalidate = 60;

const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const LIMIT = 5;

/** GET: 최근 7일 검색 횟수 순 인기 검색어 (최대 5개). 모자라면 클라이언트가 기본 검색어로 채움 */
export async function GET() {
    try {
        const rows = await prisma.searchLog.groupBy({
            by: ["keyword"],
            where: { createdAt: { gte: new Date(Date.now() - WINDOW_MS) } },
            _count: { keyword: true },
            orderBy: [{ _count: { keyword: "desc" } }, { keyword: "asc" }],
            take: LIMIT,
        });
        return NextResponse.json({ keywords: rows.map((r) => r.keyword) });
    } catch (error) {
        captureApiError(error);
        return NextResponse.json({ keywords: [] });
    }
}
