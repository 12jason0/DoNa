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

        // [기능 개선] 중복 리뷰 체크 (같은 사용자가 같은 코스에 리뷰를 여러 번 작성하는 것 방지)
        const existingReview = await prisma.review.findFirst({
            where: {
                userId: numericUserId,
                courseId: numericCourseId,
            },
        });

        if (existingReview) {
            // 기존 리뷰가 있으면 업데이트
            const finalComment: string =
                typeof comment === "string" && comment.trim().length > 0
                    ? comment.trim()
                    : typeof content === "string"
                    ? content.trim()
                    : "";

            const updatedReview = await prisma.review.update({
                where: { id: existingReview.id },
                data: {
                    rating: numericRating,
                    comment: finalComment,
                    imageUrls: Array.isArray(imageUrls) ? imageUrls : existingReview.imageUrls || [],
                },
            });

            return NextResponse.json(updatedReview, { status: 200 });
        }
        // --- 👆 여기까지 추가 ---

        const finalComment: string =
            typeof comment === "string" && comment.trim().length > 0
                ? comment.trim()
                : typeof content === "string"
                ? content.trim()
                : "";

        const newReview = await prisma.review.create({
            data: {
                userId: numericUserId,
                courseId: numericCourseId,
                rating: numericRating,
                comment: finalComment,
                imageUrls: Array.isArray(imageUrls) ? imageUrls : [],
            },
        });

        return NextResponse.json(newReview, { status: 201 });
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
