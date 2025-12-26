import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { resolveUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const courseId = searchParams.get("courseId");
        const userId = searchParams.get("userId");
        const limit = Math.min(Number(searchParams.get("limit") || "10"), 50);
        const offset = Number(searchParams.get("offset") || "0");

        const whereClause: any = {};
        if (courseId) {
            whereClause.courseId = Number(courseId);
        }
        if (userId) {
            whereClause.userId = Number(userId);
        }

        // 🚨 중요: about 페이지처럼 courseId, userId가 없는 경우를 허용하기 위해
        // 아래 조건문을 제거하거나 주석 처리합니다.
        /* if (!courseId && !userId) {
            return NextResponse.json({ error: "courseId 또는 userId가 필요합니다." }, { status: 400 });
        }
        */

        const reviews = await prisma.review.findMany({
            where: whereClause,
            include: {
                user: {
                    select: {
                        username: true,
                        profileImageUrl: true,
                    },
                },
                course: {
                    select: {
                        title: true,
                        concept: true,
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
            take: limit,
            skip: offset,
        });

        const formatted = (reviews || []).map((r) => ({
            id: r.id,
            courseId: r.courseId,
            userId: r.userId,
            rating: r.rating,
            comment: r.comment,
            imageUrls: r.imageUrls || [],
            createdAt: r.createdAt,
            user: {
                nickname: r.user?.username || "익명",
                initial: (r.user?.username?.[0] || "U").toUpperCase(),
                profileImageUrl: r.user?.profileImageUrl || "",
            },
            course: r.course
                ? {
                      title: r.course.title,
                      concept: (r.course as any).concept || "",
                  }
                : undefined,
        }));

        return NextResponse.json(formatted);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("API: /api/reviews failed, returning empty list:", message);
        // 🚨 중요: 오류 발생 시 500 대신 200과 빈 배열을 반환
        return NextResponse.json([], { status: 200, headers: { "X-Error": String(message) } });
    }
}

export async function POST(request: NextRequest) {
    try {
        const userId = resolveUserId(request);
        if (!userId) {
            return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
        }

        const body = await request.json().catch(() => {
            return NextResponse.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
        });

        // JSON 파싱 실패 시 에러 응답이 이미 반환됨
        if (body instanceof NextResponse) {
            return body;
        }
        const { courseId, rating, comment, content, imageUrls } = body;

        if (!courseId || !rating) {
            return NextResponse.json({ error: "courseId와 rating은 필수입니다." }, { status: 400 });
        }

        // --- 👇 유효성 검사 ---
        const numericUserId = Number(userId);
        const numericCourseId = Number(courseId);
        const numericRating = Number(rating);

        if (!Number.isFinite(numericUserId) || !Number.isFinite(numericCourseId) || !Number.isFinite(numericRating)) {
            return NextResponse.json({ error: "유효하지 않은 데이터 타입입니다." }, { status: 400 });
        }

        // [기능 개선] rating 범위 검증 (1-5)
        if (numericRating < 1 || numericRating > 5 || !Number.isInteger(numericRating)) {
            return NextResponse.json({ error: "평점은 1부터 5까지의 정수만 가능합니다." }, { status: 400 });
        }

        // [단계 1] 코스를 실제로 완료했는지 먼저 확인 (분리의 핵심)
        const isCompleted = await prisma.completedCourse.findFirst({
            where: { userId: numericUserId, courseId: numericCourseId },
        });

        if (!isCompleted) {
            return NextResponse.json(
                {
                    success: false,
                    message: "코스를 완료한 후에만 리뷰 보상을 받을 수 있습니다! 🏃‍♂️",
                },
                { status: 400 }
            );
        }

        // [기능 개선] 중복 리뷰 체크 (같은 사용자가 같은 코스에 리뷰를 여러 번 작성하는 것 방지)
        const existingReview = await prisma.review.findFirst({
            where: {
                userId: numericUserId,
                courseId: numericCourseId,
            },
        });

        const finalComment: string =
            typeof comment === "string" && comment.trim().length > 0
                ? comment.trim()
                : typeof content === "string"
                ? content.trim()
                : "";

        // 🟢 트랜잭션으로 리뷰 저장 + 쿠폰 지급 처리
        const result = await prisma.$transaction(async (tx) => {
            let review;
            let isNewReview = false;

            if (existingReview) {
                // 기존 리뷰가 있으면 업데이트
                review = await tx.review.update({
                    where: { id: existingReview.id },
                    data: {
                        rating: numericRating,
                        comment: finalComment,
                        imageUrls: Array.isArray(imageUrls) ? imageUrls : existingReview.imageUrls || [],
                    },
                });
            } else {
                // 새 리뷰 생성
                review = await tx.review.create({
                    data: {
                        userId: numericUserId,
                        courseId: numericCourseId,
                        rating: numericRating,
                        comment: finalComment,
                        imageUrls: Array.isArray(imageUrls) ? imageUrls : [],
                    },
                });
                isNewReview = true;
            }

            // [단계 3] 새 리뷰 작성 시에만 쿠폰 지급 체크
            let couponAwarded = false;
            let reviewCount = 0;

            if (isNewReview) {
                // 리뷰 작성한 코스 개수 확인 (중복 제거)
                const reviews = await tx.review.findMany({
                    where: { userId: numericUserId },
                    select: { courseId: true },
                });
                const uniqueCourseIds = new Set(reviews.map((r) => r.courseId));
                reviewCount = uniqueCourseIds.size;

                // 🟢 리뷰 작성한 코스가 5개가 되면 쿠폰 1개 지급 (5, 10, 15, 20...)
                if (reviewCount % 5 === 0 && reviewCount > 0) {
                    // 중복 지급 방지: 이미 해당 마일스톤에 대한 보상이 지급되었는지 확인
                    const milestoneRewardExists = await tx.userReward.findFirst({
                        where: {
                            userId: numericUserId,
                            type: "course_completion_milestone" as any,
                            amount: reviewCount / 5, // 몇 번째 마일스톤인지 (1, 2, 3...)
                        },
                    });

                    if (!milestoneRewardExists) {
                        // 쿠폰 지급
                        await tx.user.update({
                            where: { id: numericUserId },
                            data: { couponCount: { increment: 1 } },
                        });

                        // 보상 기록 저장 (리뷰 보상)
                        await tx.userReward.create({
                            data: {
                                userId: numericUserId,
                                courseId: numericCourseId,
                                type: "course_completion_milestone" as any,
                                amount: reviewCount / 5,
                                unit: "coupon" as any,
                            },
                        } as any);

                        couponAwarded = true;
                    }
                }
            }

            return { review, couponAwarded, isNewReview, reviewCount };
        });

        // 응답 반환
        if (result.isNewReview) {
            return NextResponse.json(
                {
                    ...result.review,
                    couponAwarded: result.couponAwarded,
                    message: result.couponAwarded
                        ? `다녀온 코스에 리뷰를 5개 남기면 쿠폰을 드려요! 현재 ${result.reviewCount}개 작성 완료`
                        : undefined,
                },
                { status: 201 }
            );
        } else {
            return NextResponse.json(result.review, { status: 200 });
        }
    } catch (error) {
        // [보안] 상세한 에러 메시지는 서버 로그에만 기록하고, 클라이언트에는 일반적인 메시지만 반환
        console.error("리뷰 생성 오류:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error("에러 상세:", errorMessage);

        // Prisma 에러인 경우 특별 처리
        if (error instanceof Error && error.message.includes("Unique constraint")) {
            return NextResponse.json({ error: "이미 리뷰를 작성하셨습니다." }, { status: 409 });
        }

        return NextResponse.json({ error: "리뷰 생성 중 오류가 발생했습니다." }, { status: 500 });
    }
}
