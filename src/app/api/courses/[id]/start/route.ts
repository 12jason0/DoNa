import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { resolveUserId } from "@/lib/auth";
import { getMergedTipsFromRow } from "@/types/tip";
import { captureApiError } from "@/lib/sentry";

export const dynamic = "force-dynamic";

// 🟢 가이드 페이지(시작) 전용 API - 최소한의 필드만 반환
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    let courseId: number | null = null;
    try {
        const { id } = await params;
        courseId = Number(id);

        if (!courseId || isNaN(courseId)) {
            return NextResponse.json({ error: "Invalid course ID" }, { status: 400 });
        }

        const userId = resolveUserId(request);
        let userTier = "FREE";
        let hasUnlocked = false;

        // 🟢 성능 최적화: 사용자 정보와 코스 정보를 병렬로 조회
        const [userResult, course] = await Promise.all([
            userId
                ? Promise.all([
                      prisma.user.findUnique({
                          where: { id: userId },
                          select: { subscriptionTier: true },
                      }),
                      (prisma as any).courseUnlock
                          .findFirst({
                              where: { userId: userId, courseId: courseId },
                          })
                          .catch(() => null),
                  ])
                : Promise.resolve([null, null]),
            // 🟢 가이드 페이지에 필요한 최소한의 데이터만 조회
            prisma.course.findUnique({
                where: { id: courseId },
                select: {
                    id: true,
                    title: true,
                    grade: true,
                    region: true,
                    imageUrl: true,
                    coursePlaces: {
                        orderBy: { order_index: "asc" },
                        select: {
                            id: true,
                            order_index: true,
                            tips: true,
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
            }),
        ]);

        // 🟢 사용자 정보 처리
        if (userResult && userResult[0]) {
            const user = userResult[0];
            if (user?.subscriptionTier) {
                userTier = user.subscriptionTier;
            }
        }
        if (userResult && userResult[1]) {
            hasUnlocked = !!userResult[1];
        }
        if (!course) {
            return NextResponse.json({ error: "Course not found" }, { status: 404 });
        }

        const courseGrade = course.grade || "FREE";
        
        // 🔒 권한 판정: FREE 코스이거나, PREMIUM 유저이거나, BASIC 유저가 BASIC 코스에 접근하거나, 열람권으로 구매한 경우만 접근 허용
        const hasAccess =
            courseGrade === "FREE" || // 무료 코스
            userTier === "PREMIUM" || // PREMIUM 유저는 모든 코스 접근
            (userTier === "BASIC" && courseGrade === "BASIC") || // BASIC 유저는 BASIC 코스만 접근
            hasUnlocked; // 열람권으로 구매한 경우 (FREE 유저도 해당 코스 접근 가능)

        if (!hasAccess) {
            return NextResponse.json({ error: "Access denied", isLocked: true }, { status: 403 });
        }

        const coursePlacesArray = Array.isArray(course.coursePlaces) ? course.coursePlaces : [];

        // 🟢 가이드 페이지용 데이터 구조
        const coursePlaces = coursePlacesArray
            .map((cp: any) => {
                if (!cp || !cp.place) {
                    return null;
                }

                const tipsValue = getMergedTipsFromRow(cp);

                return {
                    order_index: cp.order_index,
                    movement_guide: null,
                    place: {
                        id: cp.place.id,
                        name: cp.place.name || null,
                        imageUrl: cp.place.imageUrl || null,
                        tips: tipsValue,
                    },
                };
            })
            .filter((cp: any) => cp !== null);

        const payload = {
            id: String(course.id),
            title: course.title || "",
            region: course.region || null,
            imageUrl: course.imageUrl || null,
            grade: courseGrade,
            coursePlaces,
        };

        return NextResponse.json(payload);
    } catch (error: any) {
            captureApiError(error);
        console.error("🔴 [START API ERROR]:", {
            message: error.message,
            stack: error.stack,
            courseId: courseId ?? "unknown",
            errorName: error.name,
        });
        return NextResponse.json(
            {
                error: "Internal Server Error",
                message: error.message || "Unknown error",
                details: process.env.NODE_ENV === "development" ? error.stack : undefined,
            },
            { status: 500 }
        );
    }
}

