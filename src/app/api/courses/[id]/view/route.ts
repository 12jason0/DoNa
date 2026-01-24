import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { resolveUserId } from "@/lib/auth";

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
        console.error("GET /api/courses/[id]/view error", e);
        return NextResponse.json({ success: false, error: "Failed to fetch view count" }, { status: 500 });
    }
}

// 조회수 증가 (비로그인 포함) + user_interactions에 view 기록 (로그인 사용자만)
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const courseId = Number(id);
        if (!Number.isFinite(courseId)) {
            return NextResponse.json({ success: false, error: "Invalid course id" }, { status: 400 });
        }

        // 1. view_count 증가 (모든 사용자)
        const updated = await prisma.course.update({
            where: { id: courseId },
            data: { view_count: { increment: 1 } },
            select: { id: true, view_count: true },
        });

        // 2. 로그인 사용자인 경우 user_interactions에도 기록
        const userId = resolveUserId(request);
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
                // 상호작용 기록 실패해도 view_count 증가는 성공으로 처리
                console.error("user_interactions 기록 실패:", interactionError);
            }
        }

        return NextResponse.json({ success: true, view_count: updated.view_count });
    } catch (error) {
        console.error("API: Error incrementing view count:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
    }
}
