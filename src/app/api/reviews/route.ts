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
            // 🟢 코스 상세 페이지에서는 공개 리뷰만 표시
            whereClause.isPublic = true;
        }
        if (userId) {
            // 🟢 userId가 "me"인 경우 현재 로그인한 사용자의 ID로 변환
            if (userId === "me") {
                const currentUserId = await resolveUserId(request);
                if (currentUserId) {
                    whereClause.userId = Number(currentUserId);
                } else {
                    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
                }
            } else {
            whereClause.userId = Number(userId);
            }
            // 🟢 마이페이지에서는 개인 추억도 포함 (isPublic 필터링 없음)
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

        const formatted = (reviews || []).map((r: any) => {
            // 🟢 isPublic 필드 명시적 확인 (DB에서 가져온 값 또는 기본값)
            // Prisma에서 가져온 원본 데이터 확인
            const rawIsPublic = (r as any).isPublic;
            const isPublicValue = rawIsPublic !== undefined && rawIsPublic !== null ? Boolean(rawIsPublic) : true;
            
            // 🟢 디버깅: userId가 "me"일 때만 로그 출력
            if (userId === "me" && reviews.length > 0) {
                console.log(`[API] Review ID: ${r.id}, isPublic (raw): ${rawIsPublic}, isPublic (processed): ${isPublicValue}`);
            }
            
            return {
            id: r.id,
            courseId: r.courseId,
            userId: r.userId,
            rating: r.rating,
            comment: r.comment,
            imageUrls: r.imageUrls || [],
                tags: r.tags || [], // 🟢 태그 추가
                placeData: r.placeData || null, // 🟢 장소별 데이터 추가
            createdAt: r.createdAt,
                isPublic: isPublicValue, // 🟢 명시적으로 Boolean 변환
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
            };
        });
        
        // 🟢 디버깅: userId가 "me"일 때 응답 요약 로그
        if (userId === "me") {
            const publicCount = formatted.filter((r) => r.isPublic === true).length;
            const privateCount = formatted.filter((r) => r.isPublic === false).length;
            console.log(`[API] /api/reviews?userId=me - 전체: ${formatted.length}, 공개: ${publicCount}, 개인: ${privateCount}`);
        }

        return NextResponse.json(formatted);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("API: /api/reviews failed, returning empty list:", message);
        // 🚨 중요: 오류 발생 시 500 대신 200과 빈 배열을 반환
        // 🟢 HTTP 헤더는 ASCII만 허용하므로 한글 메시지는 헤더에서 제거
        return NextResponse.json([], { status: 200 });
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
        const { courseId, rating, comment, content, imageUrls, isPublic, tags, placeData } = body; // 🟢 tags, placeData 추가

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

        // 🟢 isPublic 기본값: true (공개 리뷰), start 페이지에서 저장할 때는 false (개인 추억)
        const isPublicValue = typeof isPublic === "boolean" ? isPublic : true;

        // 🟢 [단계 1] 코스 완료 체크: 공개 리뷰(isPublic: true)일 때만 코스 완료 필수
        // 개인 추억(isPublic: false)은 코스 완료 없이도 저장 가능
        if (isPublicValue) {
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
        }

        // 🟢 [수정] 중복 리뷰 체크: 공개 리뷰(isPublic: true)일 때만 중복 방지
        // 개인 추억(isPublic: false)은 같은 코스에 여러 개 저장 가능
        const existingReview = isPublicValue 
            ? await prisma.review.findFirst({
                where: {
                    userId: numericUserId,
                    courseId: numericCourseId,
                    isPublic: true, // 🟢 공개 리뷰만 중복 체크
                },
            })
            : null; // 🟢 개인 추억은 중복 체크 안 함

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
                        isPublic: isPublicValue,
                        tags: Array.isArray(tags) ? tags : [], // 🟢 태그 저장
                        placeData: placeData || null, // 🟢 장소별 데이터 저장
                    } as any, // 🟢 타입 캐스팅 (Prisma 클라이언트 타입이 아직 업데이트되지 않음)
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
                        isPublic: isPublicValue,
                        tags: Array.isArray(tags) ? tags : [], // 🟢 태그 저장
                        placeData: placeData || null, // 🟢 장소별 데이터 저장
                    } as any, // 🟢 타입 캐스팅 (Prisma 클라이언트 타입이 아직 업데이트되지 않음)
                });
                isNewReview = true;
            }

            // [단계 3] 새 리뷰 작성 시에만 쿠폰 지급 체크
            let couponAwarded = false;
            let couponAmount = 0;
            let couponMessage = "";
            let reviewCount = 0;
            let personalMemoryCount: number | undefined = undefined;

            // 🟢 개인 추억(isPublic: false) 개수 확인 (모달 표시용)
            // 🟢 [수정] 새 리뷰 생성 후에 개수 확인 (10번째 저장 시 정확한 개수 반영)
            if (isPublicValue === false) {
                personalMemoryCount = await (tx as any).review.count({
                    where: { 
                        userId: numericUserId,
                        isPublic: false
                    },
                });
            }

            if (isNewReview) {

                // 🟢 개인 추억 10개 달성 시 쿠폰 3개 지급 (중복 지급 방지)
                if (personalMemoryCount === 10) {
                    const memoryRewardExists = await tx.userReward.findFirst({
                        where: {
                            userId: numericUserId,
                            type: "personal_memory_milestone" as any, // 🟢 Prisma 클라이언트 재생성 후에도 타입 에러가 있으면 임시로 any 사용
                            placeId: null, // 🟢 placeId를 명시적으로 null로 체크
                        },
                    });

                    if (!memoryRewardExists) {
                        // 쿠폰 3개 지급
                        await tx.user.update({
                            where: { id: numericUserId },
                            data: { couponCount: { increment: 3 } },
                        });

                        // 보상 기록 저장
                        const createdReward = await tx.userReward.create({
                            data: {
                                userId: numericUserId,
                                type: "personal_memory_milestone" as any, // 🟢 Prisma 클라이언트 재생성 후에도 타입 에러가 있으면 임시로 any 사용
                                amount: 3,
                                unit: "coupon" as any,
                                placeId: null, // 🟢 placeId를 명시적으로 null로 설정
                            },
                        });

                        // 🟢 디버깅: 보상 저장 확인
                        console.log("[리뷰 API] 개인 추억 10개 달성 보상 저장 완료:", {
                            id: createdReward.id,
                            type: createdReward.type,
                            amount: createdReward.amount,
                            userId: createdReward.userId,
                        });

                        couponAwarded = true;
                        couponAmount = 3;
                        couponMessage = `추억 10개 달성! 쿠폰 3개를 지급했습니다! 🎉`;
                    }
                }

                // 리뷰 작성한 코스 개수 확인 (중복 제거) - 공개 리뷰만
                const publicReviews = await (tx as any).review.findMany({
                    where: { 
                        userId: numericUserId,
                        isPublic: true
                    },
                    select: { courseId: true },
                });
                const uniqueCourseIds = new Set(publicReviews.map((r: any) => r.courseId));
                reviewCount = uniqueCourseIds.size;

                // 🟢 공개 리뷰 작성한 코스가 5개가 되면 쿠폰 1개 지급 (5, 10, 15, 20...)
                if (!couponAwarded && reviewCount % 5 === 0 && reviewCount > 0) {
                    // 중복 지급 방지: 이미 해당 마일스톤에 대한 보상이 지급되었는지 확인
                    const milestoneRewardExists = await tx.userReward.findFirst({
                        where: {
                            userId: numericUserId,
                            type: "course_completion_milestone",
                            amount: reviewCount / 5, // 몇 번째 마일스톤인지 (1, 2, 3...)
                            placeId: null, // 🟢 placeId를 명시적으로 null로 체크
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
                                type: "course_completion_milestone",
                                amount: reviewCount / 5,
                                unit: "coupon",
                                placeId: null, // 🟢 courseId 대신 placeId: null 사용 (스키마에 courseId 필드 없음)
                            },
                        });

                        couponAwarded = true;
                        couponAmount = 1;
                        couponMessage = `다녀온 코스에 리뷰를 5개 남기면 쿠폰을 드려요! 현재 ${reviewCount}개 작성 완료`;
                    }
                }
            }

            return { review, couponAwarded, couponAmount, couponMessage, isNewReview, reviewCount, personalMemoryCount };
        });

        // 응답 반환
        if (result.isNewReview) {
            return NextResponse.json(
                {
                    ...result.review,
                    couponAwarded: result.couponAwarded,
                    couponAmount: result.couponAmount || 0,
                    message: result.couponMessage || undefined,
                    personalMemoryCount: result.personalMemoryCount,
                },
                { status: 201 }
            );
        } else {
            // 🟢 기존 리뷰 업데이트 시에도 personalMemoryCount 반환 (모달 표시용)
            let personalMemoryCount: number | undefined = undefined;
            if (isPublicValue === false) {
                personalMemoryCount = await (prisma as any).review.count({
                    where: { 
                        userId: numericUserId,
                        isPublic: false
                    },
                });
            }
            return NextResponse.json({
                ...result.review,
                personalMemoryCount,
            }, { status: 200 });
        }
    } catch (error) {
        // [보안] 상세한 에러 메시지는 서버 로그에만 기록하고, 클라이언트에는 일반적인 메시지만 반환
        console.error("리뷰 생성 오류:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        const errorStack = error instanceof Error ? error.stack : undefined;
        console.error("에러 상세:", errorMessage);
        console.error("에러 스택:", errorStack);

        // Prisma 에러인 경우 특별 처리
        if (error instanceof Error && error.message.includes("Unique constraint")) {
            return NextResponse.json({ error: "이미 리뷰를 작성하셨습니다." }, { status: 409 });
        }

        // Prisma 필드 관련 에러 처리
        if (error instanceof Error && (error.message.includes("Unknown arg") || error.message.includes("Invalid value"))) {
            console.error("Prisma 필드 에러 - 스키마 확인 필요:", error.message);
            return NextResponse.json({ error: "데이터베이스 스키마 오류가 발생했습니다." }, { status: 500 });
        }

        return NextResponse.json({ error: "리뷰 생성 중 오류가 발생했습니다." }, { status: 500 });
    }
}
