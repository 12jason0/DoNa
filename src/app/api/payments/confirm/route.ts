import { NextRequest, NextResponse } from "next/server";
// 👇 [수정됨] lib/prisma가 아니라 lib/db에서 가져옵니다.
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { resolveUserId } from "@/lib/auth"; // 🔐 [보안] 서버 세션 쿠키 검증
import { checkRateLimit, getIdentifierFromRequest } from "@/lib/rateLimit";
import { captureApiError } from "@/lib/sentry";

export const dynamic = "force-dynamic";

type PlanKey = "ticket_basic" | "ticket_premium" | "sub_basic" | "sub_premium";

interface PlanInfo {
    amount: number;
    type: "COURSE_TICKET" | "SUBSCRIPTION";
    value: number;
    name: string;
    tier?: "FREE" | "BASIC" | "PREMIUM";
}

const PLAN_DATA: Record<PlanKey, PlanInfo> = {
    ticket_basic: { amount: 990, type: "COURSE_TICKET", value: 1, name: "BASIC 코스 열람권", tier: "BASIC" },
    ticket_premium: { amount: 1900, type: "COURSE_TICKET", value: 1, name: "PREMIUM 코스 열람권", tier: "PREMIUM" },
    sub_basic: {
        amount: 4900,
        type: "SUBSCRIPTION",
        value: 30,
        name: "AI 베이직 구독 (월 4,900원)",
        tier: "BASIC",
    },
    sub_premium: {
        amount: 9900,
        type: "SUBSCRIPTION",
        value: 30,
        name: "AI 프리미엄 구독 (월 9,900원)",
        tier: "PREMIUM",
    },
};

