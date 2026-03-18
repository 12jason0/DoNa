import { NextRequest, NextResponse } from "next/server";
import xss from "xss";
import prisma from "@/lib/db";
import { resolveUserId } from "@/lib/auth";
import { getMemoryLimit } from "@/constants/subscription";
import { decrypt, encrypt } from "@/lib/crypto";
import { checkRateLimit, getIdentifierFromRequest } from "@/lib/rateLimit";
import { captureApiError } from "@/lib/sentry";

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
                        region: true,
                        imageUrl: true,
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
            const rawIsPublic = (r as any).isPublic;
            const isPublicValue = rawIsPublic !== undefined && rawIsPublic !== null ? Boolean(rawIsPublic) : true;
            let commentText = "";
            try {
                commentText = r.comment ? decrypt(r.comment) : "";
            } catch {
                commentText = "";
            }
            return {
            id: r.id,
            courseId: r.courseId,
            userId: r.userId,
            rating: r.rating,
            comment: commentText,
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
                      region: (r.course as any).region || null,
                      imageUrl: (r.course as any).imageUrl || null,
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

        return NextResponse.json(formatted, {
            headers: { "Cache-Control": "private, max-age=60" },
        });
    } catch (error) {
            captureApiError(error);
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("API: /api/reviews GET failed:", message);
        return NextResponse.json({ error: "리뷰 조회 중 오류가 발생했습니다." }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const userId = resolveUserId(request);
        if (!userId) {
            return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
        }

        // 🟢 Rate limiting: 분당 20회 (IP 또는 userId 기준)
        const identifier = String(userId) || getIdentifierFromRequest(request);
        const rl = await checkRateLimit("review", identifier);
        if (!rl.success) {
            return NextResponse.json(
                { error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." },
                { status: 429, headers: { "Retry-After": String(Math.ceil((rl.reset - Date.now()) / 1000)) } }
            );
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

        // 🟢 코스 리뷰(공개)는 코스 완료 없이 작성 가능. 나만의 추억(비공개)은 코스 진행 중/완료 시 작성.

        // 🟢 코스 리뷰(공개): 같은 코스에 여러 개 허용. 나만의 추억(비공개)은 별도 로직 유지.
        const existingReview = null;

        // 🟢 나만의 추억(isPublic: false)은 최소 1장 이상의 사진이 필요
        // 🟢 공개 리뷰(isPublic: true)는 사진 없이도 저장 가능
        if (!isPublicValue) {
            const imageUrlsArray = Array.isArray(imageUrls) ? imageUrls : [];
            if (imageUrlsArray.length < 1) {
                return NextResponse.json(
                    {
                        success: false,
                        message: `오늘의 순간을 저장하려면 최소 1장 이상의 사진이 필요합니다. 현재 ${imageUrlsArray.length}장의 사진이 있습니다.`,
                    },
                    { status: 400 }
                );
            }

            // 🟢 나만의 추억 등급별 한도: FREE/BASIC 초과 시 저장 불가, 구독 업그레이드 유도
            const user = await prisma.user.findUnique({
                where: { id: numericUserId },
                select: { subscriptionTier: true },
            });
            const tier = (user?.subscriptionTier ?? "FREE") as string;
            const limit = getMemoryLimit(tier);
            if (Number.isFinite(limit)) {
                const currentCount = await (prisma as any).review.count({
                    where: { userId: numericUserId, isPublic: false },
                });
                if (currentCount >= limit) {
                    const tierLabel = tier === "FREE" ? "FREE" : tier === "BASIC" ? "BASIC" : "PREMIUM";
                    const message =
                        `오늘의 순간은 ${tierLabel} 등급에서 ${limit}개까지 저장할 수 있어요. 더 저장하려면 구독을 업그레이드해 주세요.`;
                    return NextResponse.json(
                        { success: false, error: message, code: "MEMORY_LIMIT_REACHED", tier: tierLabel, limit },
                        { status: 403 }
                    );
                }
            }
        }

        const rawComment: string =
            typeof comment === "string" && comment.trim().length > 0
                ? comment.trim()
                : typeof content === "string"
                ? content.trim()
                : "";
        // 🟢 XSS 방지: 저장 전 HTML/스크립트 제거 (Stored XSS 방지) - xss 패키지 사용 (jsdom/ESM 호환)
        const finalComment = rawComment
            ? xss(rawComment, { whiteList: {}, stripIgnoreTag: true, stripIgnoreTagBody: ["script"] })
            : "";

        // 🟢 입력 길이 제한: 리뷰 코멘트 1000자
        if (finalComment.length > 1000) {
            return NextResponse.json(
                { error: "리뷰는 1000자 이하로 작성해 주세요." },
                { status: 400 }
            );
        }

        // 🟢 AES-256 암호화: 민감 텍스트는 DB 저장 전 암호화 (디지털 금고)
        const encryptedComment = finalComment ? encrypt(finalComment) : finalComment;

            // 🟢 트랜잭션으로 리뷰 저장 + 열람권 지급 처리
        const result = await prisma.$transaction(async (tx) => {
            let review;
            let isNewReview = false;

            // 🟢 항상 새 리뷰 생성 (코스 리뷰·나만의 추억 모두 여러 개 허용, 나만의 추억은 별도)
            // 🟢 나만의 추억: 트랜잭션 안에서 한도 재확인 (동시 요청 시 11개 생성 방지)
                if (!isPublicValue) {
                    const userInTx = await tx.user.findUnique({
                        where: { id: numericUserId },
                        select: { subscriptionTier: true },
                    });
                    const tierInTx = (userInTx?.subscriptionTier ?? "FREE") as string;
                    const limitInTx = getMemoryLimit(tierInTx);
                    if (Number.isFinite(limitInTx)) {
                        const countInTx = await (tx as any).review.count({
                            where: { userId: numericUserId, isPublic: false },
                        });
                        if (countInTx >= limitInTx) {
                            const tierLabel = tierInTx === "FREE" ? "FREE" : tierInTx === "BASIC" ? "BASIC" : "PREMIUM";
                            const msg = `오늘의 순간은 ${tierLabel} 등급에서 ${limitInTx}개까지 저장할 수 있어요. 더 저장하려면 구독을 업그레이드해 주세요.`;
                            const err = new Error(msg) as Error & { code?: string };
                            (err as any).code = "MEMORY_LIMIT_REACHED";
                            throw err;
                        }
                    }
                }
                // 새 리뷰 생성
                review = await tx.review.create({
                    data: {
                        userId: numericUserId,
                        courseId: numericCourseId,
                        rating: numericRating,
                        comment: encryptedComment,
                        imageUrls: Array.isArray(imageUrls) ? imageUrls : [],
                        isPublic: isPublicValue,
                        tags: Array.isArray(tags) ? tags : [], // 🟢 태그 저장
                        placeData: placeData || null, // 🟢 장소별 데이터 저장
                    } as any, // 🟢 타입 캐스팅 (Prisma 클라이언트 타입이 아직 업데이트되지 않음)
                });
            isNewReview = true;

            let personalMemoryCount: number | undefined = undefined;

            if (isPublicValue === false) {
                personalMemoryCount = await (tx as any).review.count({
                    where: { userId: numericUserId, isPublic: false },
                });
            }

            return { review, isNewReview, personalMemoryCount };
        });

        // 응답 반환 (클라이언트에는 복호화된 comment 전달)
        const reviewForClient = {
            ...result.review,
            comment: result.review.comment ? decrypt(result.review.comment) : "",
        };
        if (result.isNewReview) {
            return NextResponse.json(
                {
                    ...reviewForClient,
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
                ...reviewForClient,
                personalMemoryCount,
            }, { status: 200 });
        }
    } catch (error) {
            captureApiError(error);
        // [보안] 상세한 에러 메시지는 서버 로그에만 기록하고, 클라이언트에는 일반적인 메시지만 반환
        console.error("리뷰 생성 오류:", error);

        // 🟢 나만의 추억 한도 초과 (트랜잭션 안에서 던진 에러)
        if (error instanceof Error && (error as any).code === "MEMORY_LIMIT_REACHED") {
            return NextResponse.json(
                { success: false, error: error.message, code: "MEMORY_LIMIT_REACHED" },
                { status: 403 }
            );
        }

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
