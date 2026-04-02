import { NextRequest, NextResponse } from "next/server";
import { captureApiError } from "@/lib/sentry";
import { resolveUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
    try {
        const userId = resolveUserId(req);
        if (!userId) {
            return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
        }

        const suggestions = await (prisma as any).courseSuggestion.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                placeName: true,
                placeAddress: true,
                description: true,
                status: true,
                createdAt: true,
                course: {
                    select: {
                        id: true,
                        title: true,
                        title_en: true,
                        title_ja: true,
                        title_zh: true,
                        imageUrl: true,
                        region: true,
                        duration: true,
                    },
                },
            },
        });

        return NextResponse.json({ suggestions });
    } catch (e) {
        captureApiError(e);
        console.error("/api/course-suggestions/my GET error", e);
        return NextResponse.json({ error: "서버 오류" }, { status: 500 });
    }
}
