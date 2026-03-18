import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { resolveUserId } from "@/lib/auth";
import { captureApiError } from "@/lib/sentry";

// Bearer 토큰 또는 'auth' 쿠키에서 사용자 ID를 가져오는 헬퍼 함수
// 통합 인증 사용 (Authorization 헤더 우선, 없으면 auth 쿠키)

export async function GET(request: NextRequest) {
    try {
        const userId = resolveUserId(request); // <-- 수정된 부분
        if (!userId) {
            return NextResponse.json({ message: "인증이 필요합니다." }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const storyId = Number(searchParams.get("storyId"));
        if (!Number.isFinite(storyId)) {
            return NextResponse.json({ message: "storyId가 필요합니다." }, { status: 400 });
        }

        // MissionSubmission.chapterId 는 Chapter 관계가 아니라 PlaceOption.id 를 가리키는 정수입니다.
        // 따라서 storyId 에 해당하는 PlaceOption 들의 id 집합을 먼저 조회한 뒤 IN 필터로 검색합니다.
        const placeIds = await prisma.placeOption.findMany({
            where: { storyId },
            select: { id: true },
        });
        const chapterIds = placeIds.map((p) => p.id);

        if (chapterIds.length === 0) {
            return NextResponse.json({ success: true, urls: [] });
        }

        const submissions = await prisma.missionSubmission.findMany({
            where: {
                userId,
                photoUrl: { not: null },
                chapterId: { in: chapterIds },
            },
            orderBy: { createdAt: "asc" },
            select: { photoUrl: true },
        });

        const urls = submissions.map((s: { photoUrl: string | null }) => s.photoUrl!).filter(Boolean) as string[];
        return NextResponse.json({ success: true, urls });
    } catch (error: any) {

            captureApiError(error);
        return NextResponse.json({ message: error?.message || "조회 실패" }, { status: 500 });
    }
}
