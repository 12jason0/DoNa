import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { resolveUserId } from "@/lib/auth";
import { captureApiError } from "@/lib/sentry";

export const dynamic = "force-dynamic";

const ACTIVE_COURSE_TTL_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * GET /api/users/active-course
 * 진행 중 activeCourse 조회 (시작 후 3일, 추억 남기면 숨김)
 */
export async function GET(request: NextRequest) {
    try {
        const userId = await resolveUserId(request);
        if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

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

        // 진행 중 코스는 시작 후 3일 동안 유지 ('다녀왔어요' 후에도 추억 남기기 유도)
        const startedAt = new Date(active.startedAt);
        if (Date.now() - startedAt.getTime() > ACTIVE_COURSE_TTL_MS) return NextResponse.json(null);

        // 시작 이후 이 코스로 나만의 추억(Review isPublic:false)을 남겼는지
        const memory = await prisma.review.findFirst({
            where: {
                userId,
                courseId: active.courseId ?? undefined,
                isPublic: false,
                createdAt: { gte: startedAt },
            },
        });

        // 추억을 이미 남겼으면 배너 숨김
        if (memory) return NextResponse.json(null);

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
            title_en: course?.title_en ?? null,
            title_ja: course?.title_ja ?? null,
            title_zh: course?.title_zh ?? null,
            imageUrl: firstPlaceImage,
            vibe: Array.isArray(course?.mood) && course.mood[0] ? course.mood[0] : null,
            walkability: course?.route_difficulty ?? null,
            rating: course?.rating ?? null,
            startedAt: active.startedAt,
            hasMemory: !!memory,
        });
    } catch (error) {

            captureApiError(error);
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
        const userId = await resolveUserId(request);
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
            await (prisma as any).userInteraction.create({
                data: { userId, courseId, action: "start" },
            });
            return NextResponse.json({ success: true });
        }

        if (existing.courseId === courseId) {
            await prisma.activeCourse.update({
                where: { userId },
                data: { startedAt: new Date() },
            });
            return NextResponse.json({ success: true });
        }

        await prisma.activeCourse.update({
            where: { userId },
            data: { courseId, startedAt: new Date() },
        });
        await (prisma as any).userInteraction.create({
            data: { userId, courseId, action: "start" },
        });
        return NextResponse.json({ success: true });
    } catch (error) {

            captureApiError(error);
        console.error("[active-course POST]", error);
        return NextResponse.json({ error: "Failed to set active course" }, { status: 500 });
    }
}