export async function POST(req: NextRequest) {
    try {
        // 🟢 [보안] Rate limiting: 결제 API 남용 방지
        const userIdForRl = resolveUserId(req);
        const identifier = userIdForRl ? `user:${userIdForRl}` : getIdentifierFromRequest(req);
        const rl = await checkRateLimit("payment", identifier);
        if (!rl.success) {
            return NextResponse.json(
                { success: false, error: "RATE_LIMITED", message: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
                { status: 429, headers: { "X-RateLimit-Limit": String(rl.limit), "X-RateLimit-Remaining": String(rl.remaining) } }
            );
        }

        const body = await req.json();
        const { paymentKey, orderId, amount, plan, userId, intentId } = body as {
            paymentKey?: string;
            orderId?: string;
            amount?: number;
            plan?: PlanKey;
            userId?: number | string;
            intentId?: string;
        };

        // 🔐 [보안] 1. 서버 세션 쿠키에서 userId 추출 (클라이언트가 보낸 userId 맹신 금지)
        const authenticatedUserId = resolveUserId(req);
        if (!authenticatedUserId) {
            return NextResponse.json(
                { success: false, error: "UNAUTHORIZED", message: "인증이 필요합니다." },
                { status: 401 }
            );
        }

        // 2. 필수 파라미터 검증
        if (!paymentKey) {
            return NextResponse.json(
                { success: false, error: "INVALID_REQUEST", message: "paymentKey가 없습니다." },
                { status: 400 }
            );
        }
        if (!orderId) {
            return NextResponse.json(
                { success: false, error: "INVALID_REQUEST", message: "orderId가 없습니다." },
                { status: 400 }
            );
        }
        if (!amount) {
            return NextResponse.json(
                { success: false, error: "INVALID_REQUEST", message: "amount가 없습니다." },
                { status: 400 }
            );
        }
        if (!plan) {
            return NextResponse.json(
                { success: false, error: "INVALID_REQUEST", message: "plan이 없습니다." },
                { status: 400 }
            );
        }

        // 🔐 [보안] 3. body의 userId와 서버 세션 쿠키의 userId 일치 확인 (결제 하이재킹 방지)
        const bodyUserId = userId ? Number(userId) : null;
        if (bodyUserId && bodyUserId !== authenticatedUserId) {
            console.error("[Payment Confirm] userId 불일치 감지:", {
                bodyUserId,
                authenticatedUserId,
                orderId,
            });
            return NextResponse.json(
                { success: false, error: "UNAUTHORIZED", message: "잘못된 접근입니다." },
                { status: 403 }
            );
        }

        // 🔐 서버에서 검증한 userId 사용 (body의 userId는 무시)
        const numericUserId = authenticatedUserId;

        // 2. plan이 유효한지 확인
        if (!(plan in PLAN_DATA)) {
            return NextResponse.json(
                {
                    success: false,
                    error: "INVALID_REQUEST",
                    message: `유효하지 않은 plan입니다: ${plan}. 가능한 값: ${Object.keys(PLAN_DATA).join(", ")}`,
                },
                { status: 400 }
            );
        }

        const planInfo = PLAN_DATA[plan];

        // 🟢 COURSE_TICKET 결제 시 intentId 필수 (Unlock Intent 검증)
        if (planInfo.type === "COURSE_TICKET") {
            if (!intentId || typeof intentId !== "string") {
                return NextResponse.json(
                    { success: false, error: "INVALID_REQUEST", message: "intentId가 필요합니다." },
                    { status: 400 }
                );
            }
        }

        // 3. 금액 검증
        if (Number(amount) !== planInfo.amount) {
            return NextResponse.json(
                {
                    success: false,
                    error: "INVALID_AMOUNT",
                    message: `금액이 일치하지 않습니다. 받은 금액: ${amount}, 예상 금액: ${planInfo.amount}`,
                },
                { status: 400 }
            );
        }

        // 🟢 [Fix]: 웹 결제 승인(/api/payments/confirm)은 항상 GENERAL 키를 사용하도록 고정합니다.
        // 프론트엔드(TicketPlans.tsx)에서 구독권/열람권 상관없이 NEXT_PUBLIC_TOSS_CLIENT_KEY_GENERAL을 사용하므로,
        // 백엔드에서도 동일한 MID의 시크릿 키를 사용해야 합니다.
        // ⚠️ 중요: 프론트엔드에서 사용한 클라이언트 키와 백엔드 시크릿 키의 MID가 일치해야 합니다!
        const secretKey = process.env.TOSS_SECRET_KEY_GENERAL;

        if (!secretKey) {
            return NextResponse.json(
                {
                    success: false,
                    error: "MISSING_SECRET_KEY",
                    message: "일반 결제 시크릿 키가 설정되지 않았습니다.",
                },
                { status: 500 }
            );
        }

        const authHeader = Buffer.from(`${secretKey}:`).toString("base64");
        const res = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
            method: "POST",
            headers: {
                Authorization: `Basic ${authHeader}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ paymentKey, orderId, amount: planInfo.amount }),
            cache: "no-store",
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            return NextResponse.json(
                { success: false, error: data?.message || "PAYMENT_CONFIRM_FAILED", details: data },
                { status: 400 }
            );
        }

        // 🟢 COURSE_TICKET: Intent 검증 및 CourseUnlock 생성
        let unlockCourseId: number | null = null;
        if (planInfo.type === "COURSE_TICKET" && intentId) {
            const intent = await (prisma as any).unlockIntent.findUnique({
                where: { id: intentId },
            });
            if (!intent || intent.userId !== numericUserId || intent.status !== "PENDING") {
                return NextResponse.json(
                    {
                        success: false,
                        error: "INVALID_INTENT",
                        message: "유효하지 않거나 만료된 결제 의도입니다. 다시 시도해주세요.",
                    },
                    { status: 400 }
                );
            }
            if (intent.planId !== plan) {
                return NextResponse.json(
                    {
                        success: false,
                        error: "INTENT_MISMATCH",
                        message: "결제 상품과 의도가 일치하지 않습니다.",
                    },
                    { status: 400 }
                );
            }
            // 🟢 courseGrade 검증 제거 → unlock-intent에서 productId 기반 검증 완료됨
            unlockCourseId = intent.courseId;
        }

        // 👇 tx 타입을 명시하여 빨간 줄 제거
        const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            // 결제 기록 생성
            const newPayment = await tx.payment.create({
                data: {
                    orderId: orderId,
                    userId: numericUserId,
                    orderName: planInfo.name,
                    amount: planInfo.amount,
                    status: "PAID",
                    paymentKey: paymentKey,
                    method: data.method || "CARD",
                    approvedAt: new Date(data.approvedAt) || new Date(),
                },
            });

            // 유저 혜택 지급
            let updatedUser;

            if (planInfo.type === "COURSE_TICKET" && unlockCourseId) {
                // 🟢 CourseUnlock 생성
                await (tx as any).courseUnlock.upsert({
                    where: {
                        userId_courseId: { userId: numericUserId, courseId: unlockCourseId },
                    },
                    update: {},
                    create: {
                        userId: numericUserId,
                        courseId: unlockCourseId,
                    },
                });
                await (tx as any).unlockIntent.update({
                    where: { id: intentId! },
                    data: { status: "COMPLETED" },
                });
                updatedUser = await tx.user.findUnique({
                    where: { id: numericUserId },
                    select: { subscriptionTier: true, subscriptionExpiresAt: true },
                });
            } else if (planInfo.type === "SUBSCRIPTION") {
                const currentUser = await tx.user.findUnique({ where: { id: numericUserId } });
                const now = new Date();

                let newExpireDate = now;
                if (currentUser?.subscriptionExpiresAt && currentUser.subscriptionExpiresAt > now) {
                    newExpireDate = new Date(currentUser.subscriptionExpiresAt);
                }
                newExpireDate.setDate(newExpireDate.getDate() + planInfo.value);

                const targetTier = planInfo.tier || "BASIC";

                updatedUser = await tx.user.update({
                    where: { id: numericUserId },
                    data: {
                        subscriptionTier: targetTier,
                        subscriptionExpiresAt: newExpireDate,
                        isAutoRenewal: true,
                    },
                    select: {
                        subscriptionTier: true,
                        subscriptionExpiresAt: true,
                    },
                });
            }

            return { payment: newPayment, user: updatedUser };
        });

        // 🟢 응답 데이터
        const responseData: Record<string, unknown> = {
            success: true,
            orderId,
            planName: planInfo.name,
            updatedUser: {
                subscriptionTier: (result.user as any)?.subscriptionTier,
                subscriptionExpiresAt: (result.user as any)?.subscriptionExpiresAt,
            },
        };
        if (unlockCourseId != null) {
            responseData.courseId = unlockCourseId;
        }

        return NextResponse.json(responseData);
    } catch (e: any) {
            captureApiError(e);
        console.error("Payment Confirm Error:", e);
        console.error("Error details:", {
            message: e?.message,
            stack: e?.stack,
            name: e?.name,
        });
        return NextResponse.json(
            { success: false, error: "UNKNOWN_ERROR", message: e?.message || "결제 처리 중 오류가 발생했습니다." },
            { status: 500 }
        );
    }
}
