import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

// 🟢 [IN-APP PURCHASE]: RevenueCat 상품 ID 매핑
const PRODUCT_MAPPING: Record<
    string,
    { type: "COUPON" | "SUBSCRIPTION"; value: number; name: string; tier?: "BASIC" | "PREMIUM" }
> = {
    ticket_light: { type: "COUPON", value: 3, name: "AI 추천 쿠폰 3개 (Light)" },
    ticket_standard: { type: "COUPON", value: 5, name: "AI 추천 쿠폰 5개 (Standard)" },
    ticket_pro: { type: "COUPON", value: 10, name: "AI 추천 쿠폰 10개 (Pro)" },
    sub_basic: { type: "SUBSCRIPTION", value: 30, name: "AI 베이직 구독 (월 4,900원)", tier: "BASIC" },
    sub_premium: { type: "SUBSCRIPTION", value: 30, name: "AI 프리미엄 구독 (월 9,900원)", tier: "PREMIUM" },
};

/**
 * RevenueCat Webhook 처리
 * RevenueCat 서버에서 결제 이벤트 발생 시 호출되는 엔드포인트
 */
export async function POST(request: NextRequest) {
    try {
        // 1. 🔐 보안 검증: RevenueCat 대시보드에서 설정한 비밀 키와 대조
        const authHeader = request.headers.get("authorization");
        const webhookSecret = process.env.REVENUECAT_WEBHOOK_SECRET; // .env에 저장 권장

        // 대시보드(image_05f7a9.png)의 'Authorization header value'와 비교
        if (authHeader !== webhookSecret) {
            console.error("[RevenueCat Webhook] Unauthorized access attempt detected.");
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();

        // 🟢 [IN-APP PURCHASE]: RevenueCat Webhook 이벤트 구조
        const event = body.event;
        if (!event) {
            return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
        }

        const eventType = event.type;
        const appUserId = event.app_user_id; // RevenueCat의 사용자 ID
        const productId = event.product_id; // 상품 ID (예: sub_basic, ticket_light)

        // 🟢 사용자 ID 추출 (app_user_id 형식: "user_123" 또는 숫자)
        const userIdStr = appUserId?.toString().replace("user_", "") || "";
        const userId = Number(userIdStr);

        if (!userId || isNaN(userId) || userId <= 0) {
            console.error("[RevenueCat Webhook] Invalid user ID:", appUserId);
            return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
        }

        // 🟢 상품 정보 확인
        const productInfo = PRODUCT_MAPPING[productId];
        if (!productInfo) {
            console.warn("[RevenueCat Webhook] Unknown product ID:", productId);
            // 알 수 없는 상품이어도 200 반환 (중요한 오류가 아니므로)
            return NextResponse.json({ success: true, message: "Unknown product, skipping" });
        }

        console.log("[RevenueCat Webhook] Event received:", {
            eventType,
            productId,
            userId,
            productName: productInfo.name,
        });

        // 🟢 이벤트 타입에 따른 처리
        if (eventType === "INITIAL_PURCHASE") {
            // 첫 구매 처리
            await handleInitialPurchase(userId, productInfo, event);
        } else if (eventType === "RENEWAL") {
            // 구독 갱신 처리
            await handleRenewal(userId, productInfo, event);
        } else if (eventType === "CANCELLATION") {
            // 구독 취소 처리
            await handleCancellation(userId, event);
        } else if (eventType === "UNCANCELLATION") {
            // 취소 복구 처리
            await handleUncancellation(userId, productInfo, event);
        } else if (eventType === "REFUND") {
            // 🟢 환불 처리 (플랫폼에서 실제 환불이 처리된 경우)
            await handleRefund(userId, productInfo, event);
        } else {
            // 기타 이벤트는 무시
            console.log("[RevenueCat Webhook] Unhandled event type:", eventType);
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("[RevenueCat Webhook] Error:", error);
        return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
    }
}

/**
 * 첫 구매 처리
 */
async function handleInitialPurchase(
    userId: number,
    productInfo: { type: "COUPON" | "SUBSCRIPTION"; value: number; name: string; tier?: "BASIC" | "PREMIUM" },
    event: any
) {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        if (productInfo.type === "COUPON") {
            // 쿠폰 지급
            await tx.user.update({
                where: { id: userId },
                data: {
                    couponCount: { increment: productInfo.value },
                },
            });
        } else if (productInfo.type === "SUBSCRIPTION" && productInfo.tier) {
            // 구독 활성화
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

        // 🟢 결제 기록 저장 (선택사항)
        // RevenueCat의 transaction_id를 orderId로 사용
        const transactionId = event.transaction_id || `rc_${Date.now()}`;
        try {
            await tx.payment.create({
                data: {
                    orderId: transactionId,
                    userId: userId,
                    orderName: productInfo.name,
                    amount: 0, // RevenueCat은 금액 정보를 제공하지 않을 수 있음
                    status: "PAID",
                    method: "IN_APP",
                    approvedAt: new Date(event.purchased_at_ms || Date.now()),
                },
            });
        } catch (e) {
            // orderId 중복 등으로 인한 오류는 무시 (이미 처리된 것으로 간주)
            console.warn("[RevenueCat Webhook] Payment record creation skipped:", e);
        }
    });
}

/**
 * 구독 갱신 처리
 */
async function handleRenewal(
    userId: number,
    productInfo: { type: "COUPON" | "SUBSCRIPTION"; value: number; name: string; tier?: "BASIC" | "PREMIUM" },
    event: any
) {
    if (productInfo.type !== "SUBSCRIPTION" || !productInfo.tier) {
        return; // 구독이 아닌 경우 무시
    }

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const currentUser = await tx.user.findUnique({ where: { id: userId } });
        const now = new Date();

        let newExpireDate = now;
        if (currentUser?.subscriptionExpiresAt && currentUser.subscriptionExpiresAt > now) {
            newExpireDate = new Date(currentUser.subscriptionExpiresAt);
        }
        newExpireDate.setDate(newExpireDate.getDate() + productInfo.value);

        await tx.user.update({
            where: { id: userId },
            data: {
                subscriptionTier: productInfo.tier,
                subscriptionExpiresAt: newExpireDate,
                isAutoRenewal: true,
            },
        });
    });
}

