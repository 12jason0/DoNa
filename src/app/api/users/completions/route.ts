import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { resolveUserId } from "@/lib/auth";
import { captureApiError } from "@/lib/sentry";
import { userHasCourseAccess } from "@/lib/shareAccess";
import { NO_TIPS } from "@/lib/tipAccess";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
        const userId = resolveUserId(request);
        if (!userId) {
            return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
        }

        // ✅ [수정됨] prisma.CompletedCourses, prisma.CompletedEscapes -> prisma.completedCourse, prisma.completedEscape
        const completedCourses = await prisma.completedCourse.findMany({
            where: { userId: Number(userId) },
            include: {
                course: {
                    include: {
                        coursePlaces: {
                            orderBy: { order_index: "asc" },
                            take: 1, // 첫 번째 장소만 가져오기
                            include: {
                                place: {
                                    select: {
                                        id: true,
                                        name: true,
                                        imageUrl: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        const completedEscapes = await prisma.completedEscape.findMany({
            where: { userId: Number(userId) },
            include: { story: true },
        });

        // 지금 열람 권한이 없는 코스(환불·구독 만료 등)는 팁 모든 언어 비움 — include로 코스장소 행 전체가 나가던 문제
        const courses = await Promise.all(
            completedCourses.map(async (cc) => {
                if (!cc.course || (await userHasCourseAccess(Number(userId), cc.course.id))) return cc;
                return {
                    ...cc,
                    course: { ...cc.course, coursePlaces: cc.course.coursePlaces.map((cp) => ({ ...cp, ...NO_TIPS })) },
                };
            }),
        );

        return NextResponse.json({
            courses,
            escapes: completedEscapes,
        });
    } catch (error) {
            captureApiError(error);
        return NextResponse.json({ error: "완료 목록을 가져오는 중 오류 발생" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const userId = resolveUserId(request);
        if (!userId) {
            return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
        }
        const body = await request.json().catch(() => ({}));
        const courseIdRaw = body?.courseId ?? body?.course_id ?? body?.id;
        const title: string | undefined = body?.title;
        const courseId = Number(courseIdRaw);
        if (!Number.isFinite(courseId)) {
            return NextResponse.json({ error: "유효한 courseId가 필요합니다." }, { status: 400 });
        }

        // 이미 완료했는지 확인
        const existing = await prisma.completedCourse.findFirst({
            where: { userId: Number(userId), courseId: courseId },
        });
        if (existing) {
            return NextResponse.json({ success: true, already: true });
        }

        // 🟢 트랜잭션으로 코스 완료 저장 (열람권 지급은 리뷰 작성 시 처리)
        const result = await prisma.$transaction(async (tx) => {
            // 코스 완료 기록 생성
            const created = await tx.completedCourse.create({
                data: {
                    userId: Number(userId),
                    courseId: courseId,
                },
                include: { course: true },
            });

            await (tx as any).userInteraction.create({
                data: { userId: Number(userId), courseId, action: "complete" },
            });

            // 완료된 코스 개수 확인
            const completedCount = await tx.completedCourse.count({
                where: { userId: Number(userId) },
            });

            // 🟢 열람권 지급은 리뷰 작성 시 처리하므로 여기서는 제거
            return { created, completedCount };
        });

        return NextResponse.json({
            success: true,
            item: result.created,
            completedCount: result.completedCount,
        });
    } catch (error) {
            captureApiError(error);
        return NextResponse.json({ error: "코스 완료 저장 중 오류 발생" }, { status: 500 });
    }
}
