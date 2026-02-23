import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";
import { resolveUserId } from "@/lib/auth";

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
    { type: "COURSE_TICKET" | "SUBSCRIPTION"; value: number; name: string; tier?: "BASIC" | "PREMIUM" }
> = {
    ticket_basic: { type: "COURSE_TICKET", value: 1, name: "BASIC 코스 열람권", tier: "BASIC" },
    ticket_premium: { type: "COURSE_TICKET", value: 1, name: "PREMIUM 코스 열람권", tier: "PREMIUM" },
    sub_basic: { type: "SUBSCRIPTION", value: 30, name: "AI 베이직 구독 (월 4,900원)", tier: "BASIC" },
    sub_premium: { type: "SUBSCRIPTION", value: 30, name: "AI 프리미엄 구독 (월 9,900원)", tier: "PREMIUM" },
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
            // 이미 처리된 결제 (어떤 상태든 이미 orderId가 존재함)
            const user = await prisma.user.findUnique({ 
                where: { id: userId }, 
                select: { subscriptionTier: true } 
            });
            
            // 만약 PAID 상태가 아니면 업데이트 시도 (중요: 이미 존재하므로 지급은 하지 않음)
            if (existingPayment.status !== "PAID") {
                await prisma.payment.update({
                    where: { id: existingPayment.id },
                    data: { status: "PAID" },
                });
            }
            
            return NextResponse.json({ 
                success: true, 
                message: "Already processed",
                subscriptionTier: user?.subscriptionTier
            });
        }

        // 🟢 코스 열람권/구독 지급
        const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            if (productInfo.type === "COURSE_TICKET" && unlockCourseId) {
                await (tx as any).courseUnlock.upsert({
                    where: {
                        userId_courseId: { userId, courseId: unlockCourseId },
                    },
                    update: {},
                    create: { userId, courseId: unlockCourseId },
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
                        amount: 0,
                        status: "PAID",
                        method: "IN_APP",
                        approvedAt: new Date(),
                    },
                });
            } catch (createError: any) {
                // unique constraint 오류인 경우 (race condition 대비)
                if (createError?.code === "P2002" && createError?.meta?.target?.includes("order_id")) {
                    console.warn("[RevenueCat Confirm] Payment record already exists:", orderId);
                    // 이미 존재하는 경우 무시하고 진행
                } else {
                    throw createError; // 다른 오류는 다시 throw
                }
            }

            const updatedUser = await tx.user.findUnique({
                where: { id: userId },
                select: {
                    subscriptionTier: true,
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
        console.error("[RevenueCat Confirm] Error:", error);
        return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
    }
}
