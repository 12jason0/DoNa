import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { resolveUserId } from "@/lib/auth";
import { captureApiError } from "@/lib/sentry";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
    try {
        const userId = resolveUserId(request);
        if (!userId) return NextResponse.json({ message: "인증이 필요합니다." }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const storyId = Number(searchParams.get("storyId"));
        if (!Number.isFinite(storyId)) {
            return NextResponse.json({ message: "storyId가 필요합니다." }, { status: 400 });
        }

        // 해당 스토리의 장소(챕터) 목록 조회
        const placeOptions = await prisma.placeOption.findMany({
            where: { storyId },
            select: { id: true, category: true },
        });
        const byId = new Map<number, string | null | undefined>();
        const chapterIds = placeOptions.map((p) => {
            byId.set(p.id, p.category);
            return p.id;
        });
        if (chapterIds.length === 0) return NextResponse.json({ categories: [] });

        // 유저가 해당 챕터(장소)에서 제출한 미션이 하나라도 있으면 완료로 간주
        const subs = await prisma.missionSubmission.findMany({
            where: { userId, chapterId: { in: chapterIds } },
            select: { chapterId: true },
        });
        const completedChapterIds = new Set<number>(subs.map((s) => s.chapterId));

        const completedCategories = Array.from(completedChapterIds)
            .map((id) => byId.get(id))
            .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
            .map((s) => s.trim());

        // 고유값 반환
        const unique = Array.from(new Set(completedCategories));

        return NextResponse.json({ categories: unique });
    } catch (error: any) {

            captureApiError(error);
        return NextResponse.json({ message: error?.message || "조회 실패" }, { status: 500 });
    }
}
