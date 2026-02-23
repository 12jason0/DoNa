import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { resolveUserId } from "@/lib/auth";
import { getKSTTodayRange } from "@/lib/kst";

export const dynamic = "force-dynamic";

/**
 * GET /api/users/active-course
 * 오늘(KST) activeCourse 조회 + hasMemory (해당 코스로 나만의 추억 있음 여부)
 */
export async function GET(request: NextRequest) {
    try {
        const userId = resolveUserId(request);
        if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

        const { start, end } = getKSTTodayRange();

        const active = await prisma.activeCourse.findUnique({
            where: { userId },
            include: {
                course: {
                    include: {
                        coursePlaces: {
                            orderBy: { order_index: "asc" },
                            include: {
                                place: { select: { imageUrl: true } },
                            },
                        },
                    },
                },
            },
        });

        if (!active) return NextResponse.json(null);

        // startedAt이 오늘(KST) 범위인지 확인
        const startedAt = new Date(active.startedAt);
        if (startedAt < start || startedAt > end) return NextResponse.json(null);

        // 해당 코스로 나만의 추억(Review isPublic:false) 존재 여부
        const memory = await prisma.review.findFirst({
            where: {
                userId,
                courseId: active.courseId,
                isPublic: false,
            },
        });

        const course = active.course;
        // 🟢 오늘의 선택(recommendations)과 동일한 해상 로직 + fallback: 이미지 있는 첫 장소
        const firstPlaceImage =
            course?.imageUrl ||
            course?.coursePlaces?.[0]?.place?.imageUrl ||
            course?.coursePlaces?.find((cp: any) => cp?.place?.imageUrl)?.place?.imageUrl ||
            null;
        return NextResponse.json({
            courseId: active.courseId,
            courseTitle: course?.title ?? "",
            title: course?.title ?? "",
            imageUrl: firstPlaceImage,
            vibe: Array.isArray(course?.mood) && course.mood[0] ? course.mood[0] : null,
            walkability: course?.route_difficulty ?? null,
            rating: course?.rating ?? null,
            startedAt: active.startedAt,
            hasMemory: !!memory,
        });
    } catch (error) {
        console.error("[active-course GET]", error);
        return NextResponse.json({ error: "Failed to get active course" }, { status: 500 });
    }
}

/**
 * POST /api/users/active-course
 * Body: { courseId: number }
 * 오늘 activeCourse 설정. 없으면 생성, 있으면 업데이트(courseId 변경 시)
 */
export async function POST(request: NextRequest) {
    try {
        const userId = resolveUserId(request);
        if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

        const body = await request.json().catch(() => ({}));
        const courseId = Number(body?.courseId);
        if (!Number.isFinite(courseId) || courseId <= 0) {
            return NextResponse.json({ error: "Invalid courseId" }, { status: 400 });
        }

        const existing = await prisma.activeCourse.findUnique({
            where: { userId },
        });

        if (!existing) {
            await prisma.activeCourse.create({
                data: { userId, courseId },
            });
            return NextResponse.json({ success: true });
        }

        if (existing.courseId === courseId) {
            return NextResponse.json({ success: true });
        }

        await prisma.activeCourse.update({
            where: { userId },
            data: { courseId, startedAt: new Date() },
        });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[active-course POST]", error);
        return NextResponse.json({ error: "Failed to set active course" }, { status: 500 });
    }
}
