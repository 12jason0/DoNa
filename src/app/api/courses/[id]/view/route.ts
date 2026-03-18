import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { resolveUserId } from "@/lib/auth";
import { isExcludedStatsUser } from "@/lib/statsExclude";
import { captureApiError } from "@/lib/sentry";

export const dynamic = "force-dynamic";

// 현재 조회수 가져오기
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const courseId = Number(id);
        if (!Number.isFinite(courseId)) {
            return NextResponse.json({ success: false, error: "Invalid course id" }, { status: 400 });
        }

        const row = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true, view_count: true } });
        if (!row) return NextResponse.json({ success: false, error: "Course not found" }, { status: 404 });
        return NextResponse.json({ success: true, view_count: row.view_count });
    } catch (e) {
            captureApiError(e);
        console.error("GET /api/courses/[id]/view error", e);
        return NextResponse.json({ success: false, error: "Failed to fetch view count" }, { status: 500 });
    }
}

// 조회수 증가 (비로그인 포함) + user_interactions에 view 기록 (로그인 사용자만)
// 🟢 테스트/내부 계정(승용, 오승용, 아아아아, 용용)은 조회수·집계에서 제외
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const courseId = Number(id);
        if (!Number.isFinite(courseId)) {
            return NextResponse.json({ success: false, error: "Invalid course id" }, { status: 400 });
        }

        const userId = resolveUserId(request);

        // 제외 대상 로그인 유저면 증가·기록 없이 현재 조회수만 반환
        if (userId) {
            const excluded = await isExcludedStatsUser(prisma, userId);
            if (excluded) {
                const row = await prisma.course.findUnique({
                    where: { id: courseId },
                    select: { id: true, view_count: true },
                });
                if (!row) return NextResponse.json({ success: false, error: "Course not found" }, { status: 404 });
                return NextResponse.json({ success: true, view_count: row.view_count });
            }
        }

        // 1. view_count 증가 (모든 사용자, 제외 계정 제외)
        const updated = await prisma.course.update({
            where: { id: courseId },
            data: { view_count: { increment: 1 } },
            select: { id: true, view_count: true },
        });

        // 2. 로그인 사용자인 경우 user_interactions에도 기록
        if (userId) {
            try {
                await prisma.userInteraction.create({
                    data: {
                        userId: userId,
                        courseId: courseId,
                        action: "view",
                    },
                });
            } catch (interactionError) {
                    captureApiError(interactionError);
                console.error("user_interactions 기록 실패:", interactionError);
            }
        }

        return NextResponse.json({ success: true, view_count: updated.view_count });
    } catch (error) {
            captureApiError(error);
        console.error("API: Error incrementing view count:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
    }
}