/**
 * 구독 취소 처리
 */
async function handleCancellation(userId: number, event: any) {
    // 🟢 구독 취소 시 즉시 등급을 다운그레이드하지 않음
    // subscriptionExpiresAt이 지나면 자동으로 FREE로 변경되도록 함
    // (RevenueCat의 정책에 따라 실제 만료일까지는 사용 가능)

    await prisma.user.update({
        where: { id: userId },
        data: {
            isAutoRenewal: false,
        },
    });
}

/**
 * 취소 복구 처리
 */
async function handleUncancellation(
    userId: number,
    productInfo: { type: "COUPON" | "SUBSCRIPTION"; value: number; name: string; tier?: "BASIC" | "PREMIUM" },
    event: any
) {
    if (productInfo.type !== "SUBSCRIPTION" || !productInfo.tier) {
        return;
    }

    await prisma.user.update({
        where: { id: userId },
        data: {
            isAutoRenewal: true,
        },
    });
}

/**
 * 🟢 환불 처리 (플랫폼에서 실제 환불이 처리된 경우)
 * RevenueCat 웹훅이 REFUND 이벤트를 보내면 호출됨
 */
async function handleRefund(
    userId: number,
    productInfo: { type: "COUPON" | "SUBSCRIPTION"; value: number; name: string; tier?: "BASIC" | "PREMIUM" },
    event: any
) {
    // 🟢 transaction_id로 결제 기록 찾기
    const transactionId = event.transaction_id || event.original_transaction_id;
    if (!transactionId) {
        console.error("[RevenueCat Webhook] REFUND: transaction_id가 없습니다.");
        return;
    }

    // 결제 기록 찾기 (orderId가 transactionId와 일치하는 경우)
    const payment = await prisma.payment.findFirst({
        where: {
            userId: userId,
            orderId: transactionId.toString(),
            status: "PAID",
            method: "IN_APP",
        },
        include: { user: true },
    });

    if (!payment) {
        console.warn("[RevenueCat Webhook] REFUND: 해당 결제 기록을 찾을 수 없습니다:", transactionId);
        return;
    }

    // 🟢 이미 환불 처리되었는지 확인
    if (payment.status === "CANCELLED") {
        console.log("[RevenueCat Webhook] REFUND: 이미 환불 처리된 결제입니다:", transactionId);
        return;
    }

    const isCoupon = productInfo.type === "COUPON";
    let retrieveCount = 0;

    if (isCoupon) {
        retrieveCount = productInfo.value;
        // 쿠폰을 이미 사용했는지 확인 (경고만 표시, 환불은 진행)
        if (payment.user.couponCount < retrieveCount) {
            console.warn("[RevenueCat Webhook] REFUND: 쿠폰을 이미 사용함:", {
                userId,
                transactionId,
                couponCount: payment.user.couponCount,
                retrieveCount,
            });
        }
    }

    // 🟢 DB 업데이트 (트랜잭션으로 일관성 보장)
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // 결제 상태 변경
        await tx.payment.update({
            where: { id: payment.id },
            data: { status: "CANCELLED" },
        });

        if (isCoupon) {
            // 쿠폰 개수 차감 (사용한 만큼만 차감)
            const actualRetrieveCount = Math.min(retrieveCount, payment.user.couponCount);
            if (actualRetrieveCount > 0) {
                await tx.user.update({
                    where: { id: userId },
                    data: { couponCount: { decrement: actualRetrieveCount } },
                });
            }
        } else {
            // 구독 등급 강등 및 만료 처리
            await tx.user.update({
                where: { id: userId },
                data: {
                    subscriptionTier: "FREE",
                    subscriptionExpiresAt: null,
                    isAutoRenewal: false,
                },
            });
        }
    });

    console.log("[RevenueCat Webhook] REFUND: 환불 처리 완료", {
        userId,
        transactionId,
        productName: productInfo.name,
        isCoupon,
        retrieveCount,
    });
}
