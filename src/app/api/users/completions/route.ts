import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { resolveUserId } from "@/lib/auth";

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
            include: { course: true },
        });

        const completedEscapes = await prisma.completedEscape.findMany({
            where: { userId: Number(userId) },
            include: { story: true },
        });

        return NextResponse.json({
            courses: completedCourses,
            escapes: completedEscapes,
        });
    } catch (error) {
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

        // 🟢 트랜잭션으로 코스 완료 저장 + 쿠폰 지급 처리
        const result = await prisma.$transaction(async (tx) => {
            // 코스 완료 기록 생성
            const created = await tx.completedCourse.create({
                data: {
                    userId: Number(userId),
                    courseId: courseId,
                },
                include: { course: true },
            });

            // 완료된 코스 개수 확인
            const completedCount = await tx.completedCourse.count({
                where: { userId: Number(userId) },
            });

            // 🟢 코스 5개 완료 시 쿠폰 1개 지급 (5, 10, 15, 20...)
            let couponAwarded = false;
            if (completedCount % 5 === 0 && completedCount > 0) {
                // 중복 지급 방지: 이미 해당 완료 개수에 대한 보상이 지급되었는지 확인
                const rewardExists = await tx.userReward.findFirst({
                    where: {
                        userId: Number(userId),
                        type: "course_completion_milestone",
                        amount: completedCount / 5, // 몇 번째 마일스톤인지 (1, 2, 3...)
                    },
                });

                if (!rewardExists) {
                    // 쿠폰 지급
                    await tx.user.update({
                        where: { id: Number(userId) },
                        data: { couponCount: { increment: 1 } },
                    });

                    // 보상 기록 저장
                    await tx.userReward.create({
                        data: {
                            userId: Number(userId),
                            type: "course_completion_milestone" as any,
                            amount: completedCount / 5,
                            unit: "coupon" as any,
                        },
                    } as any);

                    couponAwarded = true;
                }
            }

            return { created, couponAwarded, completedCount };
        });

        return NextResponse.json({
            success: true,
            item: result.created,
            couponAwarded: result.couponAwarded,
            completedCount: result.completedCount,
            message: result.couponAwarded ? `축하합니다! 코스 ${result.completedCount}개 완료로 쿠폰 1개가 지급되었습니다.` : undefined,
        });
    } catch (error) {
        return NextResponse.json({ error: "코스 완료 저장 중 오류 발생" }, { status: 500 });
    }
}
