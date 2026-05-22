import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";
import { resolveUserId } from "@/lib/auth";
import { captureApiError } from "@/lib/sentry";

export const dynamic = "force-dynamic";

// 🟢 [IN-APP PURCHASE]: RevenueCat Product ID → plan.id 매핑
const REVENUECAT_TO_PLAN_ID: Record<string, string> = {
    "kr.io.dona.course_basic": "ticket_basic",
    "kr.io.dona.course_premium": "ticket_premium",
    "kr.io.dona.ai_basic_monthly": "sub_basic",
    "kr.io.dona.premium_monthly": "sub_premium",
};

const PRODUCT_MAPPING: Record<
    string,
    { type: "COURSE_TICKET" | "SUBSCRIPTION"; value: number; name: string; tier?: "BASIC" | "PREMIUM"; price: number }
> = {
    ticket_basic: { type: "COURSE_TICKET", value: 1, name: "BASIC 코스 열람권", tier: "BASIC", price: 990 },
    ticket_premium: { type: "COURSE_TICKET", value: 1, name: "PREMIUM 코스 열람권", tier: "PREMIUM", price: 1990 },
    sub_basic: { type: "SUBSCRIPTION", value: 30, name: "AI 베이직 구독 (월 4,900원)", tier: "BASIC", price: 4900 },
    sub_premium: { type: "SUBSCRIPTION", value: 30, name: "AI 프리미엄 구독 (월 9,900원)", tier: "PREMIUM", price: 9900 },
};

export async function POST(request: NextRequest) {
    try {
        // 🟢 서버 세션 검증
        const userId = await resolveUserId(request);
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { planId, planType, transactionId, customerInfo, intentId, courseId } = body;

        const productInfo = PRODUCT_MAPPING[planId];
        if (!productInfo) {
            return NextResponse.json({ error: "Invalid product" }, { status: 400 });
        }

        // 🟢 COURSE_TICKET은 intentId 필수
        let unlockCourseId: number | null = null;
        if (productInfo.type === "COURSE_TICKET") {
            if (!intentId) {
                return NextResponse.json({ error: "intentId required for course ticket" }, { status: 400 });
            }
            const intent = await (prisma as any).unlockIntent.findUnique({
                where: { id: intentId },
            });
            if (!intent || intent.userId !== userId || intent.status !== "PENDING") {
                return NextResponse.json({ error: "Invalid or expired intent" }, { status: 400 });
            }
            if (intent.expiresAt && intent.expiresAt < new Date()) {
                return NextResponse.json({ error: "Intent expired" }, { status: 410 });
            }
            if (intent.planId !== planId) {
                return NextResponse.json({ error: "Intent plan mismatch" }, { status: 400 });
            }
            unlockCourseId = intent.courseId;
        }

        // 🟢 중복 처리 방지: orderId 기준으로 확인 (status 무관)
        const orderId = transactionId?.toString() || `rc_${userId}_${Date.now()}`;
        const existingPayment = await prisma.payment.findUnique({
            where: {
                orderId: orderId,
            },
        });

        if (existingPayment) {
            // 이미 처리된 결제 (webhook이 먼저 처리한 경우)
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { subscriptionTier: true }
            });

            if (existingPayment.status !== "PAID") {
                await prisma.payment.update({
                    where: { id: existingPayment.id },
                    data: { status: "PAID" },
                });
            }

            // webhook이 pending_course_id 없이 처리한 경우 CourseUnlock이 없을 수 있으므로 여기서도 생성
            if (productInfo.type === "COURSE_TICKET" && unlockCourseId) {
                await (prisma as any).courseUnlock.createMany({
                    data: [{ userId, courseId: unlockCourseId }],
                    skipDuplicates: true,
                });
            }

            const resPayload: Record<string, unknown> = {
                success: true,
                message: "Already processed",
                subscriptionTier: user?.subscriptionTier,
            };
            if (unlockCourseId != null) resPayload.courseId = unlockCourseId;
            return NextResponse.json(resPayload);
        }

        // 🟢 코스 열람권/구독 지급
        const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            if (productInfo.type === "COURSE_TICKET" && unlockCourseId) {
                // createMany + skipDuplicates: 웹훅이 이미 생성한 경우 P2002 없이 무시
                await (tx as any).courseUnlock.createMany({
                    data: [{ userId, courseId: unlockCourseId }],
                    skipDuplicates: true,
                });
                await (tx as any).unlockIntent.update({
                    where: { id: intentId },
                    data: { status: "COMPLETED" },
                });
            } else if (productInfo.type === "SUBSCRIPTION" && productInfo.tier) {
                const now = new Date();
                const expireDate = new Date(now);
                expireDate.setDate(expireDate.getDate() + productInfo.value);

                await tx.user.update({
                    where: { id: userId },
                    data: {
                        subscriptionTier: productInfo.tier,
                        subscriptionExpiresAt: expireDate,
                        isAutoRenewal: true,
                    },
                });
            }

            // 결제 기록 저장 (unique constraint 오류 대비)
            try {
                await tx.payment.create({
                    data: {
                        orderId: orderId,
                        userId: userId,
                        orderName: productInfo.name,
                        amount: productInfo.price,
                        status: "PAID",
                        method: "IN_APP",
                        approvedAt: new Date(),
                    },
                });
            } catch (createError: any) {
                    captureApiError(createError);
                // unique constraint 오류인 경우 (race condition 대비)
                if (createError?.code === "P2002" && createError?.meta?.target?.includes("order_id")) {
                    console.warn("[RevenueCat Confirm] Payment record already exists:", orderId);
                    // 이미 존재하는 경우 무시하고 진행
                } else {
                    throw createError; // 다른 오류는 다시 throw
                }
            }

            // COURSE_TICKET / SUBSCRIPTION 구분 없이 항상 최신 유저 정보 반환
            const updatedUser = await tx.user.findUnique({
                where: { id: userId },
                select: {
                    subscriptionTier: true,
                    subscriptionExpiresAt: true,
                },
            });

            return updatedUser;
        });

        console.log("[RevenueCat Confirm] 열람권/구독 지급 완료:", {
            userId,
            planId,
            subscriptionTier: result?.subscriptionTier,
        });

        const resPayload: Record<string, unknown> = {
            success: true,
            subscriptionTier: result?.subscriptionTier,
        };
        if (unlockCourseId != null) resPayload.courseId = unlockCourseId;
        return NextResponse.json(resPayload);
    } catch (error: any) {
        // P2034 = 데드락, P2002 = unique 충돌 — 웹훅과 confirm이 동시에 upsert할 때 발생
        // 웹훅이 먼저 CourseUnlock을 생성한 경우 → 이미 처리된 것으로 간주하고 200 반환
        if ((error?.code === "P2034" || error?.code === "P2002") && productInfo?.type === "COURSE_TICKET" && unlockCourseId) {
            try {
                const existingUnlock = await (prisma as any).courseUnlock.findFirst({
                    where: { userId, courseId: unlockCourseId },
                });
                if (existingUnlock) {
                    console.log("[RevenueCat Confirm] P2034 deadlock — CourseUnlock already created by webhook", { userId, courseId: unlockCourseId });
                    const user = await prisma.user.findUnique({
                        where: { id: userId },
                        select: { subscriptionTier: true },
                    });
                    return NextResponse.json({ success: true, courseId: unlockCourseId, subscriptionTier: user?.subscriptionTier });
                }
            } catch {
                // fallthrough to generic error
            }
        }
        captureApiError(error);
        console.error("[RevenueCat Confirm] Error:", error);
        return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
    }
}
